import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { User } from '@/types';

export interface Expense {
  id: string;
  event_id: string;
  payer_id: string;
  title: string;
  amount: number;
  currency: string;
  category: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  payer?: Pick<User, 'id' | 'display_name' | 'avatar_url'>;
  shares?: ExpenseShare[];
}

export interface ExpenseShare {
  expense_id: string;
  user_id: string;
  share: number;
  user?: Pick<User, 'id' | 'display_name' | 'avatar_url'>;
}

export interface Settlement {
  id: string;
  event_id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  currency: string;
  note: string | null;
  settled_at: string;
  created_at: string;
  from_user?: Pick<User, 'id' | 'display_name' | 'avatar_url'>;
  to_user?: Pick<User, 'id' | 'display_name' | 'avatar_url'>;
}

export interface UserBalance {
  user_id: string;
  user?: Pick<User, 'id' | 'display_name' | 'avatar_url'>;
  paid: number;          // заплатил всего
  owes: number;          // должен всего (sum его shares)
  paid_settlements: number;     // отдал в settlements
  received_settlements: number; // получил в settlements
  net: number;           // итог: + значит ему должны, - значит он должен
}

export interface SuggestedTransfer {
  from_user_id: string;
  to_user_id: string;
  amount: number;
}

interface ExpensesState {
  expensesByEvent: Record<string, Expense[]>;
  settlementsByEvent: Record<string, Settlement[]>;
  loading: boolean;

  loadExpenses: (eventId: string) => Promise<void>;
  createExpense: (
    eventId: string,
    title: string,
    amount: number,
    currency: string,
    shares: Array<{ user_id: string; share: number }>,
    paid_at?: string,
    category?: string,
  ) => Promise<{ ok: boolean; error: string | null }>;
  deleteExpense: (expenseId: string, eventId: string) => Promise<{ error: string | null }>;
  createSettlement: (
    eventId: string,
    toUserId: string,
    amount: number,
    currency?: string,
    note?: string,
  ) => Promise<{ ok: boolean; error: string | null }>;
  computeBalances: (eventId: string, members: Array<Pick<User, 'id' | 'display_name' | 'avatar_url'>>) => UserBalance[];
  suggestTransfers: (balances: UserBalance[]) => SuggestedTransfer[];
}

