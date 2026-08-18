import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { avatarColor } from '@/lib/utils';
import { isOwnerEmail } from '@/lib/admin';
import { haptic } from '@/lib/haptics';

type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'blocked' | 'deleted';
type AdminAction = 'approve' | 'reject' | 'block' | 'unblock' | 'soft_delete' | 'restore' | 'hard_delete';

interface ConsoleUser {
  id: string;
  email: string | null;
  auth_email?: string | null;
  display_name: string;
  avatar_url: string | null;
  status: string | null;
  created_at: string;
  approval_status: ApprovalStatus;
  blocked_at: string | null;
  blocked_reason: string | null;
  deleted_at: string | null;
  last_sign_in_at?: string | null;
  email_confirmed_at?: string | null;
  banned_until?: string | null;
  role?: string | null;
  profile_missing?: boolean;
}

const FILTERS: { id: 'all' | ApprovalStatus; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'pending', label: 'Заявки' },
  { id: 'approved', label: 'Активные' },
  { id: 'blocked', label: 'Заблокированные' },
  { id: 'deleted', label: 'Удалённые' },
  { id: 'rejected', label: 'Отклонённые' },
];

const STATUS_TEXT: Record<ApprovalStatus, string> = {
  pending: 'Ожидает решения',
  approved: 'Активен',
  rejected: 'Заявка отклонена',
  blocked: 'Заблокирован',
  deleted: 'Удалён',
};

