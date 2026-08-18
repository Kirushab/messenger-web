import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface VocabPair { term: string; tr: string; }
export interface VocabSet {
  id: string;
  owner_id: string;
  title: string;
  emoji: string;
  language: string;
  pairs: VocabPair[];
  is_public: boolean;
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

function normalize(row: any): VocabSet {
  return {
    id: row.id,
    owner_id: row.owner_id,
    title: row.title || '',
    emoji: row.emoji || 'folder',
    language: row.language || 'en',
    pairs: Array.isArray(row.pairs) ? row.pairs : [],
    is_public: !!row.is_public,
    source_id: row.source_id ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

interface State {
  mine: VocabSet[];
  community: VocabSet[];
  loadingMine: boolean;
  loadingCommunity: boolean;
  errorMine: boolean;
  loadMine: () => Promise<void>;
  loadCommunity: () => Promise<void>;
  getSet: (id: string) => Promise<VocabSet | null>;
  createSet: (data: Partial<VocabSet>) => Promise<VocabSet | null>;
  updateSet: (id: string, data: Partial<VocabSet>) => Promise<void>;
  deleteSet: (id: string) => Promise<void>;
  copySet: (set: VocabSet) => Promise<VocabSet | null>;
}

export const useVocabSetsStore = create<State>((set, get) => ({
  mine: [],
  community: [],
  loadingMine: false,
  loadingCommunity: false,
  errorMine: false,

  loadMine: async () => {
    set({ loadingMine: true, errorMine: false });
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) { set({ loadingMine: false, errorMine: true }); return; }
    const { data, error } = await supabase
      .from('vocab_sets')
      .select('*')
      .eq('owner_id', uid)
      .order('updated_at', { ascending: false });
    if (error) { set({ loadingMine: false, errorMine: true }); return; }
    set({ mine: ((data || []) as any[]).map(normalize), loadingMine: false });
  },

  loadCommunity: async () => {
    set({ loadingCommunity: true });
    const { data, error } = await supabase
      .from('vocab_sets')
      .select('*')
      .eq('is_public', true)
      .order('updated_at', { ascending: false })
      .limit(100);
    if (error) { set({ loadingCommunity: false }); return; }
    set({ community: ((data || []) as any[]).map(normalize), loadingCommunity: false });
  },

  getSet: async (id) => {
    const { data, error } = await supabase.from('vocab_sets').select('*').eq('id', id).maybeSingle();
    if (error || !data) return null;
    return normalize(data);
  },

  createSet: async (data) => {
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return null;
    const { data: row, error } = await supabase.from('vocab_sets').insert({
      owner_id: uid,
      title: data.title || 'Без названия',
      emoji: data.emoji || 'folder',
      language: data.language || 'en',
      pairs: data.pairs || [],
      is_public: data.is_public ?? false,
      source_id: data.source_id ?? null,
    }).select('*').single();
    if (error || !row) return null;
    const s = normalize(row);
    set(st => ({ mine: [s, ...st.mine] }));
    return s;
  },

  updateSet: async (id, data) => {
    const patch: any = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.emoji !== undefined) patch.emoji = data.emoji;
    if (data.language !== undefined) patch.language = data.language;
    if (data.pairs !== undefined) patch.pairs = data.pairs;
    if (data.is_public !== undefined) patch.is_public = data.is_public;
    const { error } = await supabase.from('vocab_sets').update(patch).eq('id', id);
    if (error) return;
    set(st => ({ mine: st.mine.map(x => x.id === id ? { ...x, ...data } as VocabSet : x) }));
  },

  deleteSet: async (id) => {
    const { error } = await supabase.from('vocab_sets').delete().eq('id', id);
    if (error) return;
    set(st => ({ mine: st.mine.filter(x => x.id !== id) }));
  },

  copySet: async (src) => {
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return null;
    const { data: row, error } = await supabase.from('vocab_sets').insert({
      owner_id: uid,
      title: src.title + ' (копия)',
      emoji: src.emoji,
      language: src.language,
      pairs: src.pairs,
      is_public: false,
      source_id: src.id,
    }).select('*').single();
    if (error || !row) return null;
    const s = normalize(row);
    set(st => ({ mine: [s, ...st.mine] }));
    return s;
  },
}));
