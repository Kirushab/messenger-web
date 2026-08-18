import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export type NotesLevel = 'treble' | 'bass' | 'both' | 'advanced';

export interface NotesProgress {
  user_id: string;
  total_correct: number;
  total_attempts: number;
  best_streak: number;
  sessions_played: number;
  coins_earned_total: number;
  coins_earned_today: number;
  last_play_date: string;
  best_treble_score: number;
  best_bass_score: number;
  best_both_score: number;
  best_advanced_score: number;
}

export interface NotesSession {
  id: string;
  level: NotesLevel;
  total_questions: number;
  correct_count: number;
  duration_seconds: number;
  coins_earned: number;
  created_at: string;
}

export interface NotesLeaderboardEntry {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  best_streak: number;
  sessions_played: number;
  total_correct: number;
  best_both_score: number;
  best_advanced_score: number;
}

interface NotesState {
  progress: NotesProgress | null;
  history: NotesSession[];
  leaderboard: NotesLeaderboardEntry[];

  loadProgress: () => Promise<void>;
  loadHistory: () => Promise<void>;
  loadLeaderboard: () => Promise<void>;
  loadError: boolean;
  finishSession: (level: NotesLevel, total: number, correct: number, durationSec: number)
    => Promise<{ coinsEarned: number; newBest: boolean; dailyRemaining: number; error: string | null }>;
}

export const useNotesStore = create<NotesState>((set) => ({
  progress: null,
  history: [],
  leaderboard: [],

  loadError: false,

  loadProgress: async () => {
    set({ loadError: false });
    const { data, error } = await supabase.rpc('notes_get_my_progress');
    if (error) { console.error('loadProgress', error); set({ loadError: true }); return; }
    set({ progress: data });
  },

  loadHistory: async () => {
    const { data, error } = await supabase.rpc('notes_get_my_sessions', { limit_param: 20 });
    if (error) { console.error('loadHistory', error); set({ loadError: true }); return; }
    set({ history: (data as NotesSession[]) ?? [] });
  },

  loadLeaderboard: async () => {
    const { data, error } = await supabase.rpc('notes_get_leaderboard');
    if (error) { console.error('loadLeaderboard', error); set({ loadError: true }); return; }
    set({ leaderboard: (data as NotesLeaderboardEntry[]) ?? [] });
  },

  finishSession: async (level, total, correct, durationSec) => {
    const { data, error } = await supabase.rpc('notes_finish_session', {
      level_param: level,
      total_questions_param: total,
      correct_count_param: correct,
      duration_seconds_param: durationSec,
    });
    if (error) {
      return { coinsEarned: 0, newBest: false, dailyRemaining: 0, error: error.message };
    }
    const result = data as any;
    return {
      coinsEarned: result.coins_earned ?? 0,
      newBest: result.new_best ?? false,
      dailyRemaining: result.daily_remaining ?? 0,
      error: null,
    };
  },
}));
