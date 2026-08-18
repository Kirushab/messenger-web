// Sigmas service worker: background Web Push + notification routing.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function safePayload(event) {
  if (!event.data) return {};
  try { return event.data.json() || {}; } catch {
    try { return { body: event.data.text() }; } catch { return {}; }
  }
}

function normalizePath(value) {
  try { return new URL(value || '/', self.location.origin).pathname; }
  catch { return '/'; }
}

async function shouldSuppressNotification(data) {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const visible = windows.filter(client => client.visibilityState === 'visible' || client.focused);
  if (!visible.length) return false;

  // A visible app already renders its own incoming-call overlay and ringtone.
  if (data.kind === 'call') return true;

  // Do not notify for a message that is already open on screen. Notifications for
  // other chats still appear while the app is visible, matching messenger behaviour.
  const targetPath = normalizePath(data.url);
  return visible.some(client => normalizePath(client.url) === targetPath);
}

self.addEventListener('push', (event) => {
  const data = safePayload(event);
  event.waitUntil((async () => {
    if (await shouldSuppressNotification(data)) return;

    const title = data.title || 'Sigmas';
    await self.registration.showNotification(title, {
      body: data.body || 'Новое сообщение',
      icon: data.icon || '/icon-192.png',
      badge: data.badge || '/icon-192.png',
      tag: data.tag || `sigmas-${Date.now()}`,
      renotify: Boolean(data.renotify),
      requireInteraction: Boolean(data.requireInteraction),
      silent: Boolean(data.silent),
      data: {
        ...data,
        url: data.url || '/chats',
      },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawUrl = event.notification.data?.url || '/chats';
  const target = new URL(rawUrl, self.location.origin);

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const sameOrigin = windows.find(client => {
      try { return new URL(client.url).origin === target.origin; } catch { return false; }
    });

    if (sameOrigin) {
      try {
        if ('navigate' in sameOrigin) await sameOrigin.navigate(target.href);
        else sameOrigin.postMessage({ type: 'SIGMAS_NAVIGATE', url: target.pathname + target.search + target.hash });
      } catch {
        sameOrigin.postMessage({ type: 'SIGMAS_NAVIGATE', url: target.pathname + target.search + target.hash });
      }
      return sameOrigin.focus();
    }

    return self.clients.openWindow(target.href);
  })());
});
