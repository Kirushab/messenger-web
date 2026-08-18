// Простой диагностический логгер. Пишет события в кольцевой буфер 200 шт,
// доступен на /diag. Цель — не «исправить ничего вслепую», а собрать данные
// о реальной последовательности событий на устройстве пользователя.
// Дополнительно: каждое событие уходит в Sentry как breadcrumb — даёт контекст
// к любой ошибке которую SDK словил автоматически.

import { sentryBreadcrumb } from '@/lib/sentry';

type DiagEvent = {
  t: number;       // performance.now() от старта приложения
  ts: number;      // абсолютный Date.now()
  kind: string;    // короткий идентификатор
  data?: any;
};

const BUFFER_LIMIT = 300;
const buffer: DiagEvent[] = [];
const startedAt = performance.now();

export function diag(kind: string, data?: any) {
  try {
    const ev: DiagEvent = {
      t: Math.round(performance.now() - startedAt),
      ts: Date.now(),
      kind,
      data: data === undefined ? undefined : safeClone(data),
    };
    buffer.push(ev);
    if (buffer.length > BUFFER_LIMIT) buffer.shift();
    // также пишем в console — для тех, кто может его увидеть
    // eslint-disable-next-line no-console
    if (data !== undefined) console.log('[diag]', ev.t + 'ms', kind, data);
    // eslint-disable-next-line no-console
    else console.log('[diag]', ev.t + 'ms', kind);
    // И в Sentry как breadcrumb
    sentryBreadcrumb(kind, data);
  } catch {}
}

export function getDiagEvents(): DiagEvent[] {
  return [...buffer];
}

export function clearDiag() { buffer.length = 0; }

function safeClone(v: any): any {
  try {
    if (v === null || typeof v !== 'object') return v;
    return JSON.parse(JSON.stringify(v, (_, val) => {
      if (val instanceof Error) return { message: val.message, name: val.name };
      if (typeof val === 'function') return '[fn]';
      return val;
    }));
  } catch { return String(v); }
}

// Перехват необработанных ошибок и promise rejections
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    diag('window.error', { msg: e.message, file: e.filename, line: e.lineno, col: e.colno });
  });
  window.addEventListener('unhandledrejection', (e) => {
    diag('promise.reject', { reason: String(e.reason).slice(0, 300) });
  });
  diag('app.boot');
}
