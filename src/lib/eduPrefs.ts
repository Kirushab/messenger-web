// Настройки обучения: звук упражнений и тема нотного стана.
// Хаптика живёт отдельно в '@/lib/haptics' (isHapticsOn/setHapticsOn).

const SOUND_KEY = 'sigmas_sound';
const STAFF_KEY = 'sigmas_staff_theme';

export function isSoundOn(): boolean {
  try { return localStorage.getItem(SOUND_KEY) !== '0'; } catch { return true; }
}
export function setSoundOn(on: boolean): void {
  try { localStorage.setItem(SOUND_KEY, on ? '1' : '0'); } catch { /* ignore */ }
}

export type StaffTheme = 'warm' | 'white';
export function getStaffTheme(): StaffTheme {
  try { return localStorage.getItem(STAFF_KEY) === 'white' ? 'white' : 'warm'; } catch { return 'warm'; }
}
export function setStaffTheme(t: StaffTheme): void {
  try { localStorage.setItem(STAFF_KEY, t); } catch { /* ignore */ }
}

const RATE_KEY = 'sigmas_speech_rate';
const VOICE_PREFIX = 'sigmas_voice_';
export const SPEECH_RATES = [0.8, 0.95, 1.08] as const;
export function getSpeechRate(): number {
  try { const v = parseFloat(localStorage.getItem(RATE_KEY) || '0.95'); return (SPEECH_RATES as readonly number[]).includes(v) ? v : 0.95; } catch { return 0.9; }
}
export function setSpeechRate(r: number): void {
  try { localStorage.setItem(RATE_KEY, String(r)); } catch { /* ignore */ }
}
export function getVoiceURI(lang: string): string | null {
  try { return localStorage.getItem(VOICE_PREFIX + lang); } catch { return null; }
}
export function setVoiceURI(lang: string, uri: string | null): void {
  try { if (uri) localStorage.setItem(VOICE_PREFIX + lang, uri); else localStorage.removeItem(VOICE_PREFIX + lang); } catch { /* ignore */ }
}
