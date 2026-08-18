import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export const CANVAS_SIZE = 128;
export const COOLDOWN_MS = 30_000;

// pico-8 палитра — 16 индексов
export const PALETTE: string[] = [
  '#000000', // 0  black
  '#1D2B53', // 1  dark blue
  '#7E2553', // 2  dark purple
  '#008751', // 3  dark green
  '#AB5236', // 4  brown
  '#5F574F', // 5  dark grey
  '#C2C3C7', // 6  light grey
  '#FFF1E8', // 7  white
  '#FF004D', // 8  red
  '#FFA300', // 9  orange
  '#FFEC27', // 10 yellow
  '#00E436', // 11 green
  '#29ADFF', // 12 blue
  '#83769C', // 13 indigo
  '#FF77A8', // 14 pink
  '#FFCCAA', // 15 peach
];

export interface PixelRound {
  id: string;
  started_at: string;
  ended_at: string | null;
}

interface PixelState {
  round: PixelRound | null;
  // 128*128 = 16384 байта; -1 = пусто, 0..15 = индекс цвета. Uint8Array быстрее, но используем Int8 чтобы хранить -1.
  pixels: Int8Array;
  loading: boolean;
  error: string | null;
  realtimeChannel: any;

  // cooldown — timestamp последней ставки на клиенте (быстрый UX)
  lastPlacedAt: number;

  loadCanvas: () => Promise<void>;
  placePixel: (userId: string, x: number, y: number, color: number) => Promise<{ error: string | null }>;
  subscribeRealtime: () => void;
  unsubscribeRealtime: () => void;
}

const COOLDOWN_KEY = 'pixel_last_placed_at';

export const usePixelStore = create<PixelState>((set, get) => ({
  round: null,
  pixels: new Int8Array(CANVAS_SIZE * CANVAS_SIZE).fill(-1),
  loading: false,
  error: null,
  realtimeChannel: null,
  lastPlacedAt: Number(localStorage.getItem(COOLDOWN_KEY) || '0'),

  loadCanvas: async () => {
    set({ loading: true, error: null });

    // Получаем активный раунд
    const { data: roundData, error: rErr } = await supabase
      .from('pixel_rounds')
      .select('id, started_at, ended_at')
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (rErr || !roundData) {
      set({ loading: false, error: rErr?.message || 'Нет активного раунда. Запусти миграцию 016.' });
      return;
    }
    const round = roundData as PixelRound;

    // Грузим все пиксели раунда одним запросом
    const { data: pixelsData, error: pErr } = await supabase
      .from('pixel_canvas')
      .select('x, y, color')
      .eq('round_id', round.id);

    if (pErr) {
      set({ loading: false, error: pErr.message, round });
      return;
    }

    const buf = new Int8Array(CANVAS_SIZE * CANVAS_SIZE).fill(-1);
    for (const p of pixelsData || []) {
      const idx = p.y * CANVAS_SIZE + p.x;
      buf[idx] = p.color;
    }

    set({ round, pixels: buf, loading: false });
  },

  placePixel: async (userId, x, y, color) => {
    const state = get();
    if (!state.round) return { error: 'Раунд не загружен' };
    if (x < 0 || x >= CANVAS_SIZE || y < 0 || y >= CANVAS_SIZE) return { error: 'Координаты вне холста' };
    if (color < 0 || color >= PALETTE.length) return { error: 'Неверный цвет' };

    const since = Date.now() - state.lastPlacedAt;
    if (since < COOLDOWN_MS) {
      const left = Math.ceil((COOLDOWN_MS - since) / 1000);
      return { error: `Подожди ещё ${left} сек` };
    }

    // Оптимистично рисуем
    const newPixels = new Int8Array(state.pixels);
    newPixels[y * CANVAS_SIZE + x] = color;
    const now = Date.now();
    set({ pixels: newPixels, lastPlacedAt: now });
    localStorage.setItem(COOLDOWN_KEY, String(now));

    const { error } = await supabase
      .from('pixel_canvas')
      .upsert({
        round_id: state.round.id,
        x, y, color,
        user_id: userId,
        placed_at: new Date().toISOString(),
      }, { onConflict: 'round_id,x,y' });

    if (error) {
      // Откатываем cooldown если не удалось
      set({ lastPlacedAt: state.lastPlacedAt });
      localStorage.setItem(COOLDOWN_KEY, String(state.lastPlacedAt));
      return { error: error.message };
    }

    return { error: null };
  },

  subscribeRealtime: () => {
    if (get().realtimeChannel) return;
    const ch = supabase
      .channel('pixel_canvas_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pixel_canvas' }, (payload: any) => {
        const ev = payload.eventType;
        if (ev === 'DELETE') return; // не обрабатываем — раунды обнуляются через DROP CASCADE

        const row = payload.new;
        if (!row) return;

        const state = get();
        if (!state.round || row.round_id !== state.round.id) return;

        const idx = row.y * CANVAS_SIZE + row.x;
        if (state.pixels[idx] === row.color) return; // ничего не изменилось

        const newPixels = new Int8Array(state.pixels);
        newPixels[idx] = row.color;
        set({ pixels: newPixels });
      })
      .subscribe();

    set({ realtimeChannel: ch });
  },

  unsubscribeRealtime: () => {
    const ch = get().realtimeChannel;
    if (!ch) return;
    try { supabase.removeChannel(ch); } catch {}
    set({ realtimeChannel: null });
  },
}));
