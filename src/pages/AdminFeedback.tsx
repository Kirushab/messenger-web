import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { isOwnerEmail } from '@/lib/admin';
import { haptic } from '@/lib/haptics';
import { toast } from '@/stores/toastStore';
import { avatarColor } from '@/lib/utils';

type FeedbackKind = 'widget' | 'feature' | 'bug';
type FeedbackStatus = 'new' | 'planned' | 'in_progress' | 'done' | 'declined';

type FeedbackRow = {
  id: string;
  user_id: string;
  kind: FeedbackKind;
  title: string;
  body: string;
  repro_steps: string | null;
  status: FeedbackStatus;
  app_version: string | null;
  source_path: string | null;
  page_url: string | null;
  user_agent: string | null;
  viewport: string | null;
  created_at: string;
  updated_at: string;
};

type UserBrief = {
  id: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
};

const KINDS: Array<{ id: 'all' | FeedbackKind; label: string }> = [
  { id: 'all', label: 'Все' },
  { id: 'widget', label: 'Виджеты' },
  { id: 'feature', label: 'Функции' },
  { id: 'bug', label: 'Баги' },
];

const STATUSES: Array<{ id: 'all' | FeedbackStatus; label: string }> = [
  { id: 'all', label: 'Все статусы' },
  { id: 'new', label: 'Получено' },
  { id: 'planned', label: 'В планах' },
  { id: 'in_progress', label: 'В работе' },
  { id: 'done', label: 'Готово' },
  { id: 'declined', label: 'Не планируется' },
];

const KIND_META: Record<FeedbackKind, { label: string; accent: string; soft: string; icon: JSX.Element }> = {
  widget: {
    label: 'Новый виджет', accent: '#7C4DFF', soft: 'rgba(124,77,255,.12)',
    icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><path d="M17.5 14v7M14 17.5h7"/></svg>,
  },
  feature: {
    label: 'Новая функция', accent: '#20B486', soft: 'rgba(32,180,134,.12)',
    icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 14.4 8.6 20 11l-5.6 2.4L12 19l-2.4-5.6L4 11l5.6-2.4L12 3Z"/><path d="M19 3v4M17 5h4"/></svg>,
  },
  bug: {
    label: 'Баг', accent: '#EF5350', soft: 'rgba(239,83,80,.12)',
    icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="7" width="8" height="12" rx="4"/><path d="M8 11H4M20 11h-4M8 15H4M20 15h-4M10 7 8.5 4M14 7l1.5-3M12 7V3"/></svg>,
  },
};

const STATUS_META: Record<FeedbackStatus, { label: string; color: string; bg: string }> = {
  new: { label: 'Получено', color: '#2563EB', bg: 'rgba(37,99,235,.10)' },
  planned: { label: 'В планах', color: '#7C4DFF', bg: 'rgba(124,77,255,.10)' },
  in_progress: { label: 'В работе', color: '#D97706', bg: 'rgba(217,119,6,.10)' },
  done: { label: 'Готово', color: '#0F9F6E', bg: 'rgba(15,159,110,.10)' },
  declined: { label: 'Не планируется', color: '#6B7280', bg: 'rgba(107,114,128,.10)' },
};

