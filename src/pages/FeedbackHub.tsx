import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { haptic } from '@/lib/haptics';
import { toast } from '@/stores/toastStore';
import { APP_VERSION } from '@/version';

const KINDS = [
  {
    id: 'widget' as const,
    title: 'Новый виджет',
    subtitle: 'Предложить идею для панели виджетов',
    accent: '#7C4DFF',
    soft: 'rgba(124,77,255,.12)',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><path d="M17.5 14v7M14 17.5h7"/></svg>,
  },
  {
    id: 'feature' as const,
    title: 'Новая функция',
    subtitle: 'Предложить улучшение или новую возможность',
    accent: '#20B486',
    soft: 'rgba(32,180,134,.12)',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 14.4 8.6 20 11l-5.6 2.4L12 19l-2.4-5.6L4 11l5.6-2.4L12 3Z"/><path d="M19 3v4M17 5h4"/></svg>,
  },
  {
    id: 'bug' as const,
    title: 'Сообщить о баге',
    subtitle: 'Описать проблему и как её повторить',
    accent: '#EF5350',
    soft: 'rgba(239,83,80,.12)',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="7" width="8" height="12" rx="4"/><path d="M8 11H4M20 11h-4M8 15H4M20 15h-4M10 7 8.5 4M14 7l1.5-3M12 7V3"/></svg>,
  },
];

type FeedbackKind = typeof KINDS[number]['id'];
type FeedbackStatus = 'new' | 'planned' | 'in_progress' | 'done' | 'declined';

type FeedbackRow = {
  id: string;
  kind: FeedbackKind;
  title: string;
  body: string;
  repro_steps: string | null;
  status: FeedbackStatus;
  created_at: string;
};

const STATUS: Record<FeedbackStatus, { label: string; color: string; bg: string }> = {
  new: { label: 'Получено', color: '#2563EB', bg: 'rgba(37,99,235,.10)' },
  planned: { label: 'В планах', color: '#7C4DFF', bg: 'rgba(124,77,255,.10)' },
  in_progress: { label: 'В работе', color: '#D97706', bg: 'rgba(217,119,6,.10)' },
  done: { label: 'Готово', color: '#0F9F6E', bg: 'rgba(15,159,110,.10)' },
  declined: { label: 'Не планируется', color: '#6B7280', bg: 'rgba(107,114,128,.10)' },
};

const fieldStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid var(--border)',
  background: 'var(--surface-light)',
  color: 'var(--text)',
  outline: 'none',
  font: 'inherit',
  borderRadius: 18,
  appearance: 'none',
  WebkitAppearance: 'none',
  boxShadow: 'none',
};

