import { supabase } from '@/lib/supabase';
import { getCurrentDeviceId, getDeviceIdentity } from '@/lib/deviceIdentity';
import { getNotifPref } from '@/lib/notifPrefs';

const VAPID_PUBLIC_KEY = String((import.meta as any).env.VITE_WEB_PUSH_PUBLIC_KEY || '').trim();
const PUSH_CACHE_MS = 15_000;

type PushState = 'unsupported' | 'unconfigured' | 'blocked' | 'disabled' | 'enabled';
export type PushResult = { ok: boolean; state: PushState; error?: string };

let serviceWorkerPromise: Promise<ServiceWorkerRegistration | null> | null = null;
let activeSubscriptionCache: { value: boolean; at: number } | null = null;

function invalidateSubscriptionCache(value?: boolean) {
  activeSubscriptionCache = typeof value === 'boolean' ? { value, at: Date.now() } : null;
}

export function isWebPushSupported(): boolean {
  return typeof window !== 'undefined'
    && window.isSecureContext
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export function isWebPushConfigured(): boolean {
  return VAPID_PUBLIC_KEY.length > 20;
}

function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

export async function registerSigmasServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isWebPushSupported()) return null;
  if (!serviceWorkerPromise) {
    serviceWorkerPromise = navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(async registration => {
        try { await registration.update(); } catch {}
        return registration;
      })
      .catch(error => {
        console.warn('[push] service worker registration failed:', error);
        serviceWorkerPromise = null;
        return null;
      });
  }
  return serviceWorkerPromise;
}

async function persistSubscription(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) throw new Error('Браузер вернул неполную push-подписку');

  const device = getDeviceIdentity();
  const { error } = await supabase.rpc('register_push_subscription', {
    p_endpoint: json.endpoint,
    p_p256dh: p256dh,
    p_auth: auth,
    p_device_id: getCurrentDeviceId(),
    p_device_name: device.name,
    p_platform: device.platform,
    p_user_agent: navigator.userAgent,
  });
  if (error) throw error;
}

