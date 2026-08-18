import { getNotifPref, getRingtonePref, RingtoneId } from '@/lib/notifPrefs';
import { registerSigmasServiceWorker, syncPushNotifications } from '@/lib/pushNotifications';

// ===== Sound =====
let ctx: AudioContext | null = null;
let ringtoneTimer: number | null = null;
let ringbackTimer: number | null = null;
let ringtoneNodes: Array<OscillatorNode | AudioBufferSourceNode> = [];

function ensureAudioContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function rememberNode<T extends OscillatorNode | AudioBufferSourceNode>(node: T): T {
  ringtoneNodes.push(node);
  node.addEventListener('ended', () => { ringtoneNodes = ringtoneNodes.filter(n => n !== node); });
  return node;
}

export function playMessageSound() {
  try {
    const audio = ensureAudioContext();
    const o = audio.createOscillator(), g = audio.createGain();
    o.connect(g); g.connect(audio.destination);
    o.frequency.setValueAtTime(880, audio.currentTime);
    o.frequency.setValueAtTime(660, audio.currentTime + 0.1);
    o.type = 'sine';
    g.gain.setValueAtTime(0.08, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.4);
    o.start(); o.stop(audio.currentTime + 0.4);
  } catch {}
}

export const RINGTONE_OPTIONS: { id: RingtoneId; label: string; description: string }[] = [
  { id: 'classic', label: 'Classic', description: 'два чётких сигнала' },
  { id: 'soft', label: 'Soft', description: 'мягкий звонок' },
];

export function playCallSound(kind: RingtoneId = getRingtonePref()) {
  try {
    const audio = ensureAudioContext();
    const now = audio.currentTime;
    const master = audio.createGain();
    master.gain.setValueAtTime(0.72, now);
    master.connect(audio.destination);

    const patterns: Record<RingtoneId, Array<{ f: number; start: number; dur: number; gain?: number; type?: OscillatorType }>> = {
      classic: [
        { f: 392, start: 0, dur: 0.32, gain: 0.08 }, { f: 523.25, start: 0.1, dur: 0.42, gain: 0.075 },
        { f: 659.25, start: 0.26, dur: 0.34, gain: 0.062 }, { f: 523.25, start: 0.78, dur: 0.38, gain: 0.07 },
        { f: 783.99, start: 0.94, dur: 0.46, gain: 0.055 },
      ],
      soft: [
        { f: 329.63, start: 0, dur: 0.8, gain: 0.045, type: 'sine' },
        { f: 493.88, start: 0.18, dur: 0.85, gain: 0.04, type: 'sine' },
        { f: 659.25, start: 0.42, dur: 0.9, gain: 0.035, type: 'sine' },
      ],
    };

    const play = (note: { f: number; start: number; dur: number; gain?: number; type?: OscillatorType }, harmonic = 1) => {
      const o = rememberNode(audio.createOscillator());
      const g = audio.createGain();
      o.connect(g); g.connect(master);
      o.frequency.setValueAtTime(note.f * harmonic, now + note.start);
      o.type = note.type || 'sine';
      const startAt = now + note.start;
      const gain = (note.gain ?? 0.07) / harmonic;
      g.gain.setValueAtTime(0.0001, startAt);
      g.gain.exponentialRampToValueAtTime(gain, startAt + 0.035);
      g.gain.exponentialRampToValueAtTime(0.001, startAt + note.dur);
      o.start(startAt); o.stop(startAt + note.dur + 0.04);
    };
    patterns[kind].forEach(note => { play(note, 1); play(note, 2); });
  } catch {}
}

export function startCallRingtone(kind: RingtoneId = getRingtonePref()) {
  stopCallRingtone();
  playCallSound(kind);
  try {
    ringtoneTimer = window.setInterval(() => playCallSound(kind), kind === 'soft' ? 2300 : 2100);
  } catch {}
}