export const useExpensesStore = create<ExpensesState>((set, get) => ({
  expensesByEvent: {},
  settlementsByEvent: {},
  loading: false,

  loadExpenses: async (eventId) => {
    set({ loading: true });
    const [{ data: expenses }, { data: settlements }] = await Promise.all([
      supabase
        .from('event_expenses')
        .select(`
          *,
          payer:users!event_expenses_payer_id_fkey (id, display_name, avatar_url),
          shares:event_expense_shares (
            expense_id, user_id, share,
            user:users (id, display_name, avatar_url)
          )
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false }),
      supabase
        .from('event_settlements')
        .select(`
          *,
          from_user:users!event_settlements_from_user_id_fkey (id, display_name, avatar_url),
          to_user:users!event_settlements_to_user_id_fkey (id, display_name, avatar_url)
        `)
        .eq('event_id', eventId)
        .order('settled_at', { ascending: false }),
    ]);

    set(state => ({
      expensesByEvent: { ...state.expensesByEvent, [eventId]: (expenses || []) as any },
      settlementsByEvent: { ...state.settlementsByEvent, [eventId]: (settlements || []) as any },
      loading: false,
    }));
  },

  createExpense: async (eventId, title, amount, currency, shares, paid_at, category) => {
    const { data: rpc, error } = await supabase.rpc('create_event_expense', {
      event_id_param: eventId,
      title_param: title,
      amount_param: amount,
      currency_param: currency,
      shares_param: shares,
      paid_at_param: paid_at || null,
    });
    if (error) {
      let msg = error.message;
      if (msg.includes('Not a member')) msg = 'Вы не участник события';
      if (msg.includes('Sum of shares')) msg = 'Сумма распределения не равна сумме траты';
      return { ok: false, error: msg };
    }
    // Если категория задана — обновим только что созданный expense
    if (category && rpc) {
      const expenseId = typeof rpc === 'string' ? rpc : (rpc as any)?.expense_id || (rpc as any)?.id;
      if (expenseId) {
        await supabase.from('event_expenses').update({ category }).eq('id', expenseId);
      } else {
        // Фолбэк — обновим самый свежий expense этого юзера
        const { data: user } = await supabase.auth.getUser();
        if (user.user?.id) {
          await supabase.from('event_expenses')
            .update({ category })
            .eq('event_id', eventId)
            .eq('payer_id', user.user.id)
            .eq('title', title)
            .order('created_at', { ascending: false })
            .limit(1);
        }
      }
    }
    // Перезагружаем
    await get().loadExpenses(eventId);
    return { ok: true, error: null };
  },

  deleteExpense: async (expenseId, eventId) => {
    const { error } = await supabase.from('event_expenses').delete().eq('id', expenseId);
    if (error) return { error: error.message };
    await get().loadExpenses(eventId);
    return { error: null };
  },

  createSettlement: async (eventId, toUserId, amount, currency = 'RUB', note) => {
    const { error } = await supabase.rpc('create_event_settlement', {
      event_id_param: eventId,
      to_user_id_param: toUserId,
      amount_param: amount,
      currency_param: currency,
      note_param: note || null,
    });
    if (error) return { ok: false, error: error.message };
    await get().loadExpenses(eventId);
    return { ok: true, error: null };
  },

  computeBalances: (eventId, members) => {
    const expenses = get().expensesByEvent[eventId] || [];
    const settlements = get().settlementsByEvent[eventId] || [];

    const map = new Map<string, UserBalance>();
    for (const m of members) {
      map.set(m.id, {
        user_id: m.id, user: m,
        paid: 0, owes: 0, paid_settlements: 0, received_settlements: 0, net: 0,
      });
    }

    for (const ex of expenses) {
      const payer = map.get(ex.payer_id);
      if (payer) payer.paid += Number(ex.amount);
      for (const sh of ex.shares || []) {
        const u = map.get(sh.user_id);
        if (u) u.owes += Number(sh.share);
      }
    }

    for (const s of settlements) {
      const from = map.get(s.from_user_id);
      const to = map.get(s.to_user_id);
      if (from) from.paid_settlements += Number(s.amount);
      if (to) to.received_settlements += Number(s.amount);
    }

    for (const b of map.values()) {
      b.net = b.paid - b.owes - b.paid_settlements + b.received_settlements;
      // Округление до копеек
      b.net = Math.round(b.net * 100) / 100;
    }

    return Array.from(map.values()).sort((a, b) => b.net - a.net);
  },

  suggestTransfers: (balances) => {
    // Минимизация переводов: топ-кредитор и топ-должник встречаются
    const creditors = balances.filter(b => b.net > 0.01).map(b => ({ ...b }));
    const debtors = balances.filter(b => b.net < -0.01).map(b => ({ ...b }));
    const transfers: SuggestedTransfer[] = [];

    creditors.sort((a, b) => b.net - a.net);
    debtors.sort((a, b) => a.net - b.net);  // самый большой долг (отрицательное число) первым

    let i = 0, j = 0;
    while (i < creditors.length && j < debtors.length) {
      const cred = creditors[i];
      const deb = debtors[j];
      const amount = Math.min(cred.net, -deb.net);
      const rounded = Math.round(amount * 100) / 100;
      if (rounded > 0.01) {
        transfers.push({
          from_user_id: deb.user_id,
          to_user_id: cred.user_id,
          amount: rounded,
        });
      }
      cred.net -= amount;
      deb.net += amount;
      if (cred.net < 0.01) i++;
      if (deb.net > -0.01) j++;
    }

    return transfers;
  },
}));
