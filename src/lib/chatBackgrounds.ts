// Фоны чата — пресеты и утилиты
// Хранятся как строки:
//   "builtin:abstract-blue"       — встроенный пресет
//   "https://...storage..."       — кастомная картинка (URL из Supabase Storage)
//   null                          — нет фона (дефолт темы)

export interface ChatBackgroundPreset {
  id: string;
  label: string;
  // CSS background для применения. Может быть градиент или комбинация.
  cssBackground: string;
  // Превью thumbnail — тот же CSS
  preview: string;
}

export const BACKGROUND_PRESETS: ChatBackgroundPreset[] = [
  {
    id: 'instagram',
    label: 'Instagram',
    cssBackground: 'linear-gradient(135deg, #F58529 0%, #DD2A7B 50%, #515BD4 100%)',
    preview: 'linear-gradient(135deg, #F58529, #DD2A7B, #515BD4)',
  },
  {
    id: 'peachy',
    label: 'Peach',
    cssBackground: 'linear-gradient(135deg, #FFB199 0%, #FF867A 50%, #FF5E62 100%)',
    preview: 'linear-gradient(135deg, #FFB199, #FF5E62)',
  },
  {
    id: 'aurora',
    label: 'Aurora',
    cssBackground: 'linear-gradient(135deg, #5EE7DF 0%, #B490CA 50%, #FF6FB1 100%)',
    preview: 'linear-gradient(135deg, #5EE7DF, #B490CA, #FF6FB1)',
  },
  {
    id: 'tealify',
    label: 'Teal',
    cssBackground: 'linear-gradient(135deg, #0BA360 0%, #3CBA92 100%)',
    preview: 'linear-gradient(135deg, #0BA360, #3CBA92)',
  },
  {
    id: 'lavender',
    label: 'Lavender',
    cssBackground: 'linear-gradient(135deg, #C2A8FC 0%, #8AB6F9 100%)',
    preview: 'linear-gradient(135deg, #C2A8FC, #8AB6F9)',
  },
  {
    id: 'sunset',
    label: 'Sunset',
    cssBackground: 'linear-gradient(135deg, #FF9966 0%, #FF5E62 100%)',
    preview: 'linear-gradient(135deg, #FF9966, #FF5E62)',
  },
  {
    id: 'cosmic',
    label: 'Cosmic',
    cssBackground: 'linear-gradient(135deg, #4776E6 0%, #8E54E9 100%)',
    preview: 'linear-gradient(135deg, #4776E6, #8E54E9)',
  },
  {
    id: 'spotify',
    label: 'Spotify',
    cssBackground: 'linear-gradient(135deg, #1DB954 0%, #191414 100%)',
    preview: 'linear-gradient(135deg, #1DB954, #191414)',
  },
  {
    id: 'rosegold',
    label: 'Rose Gold',
    cssBackground: 'linear-gradient(135deg, #FBC2EB 0%, #A6C1EE 100%)',
    preview: 'linear-gradient(135deg, #FBC2EB, #A6C1EE)',
  },
  {
    id: 'midnight',
    label: 'Midnight',
    cssBackground: 'linear-gradient(135deg, #232526 0%, #414345 100%)',
    preview: 'linear-gradient(135deg, #232526, #414345)',
  },
  {
    id: 'flamingo',
    label: 'Flamingo',
    cssBackground: 'linear-gradient(135deg, #FF3CAC 0%, #784BA0 50%, #2B86C5 100%)',
    preview: 'linear-gradient(135deg, #FF3CAC, #784BA0, #2B86C5)',
  },
  {
    id: 'forest',
    label: 'Forest',
    cssBackground: 'linear-gradient(135deg, #134E5E 0%, #71B280 100%)',
    preview: 'linear-gradient(135deg, #134E5E, #71B280)',
  },
];

export function findPreset(id: string): ChatBackgroundPreset | undefined {
  return BACKGROUND_PRESETS.find(p => p.id === id);
}

/**
 * Преобразует значение из БД в CSS background.
 * Возвращает null если нужно использовать дефолт темы.
 */
export function resolveChatBackground(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith('builtin:')) {
    const preset = findPreset(value.slice('builtin:'.length));
    return preset?.cssBackground || null;
  }
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return `url("${value}") center/cover no-repeat`;
  }
  return null;
}

/**
 * Возвращает превью для отображения в picker'е.
 */
export function resolveChatBackgroundPreview(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith('builtin:')) {
    return findPreset(value.slice('builtin:'.length))?.preview || null;
  }
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return `url("${value}") center/cover no-repeat`;
  }
  return null;
}