export function stopCallRingtone() {
  if (ringtoneTimer != null) {
    try { window.clearInterval(ringtoneTimer); } catch {}
    ringtoneTimer = null;
  }
  ringtoneNodes.forEach(n => { try { n.stop(); } catch {} });
  ringtoneNodes = [];
}

function playOutgoingRingbackPulse() {
  try {
    const audio = ensureAudioContext();
    const now = audio.currentTime;
    const master = audio.createGain();
    master.gain.setValueAtTime(0.42, now);
    master.connect(audio.destination);

    // Короткий спокойный сигнал ожидания ответа. Он запускается из пользовательского
    // нажатия, поэтому Safari/iOS не откладывает звук до следующего взаимодействия.
    [0, 0.34].forEach((offset) => {
      const osc = rememberNode(audio.createOscillator());
      const gain = audio.createGain();
      osc.connect(gain); gain.connect(master);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(425, now + offset);
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.055, now + offset + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.25);
      osc.start(now + offset);
      osc.stop(now + offset + 0.28);
    });
  } catch {}
}

export function startOutgoingRingback() {
  stopOutgoingRingback();
  playOutgoingRingbackPulse();
  try { ringbackTimer = window.setInterval(playOutgoingRingbackPulse, 2600); } catch {}
}

export function stopOutgoingRingback() {
  if (ringbackTimer != null) {
    try { window.clearInterval(ringbackTimer); } catch {}
    ringbackTimer = null;
  }
  ringtoneNodes.forEach(n => { try { n.stop(); } catch {} });
  ringtoneNodes = [];
}


// ===== Badge (red circle with number on app icon) =====
export function updateBadge(count: number) {
  try {
    if (!getNotifPref('badge')) {
      if ('clearAppBadge' in navigator) (navigator as any).clearAppBadge();
      document.title = 'Sigmas';
      return;
    }
    // PWA Badge API — shows number on home screen icon
    if ('setAppBadge' in navigator) {
      if (count > 0) {
        (navigator as any).setAppBadge(count);
      } else {
        (navigator as any).clearAppBadge();
      }
    }

    // Update page title with count
    const base = 'Sigmas';
    document.title = count > 0 ? `(${count}) ${base}` : base;
  } catch {}
}

// ===== Notification API =====
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export async function showNotification(
  title: string,
  body: string,
  options?: { tag?: string; icon?: string; url?: string; silent?: boolean; requireInteraction?: boolean }
) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const tag = options?.tag || 'msg-' + Date.now();
    const icon = options?.icon || '/icon-192.png';
    const url = options?.url || '/chats';
    const silent = options?.silent ?? (document.hasFocus() && document.visibilityState === 'visible');
    const notificationOptions: NotificationOptions = {
      body: body.substring(0, 120),
      icon,
      tag,
      badge: '/icon-192.png',
      silent,
      requireInteraction: options?.requireInteraction ?? false,
      data: { url },
    };

    // ServiceWorkerRegistration.showNotification работает и для установленной PWA,
    // и использует тот же tag, что и серверный push — дубликаты заменяются.
    const registration = await registerSigmasServiceWorker();
    if (registration) {
      await registration.showNotification(title, notificationOptions);
      return;
    }

    const notification = new Notification(title, notificationOptions);
    notification.onclick = () => {
      window.focus();
      if (url && window.location.pathname !== url) window.location.assign(url);
      notification.close();
    };
    if (!notificationOptions.requireInteraction) setTimeout(() => notification.close(), 6000);
  } catch {}
}

export async function showCallNotification(callerName: string, url = '/chats') {
  return showNotification('Входящий звонок', callerName + ' звонит...', {
    tag: 'call-current',
    url,
    requireInteraction: true,
    silent: false,
  });
}

// ===== Init =====
export function initNotifications(userId?: string) {
  void registerSigmasServiceWorker();
  if (userId) void syncPushNotifications(userId);
}
