// src/lib/appearance.ts
// Управление настройками оформления — закругление, размер текста, цвета

export type TextSize = 'small' | 'normal' | 'large' | 'xlarge';

export interface AppearanceSettings {
  bubbleRadius: number;   // 4-24, default 18
  textSize: TextSize;     // default 'normal'
  accentColor: string | null;  // hex, null = из темы
  sentColor: string | null;    // hex, null = из темы
  recvColor: string | null;    // hex, null = из темы
  bubbleGradient: string | null; // CSS gradient для sent-бабла (приоритет над sentColor)
}

const DEFAULTS: AppearanceSettings = {
  bubbleRadius: 18,
  textSize: 'normal',
  accentColor: null,
  sentColor: null,
  recvColor: null,
  bubbleGradient: null,
};

const STORAGE_KEY = 'appearance_v1';

const TEXT_SIZE_PX: Record<TextSize, number> = {
  small: 13,
  normal: 14,
  large: 16,
  xlarge: 18,
};

export function loadAppearance(): AppearanceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      bubbleRadius: typeof parsed.bubbleRadius === 'number' && parsed.bubbleRadius >= 4 && parsed.bubbleRadius <= 24
        ? parsed.bubbleRadius : DEFAULTS.bubbleRadius,
      textSize: ['small','normal','large','xlarge'].includes(parsed.textSize) ? parsed.textSize : DEFAULTS.textSize,
      accentColor: typeof parsed.accentColor === 'string' && /^#[0-9a-f]{6}$/i.test(parsed.accentColor) ? parsed.accentColor : null,
      sentColor: typeof parsed.sentColor === 'string' && /^#[0-9a-f]{6}$/i.test(parsed.sentColor) ? parsed.sentColor : null,
      recvColor: typeof parsed.recvColor === 'string' && /^#[0-9a-f]{6}$/i.test(parsed.recvColor) ? parsed.recvColor : null,
      bubbleGradient: typeof parsed.bubbleGradient === 'string' && parsed.bubbleGradient.startsWith('linear-gradient(') ? parsed.bubbleGradient : null,
    };
  } catch { return { ...DEFAULTS }; }
}

export function saveAppearance(s: AppearanceSettings): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
  applyAppearance(s);
  window.dispatchEvent(new CustomEvent('appearance-changed', { detail: s }));
}

export function applyAppearance(s: AppearanceSettings): void {
  const root = document.documentElement;
  root.style.setProperty('--bubble-radius', `${s.bubbleRadius}px`);
  root.style.setProperty('--bubble-tail-radius', `${Math.max(4, Math.round(s.bubbleRadius / 3))}px`);
  root.style.setProperty('--font-size-base', `${TEXT_SIZE_PX[s.textSize]}px`);

  if (s.accentColor) {
    root.style.setProperty('--accent', s.accentColor);
  } else {
    root.style.removeProperty('--accent');
  }
  if (s.bubbleGradient) {
    // Градиент имеет приоритет над solid sent-цветом
    root.style.setProperty('--msg-sent', s.bubbleGradient);
    // Подбираем text-color по первому hex в градиенте
    const firstHex = extractFirstHex(s.bubbleGradient);
    if (firstHex) root.style.setProperty('--msg-sent-text', contrastingTextColor(firstHex));
    else root.style.removeProperty('--msg-sent-text');
  } else if (s.sentColor) {
    root.style.setProperty('--msg-sent', s.sentColor);
    root.style.setProperty('--msg-sent-text', contrastingTextColor(s.sentColor));
  } else {
    root.style.removeProperty('--msg-sent');
    root.style.removeProperty('--msg-sent-text');
  }
  if (s.recvColor) {
    root.style.setProperty('--msg-recv', s.recvColor);
    root.style.setProperty('--msg-recv-text', contrastingTextColor(s.recvColor));
  } else {
    root.style.removeProperty('--msg-recv');
    root.style.removeProperty('--msg-recv-text');
  }
}

/** Возвращает #FFFFFF или #000000 — то, что контрастно к данному hex-цвету. */
function contrastingTextColor(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return '#FFFFFF';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Перцептивная яркость (luminance)
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 140 ? '#000000' : '#FFFFFF';
}

/** Достаёт первый #rrggbb из CSS gradient-строки */
function extractFirstHex(str: string): string | null {
  const m = str.match(/#[0-9a-fA-F]{6}/);
  return m ? m[0] : null;
}

export function resetAppearance(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  applyAppearance({ ...DEFAULTS });
  window.dispatchEvent(new CustomEvent('appearance-changed', { detail: { ...DEFAULTS } }));
}

export const APPEARANCE_DEFAULTS = DEFAULTS;