export default function FeedbackHub() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, session } = useAuthStore();
  const uid = user?.id || session?.user?.id;
  const [kind, setKind] = useState<FeedbackKind>('feature');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [repro, setRepro] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const selected = useMemo(() => KINDS.find(x => x.id === kind) || KINDS[1], [kind]);
  const source = searchParams.get('source') || 'feedback';
  const sourceChat = searchParams.get('chat');

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!uid) { setLoading(false); return; }
      const { data, error } = await supabase
        .from('feedback_requests')
        .select('id,kind,title,body,repro_steps,status,created_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(30);
      if (!active) return;
      if (!error) setRows((data || []) as FeedbackRow[]);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [uid]);

  const canSubmit = title.trim().length >= 3 && body.trim().length >= 8 && !submitting;

  const submit = async () => {
    if (!uid || !canSubmit) return;
    haptic.tap();
    setSubmitting(true);
    const payload = {
      user_id: uid,
      kind,
      title: title.trim(),
      body: body.trim(),
      repro_steps: kind === 'bug' && repro.trim() ? repro.trim() : null,
      app_version: APP_VERSION,
      source_path: sourceChat ? `${source}:chat:${sourceChat}` : source,
      page_url: window.location.href,
      user_agent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    };
    const { data, error } = await supabase
      .from('feedback_requests')
      .insert(payload)
      .select('id,kind,title,body,repro_steps,status,created_at')
      .single();
    setSubmitting(false);
    if (error) {
      toast.error('Не удалось отправить: ' + error.message);
      return;
    }
    haptic.success();
    toast.success('Спасибо — отправлено');
    if (data) setRows(prev => [data as FeedbackRow, ...prev]);
    setTitle('');
    setBody('');
    setRepro('');
    setShowHistory(true);
  };

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'max(12px, env(safe-area-inset-top, 12px)) 16px 10px', borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb, var(--bg) 92%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => { haptic.tap(); nav(-1); }} aria-label="Назад" style={{ width: 42, height: 42, borderRadius: 21, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 'var(--fs-title)', fontWeight: 850, letterSpacing: '-.03em' }}>Идеи и баги</h1>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 2 }}>Помоги сделать Sigmas лучше</div>
        </div>
      </header>

      <main className="page-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 16px calc(28px + env(safe-area-inset-bottom, 0px))' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <section style={{ position: 'relative', overflow: 'hidden', borderRadius: 28, background: 'linear-gradient(145deg, #111318, #1B1D24)', color: '#fff', padding: '22px 20px', marginBottom: 18, boxShadow: '0 18px 45px rgba(0,0,0,.14)' }}>
            <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: '50%', right: -70, top: -60, background: 'radial-gradient(circle, rgba(124,77,255,.5), rgba(124,77,255,0) 70%)' }} />
            <div style={{ position: 'absolute', width: 150, height: 150, borderRadius: '50%', left: -50, bottom: -80, background: 'radial-gradient(circle, rgba(32,180,134,.35), rgba(32,180,134,0) 70%)' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ width: 48, height: 48, borderRadius: 17, background: 'rgba(255,255,255,.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 14.3 8.7 20 11l-5.7 2.3L12 19l-2.3-5.7L4 11l5.7-2.3L12 3Z"/><path d="M19 3v4M17 5h4"/></svg>
              </div>
              <div style={{ fontSize: 'clamp(26px, 8vw, 38px)', fontWeight: 900, lineHeight: 1.04, letterSpacing: '-.035em' }}>Есть идея?<br/>Расскажи.</div>
              <div style={{ marginTop: 10, fontSize: 'var(--fs-body)', color: 'rgba(255,255,255,.72)', lineHeight: 1.5, maxWidth: 520 }}>Предлагай новые виджеты и функции или сообщай о проблемах. Каждое обращение сохраняется, а статус можно увидеть ниже.</div>
            </div>
          </section>

          <section style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 'var(--fs-micro)', fontWeight: 800, color: 'var(--muted)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>Что хочешь отправить</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 9 }}>
              {KINDS.map(item => {
                const active = item.id === kind;
                return (
                  <button key={item.id} onClick={() => { haptic.select(); setKind(item.id); }} style={{ minHeight: 118, padding: '14px 10px', borderRadius: 20, border: `1px solid ${active ? item.accent : 'var(--border)'}`, background: active ? item.soft : 'var(--surface)', color: 'var(--text)', textAlign: 'left', cursor: 'pointer', boxShadow: active ? `0 10px 28px ${item.soft}` : 'none', transition: 'transform .16s ease, border-color .18s ease, background .18s ease' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 13, background: active ? item.accent : 'var(--surface-light)', color: active ? '#fff' : 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 11 }}>{item.icon}</div>
                    <div style={{ fontSize: 'var(--fs-label)', fontWeight: 800, lineHeight: 1.15 }}>{item.title}</div>
                    <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', lineHeight: 1.3, marginTop: 5 }}>{item.subtitle}</div>
                  </button>
                );
              })}
            </div>
          </section>

          <section style={{ padding: 16, borderRadius: 24, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 42, height: 42, borderRadius: 14, background: selected.soft, color: selected.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{selected.icon}</div>
              <div>
                <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 800 }}>{selected.title}</div>
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 2 }}>{selected.subtitle}</div>
              </div>
            </div>

            <label style={{ display: 'block', marginBottom: 12 }}>
              <div style={{ fontSize: 'var(--fs-micro)', fontWeight: 800, color: 'var(--muted)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 7 }}>Коротко</div>
              <input value={title} onChange={e => setTitle(e.target.value)} maxLength={90} placeholder={kind === 'bug' ? 'Например: не открывается камера' : kind === 'widget' ? 'Например: виджет совместных заметок' : 'Например: закреплять важные события'} style={{ ...fieldStyle, minHeight: 54, padding: '0 16px' }} />
            </label>

            <label style={{ display: 'block', marginBottom: kind === 'bug' ? 12 : 0 }}>
              <div style={{ fontSize: 'var(--fs-micro)', fontWeight: 800, color: 'var(--muted)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 7 }}>Описание</div>
              <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={1800} rows={6} placeholder={kind === 'bug' ? 'Что произошло, что ожидалось и где это случилось?' : 'Опиши, как это должно работать и чем будет полезно.'} style={{ ...fieldStyle, minHeight: 138, padding: '14px 16px', resize: 'vertical', lineHeight: 1.5 }} />
            </label>

            {kind === 'bug' && (
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: 'var(--fs-micro)', fontWeight: 800, color: 'var(--muted)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 7 }}>Как повторить <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(необязательно)</span></div>
                <textarea value={repro} onChange={e => setRepro(e.target.value)} maxLength={1200} rows={4} placeholder={'1. Открыть чат\n2. Нажать …\n3. Происходит проблема'} style={{ ...fieldStyle, minHeight: 108, padding: '14px 16px', resize: 'vertical', lineHeight: 1.5 }} />
              </label>
            )}

            {kind === 'bug' && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 13, padding: '11px 12px', borderRadius: 15, background: 'var(--surface-light)', color: 'var(--muted)', fontSize: 'var(--fs-caption)', lineHeight: 1.4 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
                <span>Версия приложения, браузер и размер экрана будут приложены автоматически — это помогает быстрее найти причину.</span>
              </div>
            )}
          </section>

          <button onClick={submit} disabled={!canSubmit} style={{ width: '100%', minHeight: 58, border: 'none', borderRadius: 20, background: canSubmit ? 'var(--text)' : 'var(--surface-light)', color: canSubmit ? 'var(--bg)' : 'var(--muted)', fontSize: 'var(--fs-snap16)', fontWeight: 850, cursor: canSubmit ? 'pointer' : 'default', boxShadow: canSubmit ? '0 12px 28px rgba(0,0,0,.12)' : 'none', transition: 'transform .16s ease, opacity .16s ease' }}>
            {submitting ? 'Отправляем…' : 'Отправить'}
          </button>

          <section style={{ marginTop: 22 }}>
            <button onClick={() => { haptic.tap(); setShowHistory(v => !v); }} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, border: 'none', background: 'transparent', color: 'var(--text)', padding: '6px 2px 12px', cursor: 'pointer' }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 800 }}>Мои обращения</div>
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 2 }}>{rows.length ? `${rows.length} отправлено` : 'Пока ничего нет'}</div>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showHistory ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }}><polyline points="6 9 12 15 18 9"/></svg>
            </button>

            {showHistory && (
              <div className="anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {loading && <div style={{ padding: 18, textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--fs-caption)' }}>Загружаем…</div>}
                {!loading && rows.length === 0 && <div style={{ padding: '22px 16px', textAlign: 'center', borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)', fontSize: 'var(--fs-caption)' }}>После отправки идеи или бага они появятся здесь.</div>}
                {rows.map(row => {
                  const meta = KINDS.find(x => x.id === row.kind) || KINDS[1];
                  const st = STATUS[row.status] || STATUS.new;
                  return (
                    <article key={row.id} style={{ padding: 14, borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 13, background: meta.soft, color: meta.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{meta.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <div style={{ fontSize: 'var(--fs-label)', fontWeight: 800, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.title}</div>
                            <span style={{ padding: '4px 8px', borderRadius: 999, background: st.bg, color: st.color, fontSize: 'var(--fs-snap10)', fontWeight: 800 }}>{st.label}</span>
                          </div>
                          <div style={{ marginTop: 5, color: 'var(--muted)', fontSize: 'var(--fs-caption)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{row.body}</div>
                          <div style={{ marginTop: 8, color: 'var(--muted)', fontSize: 'var(--fs-snap10)' }}>{new Date(row.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