export default function AdminFeedback() {
  const nav = useNavigate();
  const { user } = useAuthStore();
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [users, setUsers] = useState<Record<string, UserBrief>>({});
  const [kind, setKind] = useState<'all' | FeedbackKind>('all');
  const [status, setStatus] = useState<'all' | FeedbackStatus>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<FeedbackRow | null>(null);

  useEffect(() => {
    if (user && !isOwnerEmail(user.email)) nav(-1);
  }, [user, nav]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('feedback_requests')
        .select('id,user_id,kind,title,body,repro_steps,status,app_version,source_path,page_url,user_agent,viewport,created_at,updated_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      const feedback = (data || []) as FeedbackRow[];
      setRows(feedback);

      const ids = Array.from(new Set(feedback.map(row => row.user_id)));
      if (!ids.length) {
        setUsers({});
      } else {
        const { data: userRows, error: usersError } = await supabase
          .from('users')
          .select('id,display_name,email,avatar_url')
          .in('id', ids);
        if (usersError) throw usersError;
        setUsers(Object.fromEntries(((userRows || []) as UserBrief[]).map(row => [row.id, row])));
      }
    } catch (error: any) {
      toast.error('Не удалось загрузить обращения: ' + (error?.message || 'ошибка'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    acc[`kind:${row.kind}`] = (acc[`kind:${row.kind}`] || 0) + 1;
    return acc;
  }, {}), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(row => {
      if (kind !== 'all' && row.kind !== kind) return false;
      if (status !== 'all' && row.status !== status) return false;
      if (!q) return true;
      const author = users[row.user_id];
      const haystack = [row.title, row.body, row.repro_steps, author?.display_name, author?.email, row.app_version, row.source_path]
        .filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, kind, status, query, users]);

  const setRowStatus = async (row: FeedbackRow, next: FeedbackStatus) => {
    setBusyId(row.id);
    try {
      const { error } = await supabase.from('feedback_requests').update({ status: next }).eq('id', row.id);
      if (error) throw error;
      const now = new Date().toISOString();
      setRows(prev => prev.map(item => item.id === row.id ? { ...item, status: next, updated_at: now } : item));
      setSelected(prev => prev?.id === row.id ? { ...prev, status: next, updated_at: now } : prev);
      haptic.success();
      toast.success('Статус: ' + STATUS_META[next].label);
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось изменить статус');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="admin-feedback-page">
      <header className="admin-users-header safe-top-sm">
        <button className="admin-back" onClick={() => nav(-1)} aria-label="Назад">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div><h1>Идеи и баги</h1><p>Обратная связь от пользователей Sigmas</p></div>
        <button className="admin-refresh" onClick={() => { haptic.tap(); void load(); }} disabled={loading} aria-label="Обновить">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M20 11a8 8 0 1 0 2 5.3"/><path d="M20 4v7h-7"/></svg>
        </button>
      </header>

      <div className="admin-feedback-toolbar">
        <div className="admin-feedback-summary">
          <div><b>{rows.length}</b><span>всего</span></div>
          <div><b>{counts.new || 0}</b><span>новых</span></div>
          <div><b>{counts.in_progress || 0}</b><span>в работе</span></div>
          <div><b>{counts.done || 0}</b><span>готово</span></div>
        </div>
        <label className="admin-feedback-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Поиск по идеям, багам и авторам" />
        </label>
        <div className="admin-feedback-filter-scroll">
          {KINDS.map(item => (
            <button key={item.id} className={kind === item.id ? 'active' : ''} onClick={() => { haptic.select(); setKind(item.id); }}>
              {item.label}{item.id !== 'all' && counts[`kind:${item.id}`] ? <span>{counts[`kind:${item.id}`]}</span> : null}
            </button>
          ))}
        </div>
        <div className="admin-feedback-filter-scroll status-row">
          {STATUSES.map(item => (
            <button key={item.id} className={status === item.id ? 'active' : ''} onClick={() => { haptic.select(); setStatus(item.id); }}>
              {item.label}{item.id !== 'all' && counts[item.id] ? <span>{counts[item.id]}</span> : null}
            </button>
          ))}
        </div>
      </div>

      <main className="admin-feedback-list page-scroll">
        {loading && <div className="admin-users-loading"><span className="spinner"/><p>Загружаю обращения</p></div>}
        {!loading && filtered.length === 0 && <div className="admin-users-empty">По этим фильтрам обращений нет</div>}
        {!loading && filtered.map(row => {
          const author = users[row.user_id];
          const kindMeta = KIND_META[row.kind];
          const statusMeta = STATUS_META[row.status];
          return (
            <button key={row.id} className="admin-feedback-card" onClick={() => { haptic.tap(); setSelected(row); }}>
              <div className="admin-feedback-card-icon" style={{ background: kindMeta.soft, color: kindMeta.accent }}>{kindMeta.icon}</div>
              <div className="admin-feedback-card-copy">
                <div className="admin-feedback-card-topline">
                  <span className="admin-feedback-kind" style={{ color: kindMeta.accent }}>{kindMeta.label}</span>
                  <span className="admin-feedback-status" style={{ color: statusMeta.color, background: statusMeta.bg }}>{statusMeta.label}</span>
                </div>
                <h2>{row.title}</h2>
                <p>{row.body}</p>
                <div className="admin-feedback-meta">
                  <span>{author?.display_name || author?.email || row.user_id.slice(0, 8)}</span>
                  <span>·</span>
                  <span>{new Date(row.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  {row.app_version && <><span>·</span><span>{row.app_version}</span></>}
                </div>
              </div>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          );
        })}
      </main>

      {selected && (
        <div className="admin-feedback-overlay" onClick={() => setSelected(null)}>
          <section className="admin-feedback-sheet anim-pop-in" onClick={e => e.stopPropagation()}>
            <div className="admin-feedback-handle" />
            {(() => {
              const author = users[selected.user_id];
              const kindMeta = KIND_META[selected.kind];
              const statusMeta = STATUS_META[selected.status];
              const busy = busyId === selected.id;
              return (
                <>
                  <div className="admin-feedback-sheet-head">
                    <div className="admin-feedback-card-icon large" style={{ background: kindMeta.soft, color: kindMeta.accent }}>{kindMeta.icon}</div>
                    <div className="admin-feedback-sheet-title">
                      <span style={{ color: kindMeta.accent }}>{kindMeta.label}</span>
                      <h2>{selected.title}</h2>
                    </div>
                    <button onClick={() => setSelected(null)} aria-label="Закрыть">×</button>
                  </div>

                  <div className="admin-feedback-author">
                    <div className="admin-feedback-avatar" style={{ background: avatarColor(author?.id || selected.user_id) }}>
                      {author?.avatar_url ? <img src={author.avatar_url} alt="" /> : (author?.display_name || '?')[0].toUpperCase()}
                    </div>
                    <div><b>{author?.display_name || 'Пользователь'}</b><span>{author?.email || selected.user_id}</span></div>
                    <span className="admin-feedback-status" style={{ color: statusMeta.color, background: statusMeta.bg }}>{statusMeta.label}</span>
                  </div>

                  <div className="admin-feedback-detail-block"><span>Описание</span><p>{selected.body}</p></div>
                  {selected.repro_steps && <div className="admin-feedback-detail-block"><span>Как повторить</span><p>{selected.repro_steps}</p></div>}

                  <div className="admin-feedback-tech-grid">
                    <div><span>Версия</span><b>{selected.app_version || '—'}</b></div>
                    <div><span>Экран</span><b>{selected.viewport || '—'}</b></div>
                    <div><span>Источник</span><b>{selected.source_path || '—'}</b></div>
                    <div><span>Дата</span><b>{new Date(selected.created_at).toLocaleString('ru-RU')}</b></div>
                  </div>
                  {selected.page_url && <div className="admin-feedback-detail-block compact"><span>URL</span><code>{selected.page_url}</code></div>}
                  {selected.user_agent && <div className="admin-feedback-detail-block compact"><span>Браузер</span><code>{selected.user_agent}</code></div>}

                  <div className="admin-feedback-status-actions">
                    <div>Изменить статус</div>
                    <div className="admin-feedback-status-grid">
                      {STATUSES.filter(x => x.id !== 'all').map(item => {
                        const id = item.id as FeedbackStatus;
                        const meta = STATUS_META[id];
                        const active = selected.status === id;
                        return (
                          <button key={id} disabled={busy || active} className={active ? 'active' : ''} style={active ? { borderColor: meta.color, background: meta.bg, color: meta.color } : undefined} onClick={() => { haptic.tap(); void setRowStatus(selected, id); }}>
                            {meta.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="admin-feedback-sheet-actions">
                    <button onClick={() => nav(`/u/${selected.user_id}`)}>Открыть профиль</button>
                    <button onClick={() => { navigator.clipboard?.writeText(`${selected.title}\n\n${selected.body}${selected.repro_steps ? `\n\nКак повторить:\n${selected.repro_steps}` : ''}`); toast.success('Текст скопирован'); }}>Скопировать</button>
                  </div>
                </>
              );
            })()}
          </section>
        </div>
      )}
    </div>
  );
}
