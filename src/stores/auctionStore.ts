import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { User } from '@/types';
import { useChatStore } from '@/stores/chatStore';

export interface Auction {
  id: string;
  conversation_id: string;
  creator_id: string;
  title: string;
  description: string | null;
  min_bid: number;
  started_at: string;
  ends_at: string;
  status: 'active' | 'ended' | 'cancelled';
  winner_id: string | null;
  winning_amount: number | null;
  total_pool: number;
  message_id: string | null;
  created_at: string;
  updated_at: string;
  creator?: Pick<User, 'id' | 'display_name' | 'avatar_url'>;
  winner?: Pick<User, 'id' | 'display_name' | 'avatar_url'> | null;
}

export interface AuctionBid {
  id: string;
  auction_id: string;
  user_id: string;
  amount: number;
  created_at: string;
  user?: Pick<User, 'id' | 'display_name' | 'avatar_url'>;
}

interface AuctionState {
  // Map: auction_id → Auction
  auctions: Record<string, Auction>;
  // Map: auction_id → my_bid (если есть)
  myBids: Record<string, AuctionBid>;
  // Все ставки видимы только после завершения. Map: auction_id → AuctionBid[]
  allBids: Record<string, AuctionBid[]>;

  loadAuctionsForConversation: (conversationId: string, myUserId: string) => Promise<void>;
  createAuction: (data: {
    conversationId: string;
    creatorId: string;
    title: string;
    description?: string;
    minBid: number;
    durationMs: number;
  }) => Promise<{ id: string | null; error: string | null }>;
  placeBid: (auctionId: string, amount: number) => Promise<{ ok: boolean; error: string | null; newBalance?: number }>;
  cancelAuction: (auctionId: string) => Promise<{ ok: boolean; error: string | null }>;
  loadAllBids: (auctionId: string) => Promise<void>;
  subscribeRealtime: (conversationId: string, myUserId: string) => void;
  unsubscribeRealtime: () => void;
  // Финализация всех просроченных активных аукционов
  finalizeExpiredAuctions: (conversationId: string) => Promise<void>;
}

let realtimeChannel: any = null;

