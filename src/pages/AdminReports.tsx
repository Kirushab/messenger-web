import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { isOwnerEmail } from '@/lib/admin';
import { toast } from '@/stores/toastStore';
import { avatarColor } from '@/lib/utils';
import { haptic } from '@/lib/haptics';

type ReportStatus = 'new' | 'reviewing' | 'resolved' | 'rejected';

interface ReportRow {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  conversation_id: string | null;
  message_id: string | null;
  target_type: string | null;
  target_id: string | null;
  reason: string;
  details: string | null;
  status: ReportStatus;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  metadata: Record<string, unknown> | null;
}

interface UserBrief {
  id: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
}

const FILTERS: Array<{ id: 'all' | ReportStatus; label: string }> = [
  { id: 'all', label: 'Все' },
  { id: 'new', label: 'Новые' },
  { id: 'reviewing', label: 'В работе' },
  { id: 'resolved', label: 'Решённые' },
  { id: 'rejected', label: 'Отклонённые' },
];

const STATUS_LABEL: Record<ReportStatus, string> = {
  new: 'Новая',
  reviewing: 'В работе',
  resolved: 'Решена',
  rejected: 'Отклонена',
};

const TARGET_LABEL: Record<string, string> = {
  user: 'Пользователь',
  post: 'Публикация',
  comment: 'Комментарий',
  message: 'Сообщение',
  chat: 'Чат',
  chat_profile: 'Профиль в чате',
};

export default function AdminReports() {
  const nav = useNavigate();
  const { user } = useAuthStore();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [users, setUsers] = useState<Record<string, UserBrief>>({});
  const [filter, setFilter] = useState<'all' | ReportStatus>('all');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (user && !isOwnerEmail(user.email)) nav(-1);
  }, [user, nav]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('content_reports')
        .select('id,reporter_id,reported_user_id,conversation_id,message_id,target_type,target_id,reason,details,status,created_at,reviewed_at,reviewed_by,metadata')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;

      const reports = (data || []) as ReportRow[];
      setRows(reports);

      const ids = Array.from(new Set(reports.flatMap(r => [r.reporter_id, r.reported_user_id, r.reviewed_by].filter(Boolean) as string[])));
      if (ids.length) {
        const { data: userRows, error: usersError } = await supabase
          .from('users')
          .select('id,display_name,email,avatar_url')
          .in('id', ids);
        if (usersError) throw usersError;
        setUsers(Object.fromEntries(((userRows || []) as UserBrief[]).map(row => [row.id, row])));
      } else {
        setUsers({});
      }
    } catch (error: any) {
      toast.error('Не удалось загрузить жалобы: ' + (error?.message || 'ошибка'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (row: ReportRow, status: ReportStatus) => {
    if (!user) return;
    setBusyId(row.id);
    try {
      const patch = {
        status,
        reviewed_at: status === 'new' ? null : new Date().toISOString(),
        reviewed_by: status === 'new' ? null : user.id,
      };
      const { error } = await supabase.from('content_reports').update(patch).eq('id', row.id);
      if (error) throw error;
      setRows(prev => prev.map(item => item.id === row.id ? { ...item, ...patch } : item));
      toast.success(status === 'resolved' ? 'Жалоба закрыта' : status === 'rejected' ? 'Жалоба отклонена' : 'Статус обновлён');
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось обновить жалобу');
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => filter === 'all' ? rows : rows.filter(row => row.status === filter), [rows, filter]);
  const counts = useMemo(() => rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {}), [rows]);

  return (
    <div className="admin-reports-page">
      <header className="admin-users-header safe-top-sm">
        <button className="admin-back" onClick={() => nav(-1)} aria-label="Назад">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div><h1>Жалобы</h1><p>Модерация пользователей, чатов и контента</p></div>
        <button className="admin-refresh" onClick={() => { haptic.tap(); load(); }} disabled={loading} aria-label="Обновить">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M20 11a8 8 0 1 0 2 5.3"/><path d="M20 4v7h-7"/></svg>
        </button>
      </header>

      <div className="admin-reports-toolbar">
        <div className="admin-users-filters">
          {FILTERS.map(item => (
            <button key={item.id} className={filter === item.id ? 'active' : ''} onClick={() => { haptic.select(); setFilter(item.id); }}>
              {item.label}{item.id !== 'all' && counts[item.id] ? <span>{counts[item.id]}</span> : null}
            </button>
          ))}
        </div>
      </div>

      <main className="admin-reports-list page-scroll">
        {loading && <div className="admin-users-loading"><span className="spinner"/><p>Загружаю жалобы</p></div>}
        {!loading && filtered.length === 0 && <div className="admin-users-empty">В этой категории жалоб нет</div>}
        {!loading && filtered.map(row => {
          const reporter = users[row.reporter_id];
          const targetUser = row.reported_user_id ? users[row.reported_user_id] : null;
          const targetType = row.target_type || (row.message_id ? 'message' : row.conversation_id ? 'chat' : row.reported_user_id ? 'user' : 'content');
          const isBusy = busyId === row.id;
          return (
            <article className="admin-report-card" key={row.id}>
              <div className="admin-report-head">
                <div className="admin-report-avatar" style={{ background: avatarColor(reporter?.id || row.reporter_id) }}>
                  {reporter?.avatar_url ? <img src={reporter.avatar_url} alt="" /> : (reporter?.display_name || '?')[0].toUpperCase()}
                </div>
                <div className="admin-report-title">
                  <h2>{TARGET_LABEL[targetType] || 'Контент'}</h2>
                  <p>Жалоба от {reporter?.display_name || reporter?.email || row.reporter_id.slice(0, 8)}</p>
                </div>
                <span className={`admin-report-status ${row.status}`}>{STATUS_LABEL[row.status]}</span>
              </div>

              <div className="admin-report-body">
                <div><span>Причина</span><b>{row.reason || 'Не указана'}</b></div>
                {targetUser && <div><span>На пользователя</span><b>{targetUser.display_name} · {targetUser.email || 'без email'}</b></div>}
                {row.details && <div><span>Комментарий</span><p>{row.details}</p></div>}
                <div className="admin-report-meta">
                  <span>{new Date(row.created_at).toLocaleString('ru-RU')}</span>
                  {row.conversation_id && <code>chat {row.conversation_id.slice(0, 8)}</code>}
                  {row.message_id && <code>message {row.message_id.slice(0, 8)}</code>}
                  {row.target_id && <code>{targetType} {row.target_id.slice(0, 8)}</code>}
                </div>
              </div>

              <div className="admin-report-actions">
                {row.status !== 'reviewing' && <button disabled={isBusy} onClick={() => updateStatus(row, 'reviewing')}>В работу</button>}
                {row.status !== 'resolved' && <button className="positive" disabled={isBusy} onClick={() => updateStatus(row, 'resolved')}>Решено</button>}
                {row.status !== 'rejected' && <button className="danger-ghost" disabled={isBusy} onClick={() => updateStatus(row, 'rejected')}>Отклонить</button>}
                {row.reported_user_id && <button disabled={isBusy} onClick={() => nav(`/u/${row.reported_user_id}`)}>Профиль</button>}
              </div>
            </article>
          );
        })}
      </main>
    </div>
  );
}
