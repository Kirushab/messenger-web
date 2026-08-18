import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { isOwnerEmail } from '@/lib/admin';
import { toast } from '@/stores/toastStore';
import { avatarColor } from '@/lib/utils';

interface UserRow {
  id: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  fedya_access: boolean;
  tinder_access: boolean;
  voice_fx_access: boolean;
  encrypted_chat_access: boolean;
  gmat_access: boolean;
  notes_access: boolean;
}


// Список фичей с флагами доступа. Расширяется без правки кода тоглов.
const FEATURES = [
  { key: 'fedya_access',  label: 'Для Феди', short: 'Феди',  color: '#8B5CF6' },
  { key: 'tinder_access', label: 'Тиндер',   short: 'Тиндер', color: '#EC4899' },
  { key: 'voice_fx_access', label: 'Эффекты голоса', short: 'Голос', color: '#A855F7' },
  { key: 'encrypted_chat_access', label: 'Защищённые чаты', short: 'Защита', color: '#14B8A6' },
  { key: 'gmat_access', label: 'Тест MBA / GMAT', short: 'GMAT', color: '#7C3AED' },
  { key: 'notes_access', label: 'Ноты', short: 'Ноты', color: '#3B82F6' },
] as const;
type FeatureKey = typeof FEATURES[number]['key'];

export default function AdminAccess() {
  const nav = useNavigate();
  const { user } = useAuthStore();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (user && !isOwnerEmail(user.email)) {
      nav(-1);
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, display_name, email, avatar_url, fedya_access, tinder_access, voice_fx_access, encrypted_chat_access, gmat_access, notes_access')
          .order('display_name', { ascending: true });
        if (error) {
          console.error('AdminAccess load:', error);
          toast.error('Ошибка: ' + error.message);
        } else {
          setRows((data || []) as UserRow[]);
        }
      } catch (e: any) {
        console.error('AdminAccess load (exception):', e);
        toast.error('Ошибка: ' + (e?.message || 'не удалось загрузить'));
      } finally {
        setLoading(false);
      }
    })();
  }, [user, nav]);

  const handleToggle = async (id: string, feature: FeatureKey, current: boolean) => {
    const next = !current;
    setRows(prev => prev.map(r => r.id === id ? { ...r, [feature]: next } : r));
    const { error } = await supabase
      .from('users')
      .update({ [feature]: next })
      .eq('id', id);
    if (error) {
      setRows(prev => prev.map(r => r.id === id ? { ...r, [feature]: current } : r));
      toast.error('Ошибка: ' + error.message);
    }
  };

  const filtered = search.trim()
    ? rows.filter(r =>
        (r.display_name || '').toLowerCase().includes(search.toLowerCase())
        || (r.email || '').toLowerCase().includes(search.toLowerCase())
      )
    : rows;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header className="safe-top" style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)',
      }}>
        <button onClick={() => nav(-1)} style={{
          width: 36, height: 36, borderRadius: 18, border: 'none',
          background: 'var(--surface-light)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div>
          <div style={{ fontSize: 'var(--fs-snap16)', fontWeight: 600, color: 'var(--text)' }}>Доступы</div>
          <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)' }}>
            Управление видимостью фичей
          </div>
        </div>
      </header>

      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по имени или email"
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 14,
            background: 'var(--surface-light)', border: '1px solid var(--border)',
            color: 'var(--text)', fontSize: 'var(--fs-label)', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Шапка таблицы с названиями фичей */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px 6px',
        fontSize: 'var(--fs-snap10)', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase',
      }}>
        <div style={{ flex: 1 }}>Юзер</div>
        {FEATURES.map(f => (
          <div key={f.key} style={{ width: 56, textAlign: 'center' }}>{f.short}</div>
        ))}
      </div>

      <div className="page-scroll" style={{ padding: '0 0 24px' }}>
        {loading && <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 32, fontSize: 'var(--fs-label)' }}>Загрузка...</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 32, fontSize: 'var(--fs-label)' }}>
            {rows.length === 0 ? 'Примените миграции доступа, включая 178_learning_feature_access.sql' : 'Никого не найдено'}
          </div>
        )}
        {filtered.map(r => (
          <div key={r.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px',
            borderBottom: '0.5px solid var(--border)',
          }}>
            {r.avatar_url ? (
              <img src={r.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: 18, objectFit: 'cover', flexShrink: 0 }}/>
            ) : (
              <div style={{
                width: 36, height: 36, borderRadius: 18,
                background: avatarColor(r.id), color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 'var(--fs-label)', fontWeight: 700, flexShrink: 0,
              }}>{(r.display_name || '?').charAt(0).toUpperCase()}</div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--fs-snap14)', color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.display_name || '—'}
              </div>
              {r.email && (
                <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.email}
                </div>
              )}
            </div>
            {FEATURES.map(f => {
              const active = (r as any)[f.key];
              return (
                <button
                  key={f.key}
                  onClick={() => handleToggle(r.id, f.key, active)}
                  role="switch"
                  aria-checked={active}
                  style={{
                    width: 44, height: 26, borderRadius: 14,
                    background: active ? f.color : 'var(--border)',
                    border: 'none', cursor: 'pointer',
                    position: 'relative',
                    transition: 'background 200ms',
                    flexShrink: 0,
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    top: 2, left: active ? 20 : 2,
                    width: 22, height: 22, borderRadius: 11,
                    background: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    transition: 'left 200ms',
                  }}/>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
