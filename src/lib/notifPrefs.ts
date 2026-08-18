// Настройки уведомлений и звуков (по устройству, localStorage). По умолчанию ВКЛ.
// Хаптика живёт отдельно в '@/lib/haptics'. Звуки обучения — '@/lib/eduPrefs'. Покер — '@/lib/pokerSound'.
export type NotifKey = 'master' | 'msg' | 'group' | 'call' | 'preview' | 'badge' | 'sndMsg' | 'sndCall';
export type RingtoneId = 'classic' | 'soft';

const KEYS: Record<NotifKey, string> = {
  master: 'sigmas_notif',
  msg: 'sigmas_notif_msg',
  group: 'sigmas_notif_group',
  call: 'sigmas_notif_call',
  preview: 'sigmas_notif_preview',
  badge: 'sigmas_badge',
  sndMsg: 'sigmas_snd_msg',
  sndCall: 'sigmas_snd_call',
};

const RINGTONE_KEY = 'sigmas_call_ringtone';
const RINGTONES: RingtoneId[] = ['classic', 'soft'];

// Одноразовая миграция со старого общего флага notifyEnabled -> master
(function migrate() {
  try {
    if (localStorage.getItem(KEYS.master) == null) {
      const old = localStorage.getItem('notifyEnabled');
      if (old != null) localStorage.setItem(KEYS.master, old === '0' ? '0' : '1');
    }
  } catch {}
})();

export function getNotifPref(k: NotifKey): boolean {
  try { return localStorage.getItem(KEYS[k]) !== '0'; } catch { return true; }
}

export function setNotifPref(k: NotifKey, on: boolean): void {
  try { localStorage.setItem(KEYS[k], on ? '1' : '0'); } catch {}
}

export function getRingtonePref(): RingtoneId {
  try {
    const value = localStorage.getItem(RINGTONE_KEY) as RingtoneId | null;
    return value && RINGTONES.includes(value) ? value : 'classic';
  } catch { return 'classic'; }
}

export function setRingtonePref(id: RingtoneId): void {
  try { localStorage.setItem(RINGTONE_KEY, id); } catch {}
}
