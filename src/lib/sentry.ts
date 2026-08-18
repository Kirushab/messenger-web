import * as Sentry from '@sentry/react';
import { APP_VERSION } from '../version';

// DSN — публичный идентификатор проекта (его и так видно в network-запросах клиента),
// поэтому держим в коде. Можно переопределить через VITE_SENTRY_DSN если нужно.
const DSN = (import.meta as any).env.VITE_SENTRY_DSN
  || 'https://f7fcd61a4c943caf6f058640f229d91e@o4511389086515200.ingest.us.sentry.io/4511389103226880';

let inited = false;

export function initSentry() {
  if (inited) return;

  // Только в production (на Render). В локальной разработке шуметь не надо.
  const isProd = (import.meta as any).env.PROD;
  if (!isProd) {
    // eslint-disable-next-line no-console
    console.log('[sentry] disabled in dev mode');
    return;
  }

  if (!DSN) return;

  Sentry.init({
    dsn: DSN,
    environment: 'production',
    // Релиз — версия приложения (src/version.ts). Override через VITE_APP_VERSION при необходимости.
    release: (import.meta as any).env.VITE_APP_VERSION || `sigmas-web@${APP_VERSION}`,
    integrations: [
      // BrowserTracing и Replay не включаем — экономим free-tier quota.
    ],
    // Error monitoring only — отключаем sampling
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    // Не шлём слишком много контекстных данных
    sendDefaultPii: false,
    // Фильтр шумных/неактуальных ошибок
    beforeSend(event, hint) {
      const err = hint?.originalException;
      const msg = (err as any)?.message || event.message || '';

      // Расширения браузера, кросс-домен, network noise
      if (/ResizeObserver loop|Non-Error promise rejection captured|Load failed|NetworkError when attempting/i.test(msg)) {
        return null;
      }
      // Service worker автоматические апдейты
      if (/ServiceWorker|sw\.js/i.test(msg)) return null;
      return event;
    },
  });

  inited = true;
  // eslint-disable-next-line no-console
  console.log('[sentry] initialized');
}

// Установка контекста пользователя (вызывается после логина)
export function setSentryUser(user: { id: string; email?: string; display_name?: string } | null) {
  if (!inited) return;
  if (user) {
    Sentry.setUser({
      id: user.id,
      // email только если хочется привязать (не отдаём в общий dashboard по умолчанию)
      username: user.display_name,
    });
  } else {
    Sentry.setUser(null);
  }
}

// Хлебная крошка из нашей диагностики (вызывается из diag.ts)
export function sentryBreadcrumb(kind: string, data?: any) {
  if (!inited) return;
  try {
    Sentry.addBreadcrumb({
      category: kind.split('.')[0],
      message: kind,
      level: /err|fail|reject/.test(kind) ? 'error' : 'info',
      data: data || undefined,
    });
  } catch {}
}

// Ручная отправка ошибки с контекстом
export function captureError(err: any, context?: Record<string, any>) {
  if (!inited) {
    // eslint-disable-next-line no-console
    console.error('[capture]', err, context);
    return;
  }
  Sentry.captureException(err, context ? { extra: context } : undefined);
}