export default function AdminUsers() {
  const nav = useNavigate();
  const { user } = useAuthStore();
  const [rows, setRows] = useState<ConsoleUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | ApprovalStatus>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ user: ConsoleUser; action: AdminAction } | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (user && !isOwnerEmail(user.email)) nav(-1);
  }, [user, nav]);

  const invoke = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('admin-users', { body });
    if (error) {
      let message = error.message;
      try { const payload = await (error as any).context?.clone?.().json(); if (payload?.error) message = payload.error; } catch {}
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoke({ action: 'list' });
      setRows((data?.users || []) as ConsoleUser[]);
    } catch (error: any) {
      toast.error('Не удалось загрузить пользователей: ' + (error?.message || 'ошибка'));
    } finally {
      setLoading(false);
    }
  }, [invoke]);

  useEffect(() => { load(); }, [load]);

  const runAction = async () => {
    if (!confirm) return;
    const { user: target, action } = confirm;
    setBusyId(target.id);
    try {
      await invoke({ action, userId: target.id, reason: reason.trim() || null });
      toast.success(action === 'approve' ? 'Заявка одобрена' : action === 'hard_delete' ? 'Пользователь удалён навсегда' : action === 'soft_delete' ? 'Пользователь удалён' : 'Готово');
      setConfirm(null);
      setReason('');
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось выполнить действие');
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(row => {
      if (filter !== 'all' && row.approval_status !== filter) return false;
      if (!q) return true;
      return (row.display_name || '').toLowerCase().includes(q)
        || (row.auth_email || row.email || '').toLowerCase().includes(q)
        || row.id.toLowerCase().includes(q);
    });
  }, [rows, search, filter]);

  const counts = useMemo(() => rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.approval_status] = (acc[row.approval_status] || 0) + 1;
    return acc;
  }, {}), [rows]);

  return (
    <div className="admin-users-page">
      <header className="admin-users-header safe-top-sm">
        <button className="admin-back" onClick={() => nav(-1)} aria-label="Назад">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div><h1>Пользователи</h1><p>Заявки, блокировки и удаление аккаунтов</p></div>
        <button className="admin-refresh" onClick={() => { haptic.tap(); load(); }} disabled={loading} aria-label="Обновить">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M20 11a8 8 0 1 0 2 5.3"/><path d="M20 4v7h-7"/></svg>
        </button>
      </header>

      <div className="admin-users-toolbar">
        <label className="admin-users-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Имя, email или ID" />
          {search && <button onClick={() => setSearch('')}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>}
        </label>
        <div className="admin-users-filters">
          {FILTERS.map(item => (
            <button key={item.id} className={filter === item.id ? 'active' : ''} onClick={() => { haptic.select(); setFilter(item.id); }}>
              {item.label}{item.id !== 'all' && counts[item.id] ? <span>{counts[item.id]}</span> : null}
            </button>
          ))}
        </div>
      </div>

      <main className="admin-users-list page-scroll">
        {loading && <div className="admin-users-loading"><span className="spinner"/><p>Загружаю пользователей</p></div>}
        {!loading && filtered.length === 0 && <div className="admin-users-empty">Ничего не найдено</div>}
        {!loading && filtered.map(row => {
          const email = row.auth_email || row.email || 'Email не указан';
          const isBusy = busyId === row.id;
          return (
            <article key={row.id} className="admin-user-card">
              <div className="admin-user-main">
                {row.avatar_url
                  ? <img src={row.avatar_url} alt="" />
                  : <span className="admin-user-avatar" style={{ background: avatarColor(row.id) }}>{(row.display_name || '?')[0].toUpperCase()}</span>}
                <div className="admin-user-copy">
                  <div className="admin-user-name-line">
                    <h2>{row.display_name || 'Без имени'}</h2>
                    {row.role && <span className="admin-role">{row.role}</span>}
                    {row.profile_missing && <span className="admin-role warning">нет профиля</span>}
                  </div>
                  <p>{email}</p>
                  <small>Создан {new Date(row.created_at).toLocaleDateString('ru-RU')} · {row.last_sign_in_at ? `вход ${new Date(row.last_sign_in_at).toLocaleDateString('ru-RU')}` : 'ещё не входил'}</small>
                </div>
                <span className={`admin-status ${row.approval_status}`}>{STATUS_TEXT[row.approval_status]}</span>
              </div>

              {(row.blocked_reason || row.deleted_at) && (
                <div className="admin-user-note">{row.blocked_reason || `Удалён ${new Date(row.deleted_at!).toLocaleString('ru-RU')}`}</div>
              )}

              {!row.role && (
                <div className="admin-user-actions">
                  {row.approval_status === 'pending' && <>
                    <button className="positive" disabled={isBusy} onClick={() => setConfirm({ user: row, action: 'approve' })}>Принять</button>
                    <button disabled={isBusy} onClick={() => setConfirm({ user: row, action: 'reject' })}>Отклонить</button>
                  </>}
                  {row.approval_status === 'approved' && <button disabled={isBusy} onClick={() => setConfirm({ user: row, action: 'block' })}>Заблокировать</button>}
                  {['blocked', 'rejected'].includes(row.approval_status) && <button className="positive" disabled={isBusy} onClick={() => setConfirm({ user: row, action: 'unblock' })}>Разблокировать</button>}
                  {row.approval_status === 'deleted' && <>
                    <button className="positive" disabled={isBusy} onClick={() => setConfirm({ user: row, action: 'restore' })}>Восстановить</button>
                    <button className="danger" disabled={isBusy} onClick={() => setConfirm({ user: row, action: 'hard_delete' })}>Удалить навсегда</button>
                  </>}
                  {row.approval_status !== 'deleted' && <button className="danger" disabled={isBusy} onClick={() => setConfirm({ user: row, action: 'soft_delete' })}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>
                    Удалить
                  </button>}
                </div>
              )}
            </article>
          );
        })}
      </main>

      {confirm && (
        <div className="admin-confirm-overlay" onClick={() => setConfirm(null)}>
          <div className="admin-confirm-card" onClick={e => e.stopPropagation()}>
            <div className={`admin-confirm-icon ${['soft_delete','block','reject'].includes(confirm.action) ? 'danger' : ''}`}>
              {confirm.action === 'soft_delete'
                ? <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>
                : <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 17h.01"/></svg>}
            </div>
            <h2>{actionTitle(confirm.action)}</h2>
            <p><b>{confirm.user.display_name}</b><br/>{confirm.user.auth_email || confirm.user.email}</p>
            {['soft_delete','hard_delete','block','reject'].includes(confirm.action) && (
              <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Причина — необязательно" maxLength={500} />
            )}
            {confirm.action === 'soft_delete' && <small>Аккаунт будет заблокирован и скрыт, но сообщения сохранят автора. Его можно восстановить из этого раздела.</small>}
            {confirm.action === 'hard_delete' && <small className="admin-confirm-warning">Это действие необратимо. Оно доступно после мягкого удаления и может не выполниться, если у аккаунта остался связанный контент.</small>}
            <div className="admin-confirm-actions">
              <button onClick={() => { setConfirm(null); setReason(''); }}>Отмена</button>
              <button className={['soft_delete','hard_delete','block','reject'].includes(confirm.action) ? 'danger' : 'positive'} onClick={runAction} disabled={!!busyId}>
                {busyId ? 'Подождите…' : actionButton(confirm.action)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function actionTitle(action: AdminAction) {
  if (action === 'approve') return 'Принять заявку?';
  if (action === 'reject') return 'Отклонить заявку?';
  if (action === 'block') return 'Заблокировать пользователя?';
  if (action === 'unblock') return 'Разблокировать пользователя?';
  if (action === 'restore') return 'Восстановить пользователя?';
  if (action === 'hard_delete') return 'Удалить навсегда?';
  return 'Удалить пользователя?';
}

function actionButton(action: AdminAction) {
  if (action === 'approve') return 'Принять';
  if (action === 'reject') return 'Отклонить';
  if (action === 'block') return 'Заблокировать';
  if (action === 'unblock') return 'Разблокировать';
  if (action === 'restore') return 'Восстановить';
  if (action === 'hard_delete') return 'Удалить навсегда';
  return 'Удалить';
}
