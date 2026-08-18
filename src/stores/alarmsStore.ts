import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface SharedAlarm {
  id: string;
  created_by: string;
  event_id: string | null;
  title: string;
  ring_at: string;
  participant_ids: string[];
  active: boolean;
  created_at: string;
}

interface State {
  alarms: SharedAlarm[];
  load: () => Promise<void>;
  create: (a: { created_by: string; title: string; ring_at: string; participant_ids: string[]; event_id?: string | null }) => Promise<{ error: string | null }>;
  remove: (id: string) => Promise<{ error: string | null }>;
}

export const useAlarmsStore = create<State>((set, get) => ({
  alarms: [],

  load: async () => {
    const { data, error } = await supabase
      .from('shared_alarms')
      .select('*')
      .eq('active', true)
      .order('ring_at', { ascending: true });
    if (error) return;
    set({ alarms: (data || []) as SharedAlarm[] });
  },

  create: async (a) => {
    const { data, error } = await supabase
      .from('shared_alarms')
      .insert({
        created_by: a.created_by,
        event_id: a.event_id ?? null,
        title: a.title || 'Будильник',
        ring_at: a.ring_at,
        participant_ids: a.participant_ids,
      })
      .select()
      .single();
    if (error) return { error: error.message };
    if (data) set({ alarms: [...get().alarms, data as SharedAlarm].sort((x, y) => x.ring_at.localeCompare(y.ring_at)) });
    return { error: null };
  },

  remove: async (id) => {
    const { error } = await supabase.from('shared_alarms').delete().eq('id', id);
    if (error) return { error: error.message };
    set({ alarms: get().alarms.filter(a => a.id !== id) });
    return { error: null };
  },
}));
