import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export type GrammarKind =
  | 'conjugation' | 'article' | 'past'
  | 'modal' | 'plural' | 'adjective' | 'preposition' | 'possessive'
  | 'imperfetto' | 'futuro' | 'condizionale' | 'reflexive' | 'pronoun' | 'comparative'
  | 'congiuntivo' | 'imperativo' | 'cine'
  | 'participle' | 'relative';

export interface GrammarItem {
  id: string;
  language: string;
  kind: GrammarKind;
  level: string;
  topic: string;          // глагол (parlare) или группа артиклей (definite/indefinite)
  order_index: number;
  prompt: string;         // "io (parlare)" или "___ casa"
  prompt_ru: string | null;
  answer: string;         // "parlo" / "la"
  options: string[] | null; // если null — UI строит варианты из той же topic-группы
  explain_ru: string | null;
}

interface GrammarProgressRow { best_correct: number; best_total: number; attempts: number; }

export interface GrammarLeaderRow {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  mastered: number;
  total_correct: number;
}

interface GrammarState {
  items: GrammarItem[];
  loading: boolean;
  progress: Record<string, GrammarProgressRow>; // ключ = kind
  leaderboard: GrammarLeaderRow[];
  availableKinds: string[];
  loadGrammar: (language: string, kind: GrammarKind) => Promise<GrammarItem[]>;
  loadGrammarProgress: (language: string) => Promise<void>;
  saveGrammarResult: (language: string, kind: GrammarKind, correct: number, total: number) => Promise<void>;
  loadGrammarLeaderboard: (language: string) => Promise<void>;
  loadGrammarKinds: (language: string) => Promise<void>;
}

export const useGrammarStore = create<GrammarState>((set, get) => ({
  items: [],
  loading: false,
  progress: {},
  leaderboard: [],
  availableKinds: [],
  loadGrammar: async (language, kind) => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('grammar_items')
      .select('*')
      .eq('language', language)
      .eq('kind', kind)
      .order('topic')
      .order('order_index');
    set({ loading: false });
    if (error) { console.error('loadGrammar error:', error); return []; }
    const items = (data || []) as GrammarItem[];
    set({ items });
    return items;
  },
  loadGrammarProgress: async (language) => {
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return;
    const { data, error } = await supabase
      .from('grammar_progress')
      .select('kind, best_correct, best_total, attempts')
      .eq('user_id', uid)
      .eq('language', language);
    if (error) { console.error('loadGrammarProgress error:', error); return; }
    const map: Record<string, GrammarProgressRow> = {};
    for (const r of (data || []) as any[]) {
      map[r.kind] = { best_correct: r.best_correct, best_total: r.best_total, attempts: r.attempts };
    }
    set({ progress: map });
  },
  saveGrammarResult: async (language, kind, correct, total) => {
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid || total <= 0) return;
    const prev = get().progress[kind];
    const prevAcc = prev && prev.best_total > 0 ? prev.best_correct / prev.best_total : -1;
    const newAcc = correct / total;
    const keepBest = newAcc >= prevAcc;
    const row: GrammarProgressRow = {
      best_correct: keepBest ? correct : (prev?.best_correct ?? 0),
      best_total: keepBest ? total : (prev?.best_total ?? 0),
      attempts: (prev?.attempts ?? 0) + 1,
    };
    set({ progress: { ...get().progress, [kind]: row } });
    const { error } = await supabase.from('grammar_progress').upsert({
      user_id: uid, language, kind,
      best_correct: row.best_correct, best_total: row.best_total,
      attempts: row.attempts, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,language,kind' });
    if (error) console.error('saveGrammarResult error:', error);
  },
  loadGrammarLeaderboard: async (language) => {
    const { data, error } = await supabase.rpc('grammar_leaderboard', { p_language: language });
    if (error) { console.error('loadGrammarLeaderboard error:', error); set({ leaderboard: [] }); return; }
    set({ leaderboard: (data || []) as GrammarLeaderRow[] });
  },
  loadGrammarKinds: async (language) => {
    const { data, error } = await supabase.from('grammar_items').select('kind').eq('language', language);
    if (error) { console.error('loadGrammarKinds error:', error); set({ availableKinds: [] }); return; }
    const kinds = Array.from(new Set((data || []).map((r: any) => r.kind)));
    set({ availableKinds: kinds });
  },
}));
