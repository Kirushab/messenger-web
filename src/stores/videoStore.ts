import { create } from 'zustand';

// Один <video> на всё приложение, создаётся вне React-дерева и переиспользуется,
// поэтому кружок продолжает играть при скролле и переходах между чатами/вкладками.
let vEl: HTMLVideoElement | null = null;
let progressRaf: number | null = null;
let lastProgressPaint = 0;
export function getVideoEl(): HTMLVideoElement {
  if (!vEl) {
    vEl = document.createElement('video');
    vEl.playsInline = true;
    vEl.setAttribute('playsinline', '');
    vEl.setAttribute('webkit-playsinline', '');
    vEl.preload = 'metadata';
    vEl.style.width = '100%';
    vEl.style.height = '100%';
    vEl.style.objectFit = 'cover';
    vEl.style.display = 'block';
  }
  return vEl;
}

interface Current {
  url: string;
  msgId: string;
  title: string;
}

interface VideoState {
  current: Current | null;
  isPlaying: boolean;
  progress: number; // 0..1
  currentTime: number;
  duration: number;
  rate: number;
  muted: boolean;
  // Видим ли сейчас на экране пузырь активного кружка. true → проигрывается ВНУТРИ
  // пузыря; false → отцеплён в плавающий мини-плеер (скролл увёл / другой чат).
  inlineVisible: boolean;
  play: (url: string, msgId: string, title: string) => void;
  toggle: () => void;
  pause: () => void;
  toggleMute: () => void;
  seekRatio: (r: number) => void;
  cycleRate: () => void;
  setInlineVisible: (v: boolean) => void;
  stop: () => void;
}

function stopProgressLoop() {
  if (progressRaf != null) cancelAnimationFrame(progressRaf);
  progressRaf = null;
  lastProgressPaint = 0;
}

function startProgressLoop(set: (partial: Partial<VideoState>) => void, get: () => VideoState) {
  stopProgressLoop();
  const tick = (ts: number) => {
    const v = getVideoEl();
    if (!get().current || v.paused || v.ended) {
      progressRaf = null;
      return;
    }
    if (ts - lastProgressPaint >= 32) {
      lastProgressPaint = ts;
      const d = Number.isFinite(v.duration) ? v.duration : 0;
      const t = Number.isFinite(v.currentTime) ? v.currentTime : 0;
      set({ progress: d > 0 ? Math.max(0, Math.min(1, t / d)) : 0, currentTime: t, duration: d });
    }
    progressRaf = requestAnimationFrame(tick);
  };
  progressRaf = requestAnimationFrame(tick);
}

export const useVideoStore = create<VideoState>((set, get) => ({
  current: null,
  isPlaying: false,
  progress: 0,
  currentTime: 0,
  duration: 0,
  rate: 1,
  muted: false,
  inlineVisible: true,

  play: (url, msgId, title) => {
    const v = getVideoEl();
    if (get().current?.msgId === msgId) {
      if (v.paused) v.play().catch(() => {});
      else v.pause();
      return;
    }
    v.src = url;
    v.loop = false;
    v.muted = false; // звук включается при переходе в активный режим
    v.playbackRate = get().rate;
    v.ontimeupdate = () => {
      const d = v.duration || 0;
      if (!get().isPlaying) set({ progress: d ? v.currentTime / d : 0, currentTime: v.currentTime, duration: d });
    };
    v.onloadedmetadata = () => set({ duration: v.duration || 0 });
    v.onended = () => { stopProgressLoop(); set({ isPlaying: false, progress: 1, currentTime: v.duration || 0 }); };
    v.onpause = () => {
      stopProgressLoop();
      const d = v.duration || 0;
      set({ isPlaying: false, progress: d ? (v.currentTime || 0) / d : 0, currentTime: v.currentTime || 0, duration: d });
    };
    v.onplay = () => { set({ isPlaying: true }); startProgressLoop(set, get); };
    v.play().catch(() => {});
    // play вызывается тапом по пузырю → он на экране, со звуком
    set({ current: { url, msgId, title }, isPlaying: true, progress: 0, currentTime: 0, muted: false, inlineVisible: true });
    startProgressLoop(set, get);
  },

  toggle: () => {
    const v = getVideoEl();
    if (!get().current) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  },

  pause: () => { if (get().current) getVideoEl().pause(); },

  toggleMute: () => {
    const v = getVideoEl();
    const next = !get().muted;
    v.muted = next;
    set({ muted: next });
  },

  seekRatio: (r) => {
    const v = getVideoEl();
    if (!v.duration) return;
    const rr = Math.max(0, Math.min(1, r));
    v.currentTime = rr * v.duration;
    set({ progress: rr, currentTime: v.currentTime });
  },

  cycleRate: () => {
    const v = getVideoEl();
    const order = [1, 1.5, 2];
    const next = order[(order.indexOf(get().rate) + 1) % order.length];
    v.playbackRate = next;
    set({ rate: next });
  },

  setInlineVisible: (v) => set({ inlineVisible: v }),

  stop: () => {
    const v = getVideoEl();
    stopProgressLoop();
    v.pause();
    try { v.src = ''; } catch { /* noop */ }
    set({ current: null, isPlaying: false, progress: 0, currentTime: 0, duration: 0, inlineVisible: true });
  },
}));
