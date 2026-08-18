export interface DeviceIdentity {
  id: string;
  name: string;
  platform: string;
  browser: string;
  osVersion: string | null;
  isPwa: boolean;
  summary: string;
}

const DEVICE_ID_KEY = 'sigmas_device_id_v1';

function randomId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {}
  return `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function getCurrentDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const created = randomId();
    localStorage.setItem(DEVICE_ID_KEY, created);
    return created;
  } catch {
    return randomId();
  }
}

function browserName(ua: string): string {
  if (/EdgiOS|EdgA|Edg\//i.test(ua)) return 'Edge';
  if (/CriOS|Chrome\//i.test(ua) && !/Edg/i.test(ua)) return 'Chrome';
  if (/FxiOS|Firefox\//i.test(ua)) return 'Firefox';
  if (/OPiOS|OPR\//i.test(ua)) return 'Opera';
  if (/Safari\//i.test(ua) && !/Chrome|CriOS|Edg|OPR/i.test(ua)) return 'Safari';
  return 'Браузер';
}

function detectPlatform(ua: string): { name: string; platform: string; osVersion: string | null } {
  const ios = ua.match(/(?:CPU (?:iPhone )?OS|iPhone OS) ([\d_]+)/i);
  if (/iPhone/i.test(ua)) {
    return { name: 'iPhone', platform: 'iOS', osVersion: ios?.[1]?.replace(/_/g, '.') || null };
  }
  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)) {
    return { name: 'iPad', platform: 'iPadOS', osVersion: ios?.[1]?.replace(/_/g, '.') || null };
  }

  const android = ua.match(/Android\s([\d.]+)/i);
  if (/Android/i.test(ua)) {
    const tablet = !/Mobile/i.test(ua);
    return { name: tablet ? 'Android-планшет' : 'Android', platform: 'Android', osVersion: android?.[1] || null };
  }

  const mac = ua.match(/Mac OS X\s([\d_]+)/i);
  if (/Macintosh|Mac OS X/i.test(ua)) {
    return { name: 'Mac', platform: 'macOS', osVersion: mac?.[1]?.replace(/_/g, '.') || null };
  }

  if (/Windows/i.test(ua)) return { name: 'Windows PC', platform: 'Windows', osVersion: null };
  if (/Linux/i.test(ua)) return { name: 'Linux PC', platform: 'Linux', osVersion: null };
  return { name: 'Устройство', platform: 'Web', osVersion: null };
}

export function getDeviceIdentity(): DeviceIdentity {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const base = detectPlatform(ua);
  const browser = browserName(ua);
  const isPwa = typeof window !== 'undefined' && (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
  const summaryParts = [base.platform + (base.osVersion ? ` ${base.osVersion}` : ''), browser];
  if (isPwa) summaryParts.push('Приложение');

  return {
    id: getCurrentDeviceId(),
    name: base.name,
    platform: base.platform,
    browser,
    osVersion: base.osVersion,
    isPwa,
    summary: summaryParts.filter(Boolean).join(' · '),
  };
}
