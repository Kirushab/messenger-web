import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { User } from '@/types';

export interface TodCategoryRow {
  id: string;
  owner_id: string;
  title: string;
  emoji: string;
  rating: 'mild' | 'spicy';
  truths: string[];
  dares: string[];
  is_public: boolean;
  source_id: string | null;
  created_at: string;
  updated_at: string;
  owner?: Pick<User, 'id' | 'display_name' | 'avatar_url'>;
}

/**
 * Разбирает текст массового ввода в массив подсказок — ПО СТРОКАМ
 * (одна подсказка на строку), т.к. фразы могут содержать запятые.
 * Тримминг, удаление пустых и дублей (без учёта регистра).
 */
export function parseLines(text: string): string[] {
  const raw = (text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of raw) {
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

const SELECT_COLS = `
  id, owner_id, title, emoji, rating, truths, dares, is_public, source_id, created_at, updated_at,
  owner:users (id, display_name, avatar_url)
`;

interface TodCategoriesState {
  mine: TodCategoryRow[];
  community: TodCategoryRow[];
  loadingMine: boolean;
  loadingCommunity: boolean;
  error: string | null;

  loadMine: (ownerId: string) => Promise<void>;
  loadCommunity: () => Promise<void>;
  createCategory: (data: {
    owner_id: string;
    title: string;
    emoji: string;
    rating?: 'mild' | 'spicy';
    truths: string[];
    dares: string[];
    is_public?: boolean;
    source_id?: string | null;
  }) => Promise<{ id: string | null; error: string | null }>;
  updateCategory: (
    id: string,
    patch: Partial<Pick<TodCategoryRow, 'title' | 'emoji' | 'rating' | 'truths' | 'dares' | 'is_public'>>,
  ) => Promise<{ error: string | null }>;
  deleteCategory: (id: string) => Promise<{ error: string | null }>;
  addFromCommunity: (cat: TodCategoryRow, ownerId: string) => Promise<{ id: string | null; error: string | null }>;
  getById: (id: string) => TodCategoryRow | undefined;
  realtimeChannel: any;
  subscribeRealtime: (ownerId?: string) => void;
  unsubscribeRealtime: () => void;
}

export const useTodCategoriesStore = create<TodCategoriesState>((set, get) => ({
  mine: [],
  community: [],
  loadingMine: false,
  loadingCommunity: false,
  error: null,

  loadMine: async (ownerId) => {
    set({ loadingMine: true, error: null });
    const { data, error } = await supabase
      .from('tod_categories')
      .select(SELECT_COLS)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });
    if (error) { set({ loadingMine: false, error: error.message }); return; }
    set({ mine: (data || []) as any as TodCategoryRow[], loadingMine: false });
  },

  loadCommunity: async () => {
    set({ loadingCommunity: true, error: null });
    const { data, error } = await supabase
      .from('tod_categories')
      .select(SELECT_COLS)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) { set({ loadingCommunity: false, error: error.message }); return; }
    set({ community: (data || []) as any as TodCategoryRow[], loadingCommunity: false });
  },

  createCategory: async ({ owner_id, title, emoji, rating, truths, dares, is_public, source_id }) => {
    const t = title.trim();
    if (!t) return { id: null, error: 'Введите название категории' };
    if (!truths.length && !dares.length) return { id: null, error: 'Добавьте хотя бы одну правду или действие' };
    const { data, error } = await supabase
      .from('tod_categories')
      .insert({
        owner_id,
        title: t,
        emoji: emoji || 'dice',
        rating: rating === 'spicy' ? 'spicy' : 'mild',
        truths,
        dares,
        is_public: !!is_public,
        source_id: source_id || null,
      })
      .select(SELECT_COLS)
      .single();
    if (error) return { id: null, error: error.message };
    set(state => ({ mine: [data as any as TodCategoryRow, ...state.mine] }));
    return { id: (data as any).id, error: null };
  },

  updateCategory: async (id, patch) => {
    const clean: any = { ...patch };
    if (typeof clean.title === 'string') clean.title = clean.title.trim();
    set(state => ({ mine: state.mine.map(c => c.id === id ? { ...c, ...clean } : c) }));
    const { error } = await supabase.from('tod_categories').update(clean).eq('id', id);
    if (error) return { error: error.message };
    return { error: null };
  },

  deleteCategory: async (id) => {
    set(state => ({ mine: state.mine.filter(c => c.id !== id) }));
    const { error } = await supabase.from('tod_categories').delete().eq('id', id);
    if (error) return { error: error.message };
    return { error: null };
  },

  addFromCommunity: async (cat, ownerId) => {
    return get().createCategory({
      owner_id: ownerId,
      title: cat.title,
      emoji: cat.emoji,
      rating: cat.rating,
      truths: cat.truths,
      dares: cat.dares,
      is_public: false,
      source_id: cat.id,
    });
  },

  getById: (id) => get().mine.find(c => c.id === id) || get().community.find(c => c.id === id),

  realtimeChannel: null,
  subscribeRealtime: (ownerId) => {
    if (get().realtimeChannel) return;
    const ch = supabase
      .channel('tod_categories_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tod_categories' }, () => {
        if (ownerId) get().loadMine(ownerId);
        get().loadCommunity();
      })
      .subscribe();
    set({ realtimeChannel: ch });
  },
  unsubscribeRealtime: () => {
    const ch = get().realtimeChannel;
    if (ch) { supabase.removeChannel(ch); set({ realtimeChannel: null }); }
  },
}));
