import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface ActiveCall {
  conversation_id: string;
  room_id: string;
  call_type: 'audio' | 'video';
  started_by: string;
  started_at: string;
  participant_ids: string[];
}

interface RawRow {
  conversation_id: string;
  user_id: string;
  room_id: string;
  call_type: 'audio' | 'video';
  joined_at: string;
  last_seen: string;
}

const FRESH_MS = 60000; // участник «живой», если heartbeat был <60с назад

function aggregate(rows: RawRow[]): Record<string, ActiveCall> {
  const now = Date.now();
  const byConv: Record<string, RawRow[]> = {};
  for (const r of rows) {
    if (now - new Date(r.last_seen).getTime() > FRESH_MS) continue; // протухший — игнор
    (byConv[r.conversation_id] ||= []).push(r);
  }
  const map: Record<string, ActiveCall> = {};
  for (const [conv, list] of Object.entries(byConv)) {
    if (list.length === 0) continue;
    const sorted = [...list].sort((a, b) => a.joined_at.localeCompare(b.joined_at));
    const first = sorted[0];
    map[conv] = {
      conversation_id: conv,
      room_id: first.room_id,
      call_type: first.call_type,
      started_by: first.user_id,
      started_at: first.joined_at,
      participant_ids: sorted.map(r => r.user_id),
    };
  }
  return map;
}

interface State {
  calls: Record<string, ActiveCall>;
  rawRows: RawRow[];
  channel: any;
  poll: any;
  load: () => Promise<void>;
  recompute: () => void;
  subscribe: () => void;
  unsubscribe: () => void;
}

export const useActiveCallsStore = create<State>((set, get) => ({
  calls: {},
  rawRows: [],
  channel: null,
  poll: null,

  load: async () => {
    const { data, error } = await supabase.from('active_call_participants').select('*');
    if (error) return;
    const rows = (data || []) as RawRow[];
    set({ rawRows: rows, calls: aggregate(rows) });
  },

  // Пересчёт по свежести без сети — чтобы индикаторы гасли, даже если протухшие
  // строки ещё физически не удалены (никто не слал heartbeat для их чистки).
  recompute: () => set({ calls: aggregate(get().rawRows) }),

  subscribe: () => {
    if (get().channel) return;
    get().load();
    const channel = supabase
      .channel('active_calls_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_call_participants' }, () => {
        get().load();
      })
      .subscribe();
    // периодически: пересчёт свежести локально; сетевой load — редкий fallback
    // (realtime-канал выше и так дёргает load при изменениях)
    let tick = 0;
    const poll = setInterval(() => { get().recompute(); if (++tick % 6 === 0) get().load(); }, 20000);
    set({ channel, poll });
  },

  unsubscribe: () => {
    const { channel, poll } = get();
    if (channel) { try { supabase.removeChannel(channel); } catch { /* noop */ } }
    if (poll) clearInterval(poll);
    set({ channel: null, poll: null });
  },
}));
