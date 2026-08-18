import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { User } from '@/types';

export interface AliasCategory {
  id: string;
  owner_id: string;
  title: string;
  emoji: string;
  words: string[];
  is_public: boolean;
  source_id: string | null;
  created_at: string;
  updated_at: string;
  owner?: Pick<User, 'id' | 'display_name' | 'avatar_url'>;
}

/**
 * Разбирает текст массового ввода в массив слов.
 * Разделители: перенос строки, запятая, точка с запятой, вертикальная черта.
 * Тримминг, удаление пустых и дублей (без учёта регистра, первое написание выигрывает).
 * Пример: "Феррари; Ягуар; Мерседес" → ['Феррари','Ягуар','Мерседес'].
 */
export function parseWords(text: string): string[] {
  const raw = (text || '').split(/[\n,;|]+/).map(w => w.trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of raw) {
    const key = w.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
  }
  return out;
}

const SELECT_COLS = `
  id, owner_id, title, emoji, words, is_public, source_id, created_at, updated_at,
  owner:users (id, display_name, avatar_url)
`;

interface AliasCategoriesState {
  mine: AliasCategory[];
  community: AliasCategory[];
  loadingMine: boolean;
  loadingCommunity: boolean;
  error: string | null;

  loadMine: (ownerId: string) => Promise<void>;
  loadCommunity: () => Promise<void>;
  createCategory: (data: {
    owner_id: string;
    title: string;
    emoji: string;
    words: string[];
    is_public?: boolean;
    source_id?: string | null;
  }) => Promise<{ id: string | null; error: string | null }>;
  updateCategory: (
    id: string,
    patch: Partial<Pick<AliasCategory, 'title' | 'emoji' | 'words' | 'is_public'>>,
  ) => Promise<{ error: string | null }>;
  deleteCategory: (id: string) => Promise<{ error: string | null }>;
  togglePublish: (id: string, isPublic: boolean) => Promise<{ error: string | null }>;
  addFromCommunity: (cat: AliasCategory, ownerId: string) => Promise<{ id: string | null; error: string | null }>;
  getById: (id: string) => AliasCategory | undefined;
}

export const useAliasCategoriesStore = create<AliasCategoriesState>((set, get) => ({
  mine: [],
  community: [],
  loadingMine: false,
  loadingCommunity: false,
  error: null,

  loadMine: async (ownerId) => {
    set({ loadingMine: true, error: null });
    const { data, error } = await supabase
      .from('alias_categories')
      .select(SELECT_COLS)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });
    if (error) { set({ loadingMine: false, error: error.message }); return; }
    set({ mine: (data || []) as any as AliasCategory[], loadingMine: false });
  },

  loadCommunity: async () => {
    set({ loadingCommunity: true, error: null });
    const { data, error } = await supabase
      .from('alias_categories')
      .select(SELECT_COLS)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) { set({ loadingCommunity: false, error: error.message }); return; }
    set({ community: (data || []) as any as AliasCategory[], loadingCommunity: false });
  },

  createCategory: async ({ owner_id, title, emoji, words, is_public, source_id }) => {
    const t = title.trim();
    if (!t) return { id: null, error: 'Введите название категории' };
    if (!words.length) return { id: null, error: 'Добавьте хотя бы одно слово' };
    const { data, error } = await supabase
      .from('alias_categories')
      .insert({
        owner_id,
        title: t,
        emoji: emoji || 'archive',
        words,
        is_public: !!is_public,
        source_id: source_id || null,
      })
      .select(SELECT_COLS)
      .single();
    if (error) return { id: null, error: error.message };
    set(state => ({ mine: [data as any as AliasCategory, ...state.mine] }));
    return { id: (data as any).id, error: null };
  },

  updateCategory: async (id, patch) => {
    const clean: any = { ...patch };
    if (typeof clean.title === 'string') clean.title = clean.title.trim();
    set(state => ({
      mine: state.mine.map(c => c.id === id ? { ...c, ...clean } : c),
    }));
    const { error } = await supabase.from('alias_categories').update(clean).eq('id', id);
    if (error) return { error: error.message };
    return { error: null };
  },

  deleteCategory: async (id) => {
    set(state => ({ mine: state.mine.filter(c => c.id !== id) }));
    const { error } = await supabase.from('alias_categories').delete().eq('id', id);
    if (error) return { error: error.message };
    return { error: null };
  },

  togglePublish: async (id, isPublic) => {
    set(state => ({ mine: state.mine.map(c => c.id === id ? { ...c, is_public: isPublic } : c) }));
    const { error } = await supabase.from('alias_categories').update({ is_public: isPublic }).eq('id', id);
    if (error) return { error: error.message };
    return { error: null };
  },

  addFromCommunity: async (cat, ownerId) => {
    return get().createCategory({
      owner_id: ownerId,
      title: cat.title,
      emoji: cat.emoji,
      words: cat.words,
      is_public: false,
      source_id: cat.id,
    });
  },

  getById: (id) => get().mine.find(c => c.id === id) || get().community.find(c => c.id === id),
}));
