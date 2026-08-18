// Тактильный отклик (вибрация). Включается/выключается в настройках, по умолчанию ВКЛ.
// Хранится в localStorage; navigator.vibrate работает на Android-браузерах (на iOS Safari нет — тихо игнорируется).

const KEY = 'sigmas_haptics';

export function isHapticsOn(): boolean {
  try { return localStorage.getItem(KEY) !== '0'; } catch { return true; }
}

export function setHapticsOn(on: boolean): void {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* ignore */ }
}

function vibe(pattern: number | number[]): void {
  if (!isHapticsOn()) return;
  try { navigator.vibrate?.(pattern); } catch { /* ignore */ }
}

export const haptic = {
  tap: () => vibe(10),               // лёгкий — тап по пину
  select: () => vibe(16),            // выбор / снап шторки
  success: () => vibe([12, 40, 18]), // постановка / сохранение точки
  error: () => vibe([30, 60, 30]),   // ошибка / неверный ответ — двойной резкий бузз
};
