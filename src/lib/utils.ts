// BUG FIX #8: Unique avatar colors per user
const COLORS = [
  '#6C5CE7','#00CEC9','#E17055','#FDCB6E','#00B894','#E84393',
  '#0984E3','#FF7675','#55EFC4','#74B9FF','#A29BFE','#F8A5C2',
  '#686DE0','#BADC58','#F9CA24','#7ED6DF','#C44569','#3DC1D3',
];

/**
 * Десктоп vs тач-устройство. Определяется по primary pointer:
 * - mouse (hover:hover + pointer:fine) → ПК
 * - touch (отсутствует hover, грубый pointer) → телефон/планшет
 * Это надёжнее чем user-agent (легко спуфится) и работает для всех браузеров.
 * Используется например для эмодзи-клавиатуры: на ПК встроенный input не имеет
 * её, поэтому показываем кнопку. На телефонах системная клавиатура и так есть.
 */
export function isDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  } catch {
    return false;
  }
}

export function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

export function fmtTime(d: string): string {
  return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function fmtDate(d: string): string {
  const dt = new Date(d), now = new Date();
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (dt.toDateString() === now.toDateString()) return 'Сегодня';
  if (dt.toDateString() === y.toDateString()) return 'Вчера';
  return dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

export function fmtRelative(d: string): string {
  const dt = new Date(d), now = new Date();
  const diff = Math.floor((now.getTime() - dt.getTime()) / 86400000);
  if (diff === 0) return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff === 1) return 'Вчера';
  return dt.toLocaleDateString();
}

/**
 * Относительное время "5 мин назад", "2 ч", "вчера", "5 окт"
 */
export function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr  = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (sec < 60) return 'только что';
  if (min < 60) return `${min} мин`;
  if (hr < 24)  return `${hr} ч`;
  if (day === 1) return 'вчера';
  if (day < 7)  return `${day} дн`;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}