export async function syncRemoteNotificationPreferences(userId: string): Promise<void> {
  if (!userId) return;
  const { error } = await supabase.from('notification_preferences').upsert({
    user_id: userId,
    enabled: getNotifPref('master'),
    direct_messages: getNotifPref('msg'),
    group_messages: getNotifPref('group'),
    calls: getNotifPref('call'),
    previews: getNotifPref('preview'),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function enablePushNotifications(userId: string): Promise<PushResult> {
  if (!isWebPushSupported()) return { ok: false, state: 'unsupported', error: 'Push-уведомления не поддерживаются в этом режиме браузера' };
  if (!isWebPushConfigured()) return { ok: false, state: 'unconfigured', error: 'На сервере не настроен VAPID public key' };

  try {
    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
    if (permission !== 'granted') {
      invalidateSubscriptionCache(false);
      return { ok: false, state: permission === 'denied' ? 'blocked' : 'disabled', error: 'Разрешение на уведомления не выдано' };
    }

    const registration = await registerSigmasServiceWorker();
    if (!registration) return { ok: false, state: 'unsupported', error: 'Не удалось зарегистрировать service worker' };

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    await persistSubscription(subscription);
    await syncRemoteNotificationPreferences(userId);
    invalidateSubscriptionCache(true);
    return { ok: true, state: 'enabled' };
  } catch (error) {
    console.error('[push] enable failed:', error);
    invalidateSubscriptionCache(false);
    return { ok: false, state: 'disabled', error: error instanceof Error ? error.message : String(error) };
  }
}

export async function disablePushNotifications(userId: string): Promise<PushResult> {
  if (!isWebPushSupported()) return { ok: true, state: 'unsupported' };
  try {
    const registration = await registerSigmasServiceWorker();
    const subscription = await registration?.pushManager.getSubscription();
    const endpoint = subscription?.endpoint || null;

    if (endpoint) {
      await supabase.rpc('unregister_push_subscription', { p_endpoint: endpoint });
      try { await subscription?.unsubscribe(); } catch {}
    } else if (userId) {
      await supabase.from('push_subscriptions').update({ enabled: false, updated_at: new Date().toISOString() })
        .eq('user_id', userId).eq('device_id', getCurrentDeviceId());
    }
    await syncRemoteNotificationPreferences(userId);
    invalidateSubscriptionCache(false);
    return { ok: true, state: 'disabled' };
  } catch (error) {
    console.error('[push] disable failed:', error);
    return { ok: false, state: 'disabled', error: error instanceof Error ? error.message : String(error) };
  }
}

export async function detachPushNotifications(): Promise<void> {
  if (!isWebPushSupported() || Notification.permission !== 'granted') return;
  try {
    const registration = await registerSigmasServiceWorker();
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription?.endpoint) {
      await Promise.race([
        supabase.rpc('unregister_push_subscription', { p_endpoint: subscription.endpoint }),
        new Promise(resolve => window.setTimeout(resolve, 1500)),
      ]);
    }
    invalidateSubscriptionCache(false);
  } catch (error) {
    console.warn('[push] detach failed:', error);
  }
}

export async function syncPushNotifications(userId: string): Promise<PushResult> {
  if (!isWebPushSupported()) return { ok: false, state: 'unsupported' };
  if (!isWebPushConfigured()) return { ok: false, state: 'unconfigured' };
  if (Notification.permission === 'denied') return { ok: false, state: 'blocked' };

  try {
    await syncRemoteNotificationPreferences(userId);
    if (!getNotifPref('master') || Notification.permission !== 'granted') {
      invalidateSubscriptionCache(false);
      return { ok: false, state: 'disabled' };
    }

    const registration = await registerSigmasServiceWorker();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return enablePushNotifications(userId);
    await persistSubscription(subscription);
    invalidateSubscriptionCache(true);
    return { ok: true, state: 'enabled' };
  } catch (error) {
    console.warn('[push] sync failed:', error);
    return { ok: false, state: 'disabled', error: error instanceof Error ? error.message : String(error) };
  }
}

export async function getPushState(): Promise<PushState> {
  if (!isWebPushSupported()) return 'unsupported';
  if (!isWebPushConfigured()) return 'unconfigured';
  if (Notification.permission === 'denied') return 'blocked';
  if (Notification.permission !== 'granted') return 'disabled';
  return (await hasActivePushSubscription()) ? 'enabled' : 'disabled';
}

export async function hasActivePushSubscription(): Promise<boolean> {
  if (!isWebPushSupported() || !isWebPushConfigured() || Notification.permission !== 'granted' || !getNotifPref('master')) return false;
  if (activeSubscriptionCache && Date.now() - activeSubscriptionCache.at < PUSH_CACHE_MS) return activeSubscriptionCache.value;
  try {
    const registration = await registerSigmasServiceWorker();
    const active = Boolean(await registration?.pushManager.getSubscription());
    invalidateSubscriptionCache(active);
    return active;
  } catch {
    invalidateSubscriptionCache(false);
    return false;
  }
}

export async function notifyMessageRecipients(messageId: string): Promise<void> {
  if (!messageId || String(messageId).startsWith('temp_')) return;
  const { error } = await supabase.functions.invoke('send-push', {
    body: { kind: 'message', messageId },
  });
  if (error) console.warn('[push] message dispatch failed:', error.message);
}

export async function notifyIncomingCall(args: {
  conversationId: string;
  roomId: string;
  callType: 'audio' | 'video';
  targetUserIds?: string[];
}): Promise<void> {
  if (!args.conversationId || !args.roomId) return;
  const { error } = await supabase.functions.invoke('send-push', {
    body: { kind: 'call', ...args },
  });
  if (error) console.warn('[push] call dispatch failed:', error.message);
}