export const useAuctionStore = create<AuctionState>((set, get) => ({
  auctions: {},
  myBids: {},
  allBids: {},

  loadAuctionsForConversation: async (conversationId, myUserId) => {
    const { data: aucs, error } = await supabase
      .from('auctions')
      .select(`
        *,
        creator:users!auctions_creator_id_fkey (id, display_name, avatar_url),
        winner:users!auctions_winner_id_fkey (id, display_name, avatar_url)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('loadAuctions:', error);
      return;
    }
    const map: Record<string, Auction> = {};
    for (const a of (aucs || []) as any as Auction[]) map[a.id] = a;
    set({ auctions: map });

    // Грузим мои ставки на эти аукционы
    const aucIds = Object.keys(map);
    if (aucIds.length > 0) {
      const { data: bids } = await supabase
        .from('auction_bids')
        .select('*')
        .eq('user_id', myUserId)
        .in('auction_id', aucIds);
      const myBidsMap: Record<string, AuctionBid> = {};
      for (const b of (bids || []) as any as AuctionBid[]) myBidsMap[b.auction_id] = b;
      set({ myBids: myBidsMap });
    }
  },

  finalizeExpiredAuctions: async (conversationId) => {
    const auctions = get().auctions;
    const now = Date.now();
    const expired = Object.values(auctions).filter(
      a => a.conversation_id === conversationId && a.status === 'active' && new Date(a.ends_at).getTime() <= now
    );
    for (const a of expired) {
      try {
        await supabase.rpc('finalize_auction', { auction_id_param: a.id });
      } catch (e) {
        console.error('finalize failed:', e);
      }
    }
  },

  createAuction: async ({ conversationId, creatorId, title, description, minBid, durationMs }) => {
    const endsAt = new Date(Date.now() + durationMs).toISOString();

    const { data: auc, error: aErr } = await supabase
      .from('auctions')
      .insert({
        conversation_id: conversationId,
        creator_id: creatorId,
        title: title.trim(),
        description: description?.trim() || null,
        min_bid: minBid,
        ends_at: endsAt,
        status: 'active',
      })
      .select(`
        *,
        creator:users!auctions_creator_id_fkey (id, display_name, avatar_url)
      `)
      .single();

    if (aErr || !auc) return { id: null, error: aErr?.message || 'Failed to create' };

    // Карточка аукциона и сообщение появляются локально сразу, без ожидания Realtime.
    set(state => ({ auctions: { ...state.auctions, [auc.id]: auc as any } }));
    const messageResult = await useChatStore.getState().sendWidgetMessage(
      conversationId,
      creatorId,
      `[AUCTION:${auc.id}]`,
      'system',
    );

    if (messageResult.error) {
      console.error('Failed to create auction message:', messageResult.error);
      return { id: auc.id, error: messageResult.error };
    }
    if (messageResult.id) {
      await supabase.from('auctions').update({ message_id: messageResult.id }).eq('id', auc.id);
      (auc as any).message_id = messageResult.id;
      set(state => ({ auctions: { ...state.auctions, [auc.id]: { ...(state.auctions[auc.id] || auc), message_id: messageResult.id } as any } }));
    }

    return { id: auc.id, error: null };
  },

  placeBid: async (auctionId, amount) => {
    const { data, error } = await supabase.rpc('place_auction_bid', {
      auction_id_param: auctionId,
      amount_param: amount,
    });
    if (error) {
      const msg = error.message;
      let userMsg = msg;
      if (msg.includes('Insufficient balance')) userMsg = 'Недостаточно токенов';
      else if (msg.includes('Bid below minimum')) userMsg = 'Ставка ниже минимальной';
      else if (msg.includes('New bid must be higher')) userMsg = 'Новая ставка должна быть выше текущей';
      else if (msg.includes('Auction already ended')) userMsg = 'Аукцион уже завершён';
      else if (msg.includes('Auction not active')) userMsg = 'Аукцион неактивен';
      else if (msg.includes('Not a member')) userMsg = 'Вы не участник этого чата';
      return { ok: false, error: userMsg };
    }

    // Обновляем мою ставку локально
    const fresh: AuctionBid = {
      id: 'local-' + Date.now(),
      auction_id: auctionId,
      user_id: '',  // не важно для локального стейта
      amount,
      created_at: new Date().toISOString(),
    };
    set(state => ({ myBids: { ...state.myBids, [auctionId]: fresh } }));

    return { ok: true, error: null, newBalance: data?.new_balance };
  },

  cancelAuction: async (auctionId) => {
    const { error } = await supabase.rpc('cancel_auction', { auction_id_param: auctionId });
    if (error) {
      const msg = error.message;
      let userMsg = msg;
      if (msg.includes('Only creator')) userMsg = 'Отменить может только создатель';
      else if (msg.includes('not active')) userMsg = 'Аукцион уже неактивен';
      return { ok: false, error: userMsg };
    }
    return { ok: true, error: null };
  },

  loadAllBids: async (auctionId) => {
    const { data } = await supabase
      .from('auction_bids')
      .select(`*, user:users (id, display_name, avatar_url)`)
      .eq('auction_id', auctionId)
      .order('amount', { ascending: false });

    set(state => ({
      allBids: { ...state.allBids, [auctionId]: (data || []) as any }
    }));
  },

  subscribeRealtime: (conversationId, myUserId) => {
    if (realtimeChannel) {
      try { supabase.removeChannel(realtimeChannel); } catch {}
    }

    realtimeChannel = supabase
      .channel('auctions_' + conversationId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions', filter: `conversation_id=eq.${conversationId}` }, async (payload: any) => {
        const ev = payload.eventType;
        if (ev === 'DELETE') {
          const oldId = payload.old?.id;
          if (!oldId) return;
          set(state => {
            const next = { ...state.auctions };
            delete next[oldId];
            return { auctions: next };
          });
          return;
        }
        const row = payload.new;
        if (!row) return;

        // Подгружаем профили
        let creator = get().auctions[row.id]?.creator;
        if (!creator) {
          const { data: u } = await supabase.from('users').select('id, display_name, avatar_url').eq('id', row.creator_id).single();
          creator = u as any;
        }
        let winner = undefined;
        if (row.winner_id) {
          const { data: u } = await supabase.from('users').select('id, display_name, avatar_url').eq('id', row.winner_id).single();
          winner = u as any;
        }
        const next: Auction = { ...row, creator, winner: winner || null };
        set(state => ({ auctions: { ...state.auctions, [row.id]: next } }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_bids' }, (payload: any) => {
        // Если изменилась моя ставка — обновим
        const row = payload.new || payload.old;
        if (!row || row.user_id !== myUserId) return;
        if (payload.eventType === 'DELETE') {
          set(state => {
            const next = { ...state.myBids };
            delete next[row.auction_id];
            return { myBids: next };
          });
          return;
        }
        const fresh: AuctionBid = payload.new;
        set(state => ({ myBids: { ...state.myBids, [fresh.auction_id]: fresh } }));
      })
      .subscribe();
  },

  unsubscribeRealtime: () => {
    if (!realtimeChannel) return;
    try { supabase.removeChannel(realtimeChannel); } catch {}
    realtimeChannel = null;
  },
}));
