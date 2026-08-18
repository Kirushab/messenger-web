import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { isOwnerEmail } from '@/lib/admin';
import { haptic } from '@/lib/haptics';

interface ConsoleItem {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  to: string;
  danger?: boolean;
}

const icon = (path: ReactNode) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{path}</svg>
);

const ITEMS: ConsoleItem[] = [
  {
    id: 'users', title: 'Пользователи', description: 'Заявки, блокировки и удаление аккаунтов', to: '/admin/users',
    icon: icon(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></>),
  },
  {
    id: 'reports', title: 'Жалобы', description: 'Новые обращения и решения модерации', to: '/admin/reports',
    icon: icon(<><path d="M5 3v18"/><path d="M5 4h11l-2 4 2 4H5"/></>),
  },
  {
    id: 'feedback', title: 'Идеи и баги', description: 'Предложения, пожелания и сообщения о проблемах', to: '/admin/feedback',
    icon: icon(<><path d="M12 3 14.3 8.7 20 11l-5.7 2.3L12 19l-2.3-5.7L4 11l5.7-2.3L12 3Z"/><path d="M19 3v4M17 5h4"/></>),
  },
  {
    id: 'status', title: 'Статусы', description: 'Системные статусы и действия администратора', to: '/status-admin',
    icon: icon(<><path d="M12 3 4 7v5c0 5 3.4 8.1 8 9 4.6-.9 8-4 8-9V7l-8-4Z"/><path d="m9 12 2 2 4-5"/></>),
  },
  {
    id: 'access', title: 'Доступы', description: 'Флаги функций и скрытые разделы', to: '/admin/access',
    icon: icon(<><rect x="3" y="11" width="18" height="10" rx="3"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></>),
  },
  {
    id: 'diag', title: 'Диагностика', description: 'Healthcheck, события и отчёты об ошибках', to: '/diag',
    icon: icon(<path d="M3 12h4l2.3-7 4.4 14 2.3-7h5"/>),
  },
  {
    id: 'storage', title: 'Хранилище', description: 'Таблицы, бакеты и состояние Supabase', to: '/storage-admin',
    icon: icon(<><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></>),
  },
  {
    id: 'media-cleanup', title: 'Чистка медиа', description: 'Удаление лишних файлов и превью', to: '/admin/media-cleanup', danger: true,
    icon: icon(<><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/></>),
  },
  {
    id: 'admin-data', title: 'Истории и медиа', description: 'Архив историй, вложений и публикаций', to: '/admin/data',
    icon: icon(<><path d="M4 4h16v16H4z"/><circle cx="9" cy="9" r="1.5"/><path d="m5 17 4-4 3 3 2-2 5 5"/></>),
  },
];

export default function Apps() {
  const nav = useNavigate();
  const { user } = useAuthStore();
  const allowed = isOwnerEmail(user?.email);

  return (
    <div className="console-v334">
      <header className="console-header page-header">
        <button className="console-back" onClick={() => nav('/profile')} aria-label="Назад в настройки">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div>
          <h1>Консоль</h1>
          <p>Управление Sigmas</p>
        </div>
        {allowed && <span className="console-owner-badge">Owner</span>}
      </header>

      <main className="console-scroll page-scroll">
        {!allowed ? (
          <section className="console-locked-card">
            <span>{icon(<><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>)}</span>
            <h2>Консоль недоступна</h2>
            <p>Этот раздел видит только владелец проекта.</p>
          </section>
        ) : (
          <>
            <section className="console-summary-card">
              <div className="console-summary-mark">{icon(<path d="M4 16V8M9 19V5M14 15V9M19 20V4"/>)}</div>
              <div><h2>Панель управления</h2><p>Заявки пользователей, модерация и технические инструменты в одном месте.</p></div>
            </section>
            <section className="console-grid">
              {ITEMS.map(item => (
                <button key={item.id} className={`console-tile ${item.danger ? 'danger' : ''}`} onClick={() => { haptic.tap(); nav(item.to); }}>
                  <span className="console-tile-icon">{item.icon}</span>
                  <span className="console-tile-copy"><b>{item.title}</b><small>{item.description}</small></span>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>
              ))}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
