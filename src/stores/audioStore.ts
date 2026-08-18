import { create } from 'zustand';

// Один <audio> на всё приложение, ЖИВЁТ ВНЕ React-дерева — поэтому
// воспроизведение не прерывается при скролле и переходах между чатами/вкладками.
let el: HTMLAudioElement | null = null;
let progressRaf: number | null = null;
let lastProgressPaint = 0;
function getEl(): HTMLAudioElement {
  if (!el) {
    el = new Audio();
    el.preload = 'metadata';
  }
  return el;
}

interface Current {
  url: string;
  msgId: string;
  title: string; // имя чата/отправителя для мини-плеера
}

interface AudioState {
  current: Current | null;
  isPlaying: boolean;
  progress: number; // 0..1
  duration: number; // сек
  currentTime: number; // сек
  rate: number; // 1 | 1.5 | 2
  play: (url: string, msgId: string, title: string) => void;
  toggle: () => void;
  pause: () => void;
  seekRatio: (r: number) => void;
  cycleRate: () => void;
  stop: () => void;
}

function stopProgressLoop() {
  if (progressRaf != null) cancelAnimationFrame(progressRaf);
  progressRaf = null;
  lastProgressPaint = 0;
}

function startProgressLoop(set: (partial: Partial<AudioState>) => void, get: () => AudioState) {
  stopProgressLoop();
  const tick = (ts: number) => {
    const a = getEl();
    if (!get().current || a.paused || a.ended) {
      progressRaf = null;
      return;
    }
    // ~30 fps is visually smooth while avoiding needless React updates on mobile.
    if (ts - lastProgressPaint >= 32) {
      lastProgressPaint = ts;
      const d = Number.isFinite(a.duration) ? a.duration : 0;
      const t = Number.isFinite(a.currentTime) ? a.currentTime : 0;
      set({ currentTime: t, duration: d, progress: d > 0 ? Math.max(0, Math.min(1, t / d)) : 0 });
    }
    progressRaf = requestAnimationFrame(tick);
  };
  progressRaf = requestAnimationFrame(tick);
}

export const useAudioStore = create<AudioState>((set, get) => ({
  current: null,
  isPlaying: false,
  progress: 0,
  duration: 0,
  currentTime: 0,
  rate: 1,

  play: (url, msgId, title) => {
    const a = getEl();
    const st = get();
    // Тот же трек — просто toggle
    if (st.current?.msgId === msgId) {
      if (a.paused) { a.play().catch(() => {}); }
      else { a.pause(); }
      return;
    }
    a.src = url;
    a.playbackRate = st.rate;
    a.onloadedmetadata = () => set({ duration: a.duration || 0 });
    a.ontimeupdate = () => {
      const d = a.duration || 0;
      if (!get().isPlaying) set({ currentTime: a.currentTime, duration: d, progress: d ? a.currentTime / d : 0 });
    };
    a.onended = () => { stopProgressLoop(); set({ isPlaying: false, progress: 1, currentTime: a.duration || 0 }); };
    a.onpause = () => {
      stopProgressLoop();
      const d = a.duration || 0;
      set({ isPlaying: false, currentTime: a.currentTime || 0, duration: d, progress: d ? (a.currentTime || 0) / d : 0 });
    };
    a.onplay = () => { set({ isPlaying: true }); startProgressLoop(set, get); };
    a.play().catch(() => {});
    set({ current: { url, msgId, title }, isPlaying: true, progress: 0, currentTime: 0, duration: 0 });
    startProgressLoop(set, get);
  },

  toggle: () => {
    const a = getEl();
    if (!get().current) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  },

  pause: () => { getEl().pause(); },

  seekRatio: (r) => {
    const a = getEl();
    if (a.duration && Number.isFinite(a.duration)) {
      a.currentTime = Math.max(0, Math.min(1, r)) * a.duration;
      set({ progress: Math.max(0, Math.min(1, r)), currentTime: a.currentTime });
    }
  },

  cycleRate: () => {
    const a = getEl();
    const order = [1, 1.5, 2];
    const next = order[(order.indexOf(get().rate) + 1) % order.length];
    a.playbackRate = next;
    set({ rate: next });
  },

  stop: () => {
    const a = getEl();
    stopProgressLoop();
    a.pause();
    try { a.src = ''; } catch { /* noop */ }
    set({ current: null, isPlaying: false, progress: 0, currentTime: 0, duration: 0 });
  },
}));
