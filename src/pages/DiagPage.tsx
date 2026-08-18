import { useState, useEffect } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDiagEvents, clearDiag, diag } from '@/lib/diag';
import { captureError } from '@/lib/sentry';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { useMapStore } from '@/stores/mapStore';
import { usePostStore } from '@/stores/postStore';
import { supabase } from '@/lib/supabase';
import { haptic } from '@/lib/haptics';

const IconBack = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
);
const IconPulse = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 8L9 4l-3 8H2" /></svg>
);
const IconCopy = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
);
const IconBug = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="7" width="8" height="12" rx="4" /><path d="M8 11H4M20 11h-4M8 15H4M20 15h-4M10 7 8.5 4M14 7l1.5-3M12 7V3" /></svg>
);
const IconCrash = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 2 22h20L12 2Z" /><path d="M12 9v5" /><path d="M12 18h.01" /></svg>
);
const IconTrash = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6 18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /></svg>
);
const IconRefresh = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 1-15.5 6.2" /><path d="M3 12A9 9 0 0 1 18.5 5.8" /><path d="M3 18v-6h6" /><path d="M21 6v6h-6" /></svg>
);

export default function DiagPage() {
  const nav = useNavigate();
  const [events, setEvents] = useState(getDiagEvents());
  const [shouldCrash, setShouldCrash] = useState(false);
  const [runningHealth, setRunningHealth] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setEvents(getDiagEvents()), 700);
    return () => clearInterval(iv);
  }, []);

  const auth = useAuthStore();
  const chat = useChatStore();
  const map = useMapStore();
  const posts = usePostStore();

  const runHealthCheck = async () => {
    setRunningHealth(true);
    diag('diag.health.start');
    try {
      const t0 = performance.now();
      const { data: sess } = await supabase.auth.getSession();
      diag('diag.health.getSession', { ms: Math.round(performance.now() - t0), hasSession: !!sess?.session, uid: sess?.session?.user?.id });

      if (sess?.session?.user) {
        const t1 = performance.now();
        const { data, error } = await supabase.from('users').select('id, display_name').eq('id', sess.session.user.id).maybeSingle();
        diag('diag.health.userRow', { ms: Math.round(performance.now() - t1), gotData: !!data, error: error?.message });
      }

      const t2 = performance.now();
      const { data: ping, error: pingErr } = await supabase.from('users').select('id').limit(1);
      diag('diag.health.ping', { ms: Math.round(performance.now() - t2), gotData: ping?.length, error: pingErr?.message });
    } catch (e: any) {
      diag('diag.health.exception', { error: e?.message });
    }
    setEvents(getDiagEvents());
    setRunningHealth(false);
  };

  const copyAll = async () => {
    const text = JSON.stringify({
      meta: {
        ua: navigator.userAgent,
        ts: new Date().toISOString(),
        url: location.href,
        online: navigator.onLine,
      },
      state: {
        auth: { initialized: auth.initialized, hasSession: !!auth.session, uid: auth.user?.id, email: auth.user?.email },
        chat: { convs: chat.conversations.length, hasFetched: chat.conversations.length > 0 },
        map: { locs: map.locations.length, hasMy: !!map.myLocation, myCoords: map.myLocation ? [map.myLocation.lng, map.myLocation.lat] : null },
        posts: { feed: posts.feedPosts.length, loading: posts.loadingFeed, exhausted: posts.feedExhausted },
      },
      events,
    }, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      alert('Скопировано в буфер (' + text.length + ' символов)');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:9999;font-size:11px';
      document.body.appendChild(ta);
      ta.select();
      alert('Скопируй текст вручную и закрой');
      setTimeout(() => document.body.removeChild(ta), 100);
    }
  };

  const metricRows = [
    ['auth.initialized', String(auth.initialized)],
    ['auth.hasSession', String(!!auth.session)],
    ['auth.user.id', auth.user?.id?.slice(0, 8) || '—'],
    ['auth.user.email', auth.user?.email || '—'],
    ['chat.conversations', String(chat.conversations.length)],
    ['map.locations', String(map.locations.length)],
    ['map.myLocation', map.myLocation ? `[${map.myLocation.lng.toFixed(3)}, ${map.myLocation.lat.toFixed(3)}]` : '—'],
    ['posts.feedPosts', String(posts.feedPosts.length)],
    ['navigator.onLine', String(navigator.onLine)],
    ['performance.now', Math.round(performance.now()) + 'ms'],
  ];

  return (
    <div className="admin-tool-page">
      <header className="admin-tool-header safe-top-sm">
        <button onClick={() => nav(-1)} className="admin-tool-back" aria-label="Назад"><IconBack /></button>
        <div>
          <h1>Диагностика</h1>
          <p>Состояние приложения, Supabase и последние события</p>
        </div>
        <button onClick={() => { haptic.tap(); setEvents(getDiagEvents()); }} className="admin-tool-refresh" aria-label="Обновить">
          <IconRefresh />
        </button>
      </header>

      <div className="admin-tool-scroll page-scroll">
        <div className="admin-tool-shell">
          <section className="admin-tool-hero">
            <div className="admin-tool-heroIcon"><IconPulse /></div>
            <div style={{ minWidth: 0 }}>
              <h2 className="admin-tool-heroTitle">Панель проверки</h2>
              <p className="admin-tool-heroText">Запускай healthcheck, копируй отчёт и проверяй ключевые метрики без переходов по разным разделам.</p>
            </div>
          </section>

          <section className="admin-tool-actions-grid">
            <DiagAction onClick={() => { haptic.tap(); runHealthCheck(); }} icon={<IconPulse />} label={runningHealth ? 'Проверяем…' : 'Healthcheck'} hint="Проверка сессии, user row и чтения из Supabase" tone="primary" />
            <DiagAction onClick={() => { haptic.tap(); copyAll(); }} icon={<IconCopy />} label="Скопировать отчёт" hint="Копирует метрики, состояние и журнал событий" tone="accent" />
            <DiagAction onClick={() => {
              haptic.tap();
              diag('diag.sentry.test', { manual: true });
              captureError(new Error('Sentry test from /diag — это проверочное событие'), { source: 'diag-page-button' });
              alert('Тестовое событие отправлено в Sentry. Проверь через 30 сек на sentry.io → Issues.');
            }} icon={<IconBug />} label="Тест Sentry" hint="Отправляет контролируемое событие в Sentry" tone="purple" />
            <DiagAction onClick={() => { haptic.tap(); diag('diag.errorBoundary.test', { manual: true }); setShouldCrash(true); }} icon={<IconCrash />} label="Crash test" hint="Проверка ErrorBoundary на реальном падении" tone="danger" />
            <DiagAction onClick={async () => {
              haptic.tap();
              if (!confirm('Очистить кеш приложения и перезагрузить?\nАккаунт и сообщения сохранятся в облаке, очистится только локальный кеш.')) return;
              diag('diag.cache.clear.start');
              try {
                if ('serviceWorker' in navigator) {
                  const regs = await navigator.serviceWorker.getRegistrations();
                  for (const r of regs) await r.unregister();
                  diag('diag.cache.sw.unregistered', { count: regs.length });
                }
                if ('caches' in window) {
                  const keys = await caches.keys();
                  await Promise.all(keys.map(k => caches.delete(k)));
                  diag('diag.cache.caches.cleared', { count: keys.length });
                }
                const allKeys = Object.keys(localStorage);
                const removed = allKeys.filter(k => !k.startsWith('sb-') && !k.startsWith('supabase'));
                for (const k of removed) localStorage.removeItem(k);
                diag('diag.cache.localStorage.cleared', { removed: removed.length, kept: allKeys.length - removed.length });
              } catch (e: any) {
                diag('diag.cache.clear.err', { error: e?.message });
              }
              window.location.href = '/';
            }} icon={<IconTrash />} label="Сбросить кеш" hint="Очищает service worker, caches и локальные ключи" tone="warning" />
            <DiagAction onClick={() => { haptic.tap(); clearDiag(); setEvents([]); }} icon={<IconTrash />} label="Очистить журнал" hint="Удаляет локальные события диагностики" tone="muted" />
          </section>

          {shouldCrash && <Crasher />}

          <section className="admin-tool-card">
            <div style={sectionHead}>
              <h2>Состояние</h2>
              <span style={pill}>{navigator.onLine ? 'online' : 'offline'}</span>
            </div>
            <div className="admin-kv-grid">
              {metricRows.map(([k, v]) => <Kv key={k} k={k} v={v} />)}
            </div>
          </section>

          <section className="admin-tool-card">
            <div style={sectionHead}>
              <h2>События</h2>
              <span style={pill}>{events.length}</span>
            </div>
            <div className="admin-diag-events">
              {events.slice().reverse().map((e, i) => (
                <div key={i} className="admin-diag-eventRow">
                  <div className="admin-diag-eventTop">
                    <span className="admin-diag-eventTime">{e.t}ms</span>
                    <span className="admin-diag-eventKind" style={{ color: kindColor(e.kind) }}>{e.kind}</span>
                  </div>
                  {e.data && <pre className="admin-diag-eventData">{JSON.stringify(e.data, null, 2)}</pre>}
                </div>
              ))}
              {events.length === 0 && <div style={{ color: 'var(--muted)', padding: 18, textAlign: 'center', fontSize: '12px' }}>Пусто. Перейди в проблемную секцию и вернись сюда.</div>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function DiagAction({ onClick, icon, label, hint, tone }: { onClick: () => void; icon: ReactNode; label: string; hint: string; tone: 'primary' | 'accent' | 'purple' | 'danger' | 'warning' | 'muted' }) {
  const iconStyle: CSSProperties = {
    background: tone === 'primary' ? 'var(--text)' : tone === 'accent' ? 'var(--accent)' : tone === 'purple' ? 'linear-gradient(135deg,#8B5CF6,#6D28D9)' : tone === 'danger' ? 'rgba(239,68,68,.12)' : tone === 'warning' ? 'rgba(245,158,11,.14)' : 'var(--surface-light)',
    color: tone === 'primary' || tone === 'accent' || tone === 'purple' ? '#fff' : tone === 'danger' ? 'var(--danger)' : tone === 'warning' ? '#D97706' : 'var(--text2)',
  };
  return (
    <button onClick={onClick} className="admin-diag-action">
      <span className="admin-diag-actionIcon" style={iconStyle}>{icon}</span>
      <span className="admin-diag-actionCopy"><b>{label}</b><small>{hint}</small></span>
    </button>
  );
}

const sectionHead: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 };
const pill: CSSProperties = { padding: '4px 9px', borderRadius: 999, background: 'var(--surface-light)', color: 'var(--text2)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 };

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="admin-kv-row">
      <span style={{ color: 'var(--muted)' }}>{k}</span>
      <span style={{ color: 'var(--text)' }}>{v}</span>
    </div>
  );
}

function kindColor(kind: string): string {
  if (kind.includes('err') || kind.includes('fail') || kind.includes('reject')) return '#EF4444';
  if (kind.includes('done') || kind.includes('ok') || kind.includes('loaded')) return '#10B981';
  if (kind.startsWith('map')) return '#3B82F6';
  if (kind.startsWith('auth')) return '#8B5CF6';
  if (kind.startsWith('feed')) return '#F59E0B';
  if (kind.startsWith('diag')) return '#06B6D4';
  return 'var(--text)';
}

function Crasher(): JSX.Element {
  throw new Error('ErrorBoundary test crash из /diag — это проверочное падение');
}
