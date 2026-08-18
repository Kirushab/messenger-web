// Челленджи — задания, которые каждый участник отмечает выполненными лично у себя.
// Создатель события (или canEdit) добавляет челленджи, любой участник может отметить «Выполнено».
// Виден общий прогресс: сколько участников выполнили каждое задание.
import { useEffect, useState } from 'react';
import {
  fetchBlockItems, addBlockItem, deleteBlockItem,
  fetchResponses, setResponse, removeResponse,
  type BlockItem, type BlockResponse,
} from '@/lib/eventBlocks';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import BlockShell from './BlockShell';
import { avatarColor } from '@/lib/utils';

interface Props { eventId: string; canEdit: boolean; }

interface ChallengeData {
  title: string;
  description?: string;
  points?: number;
}

export default function ChallengesBlock({ eventId, canEdit }: Props) {
  const [items, setItems] = useState<BlockItem[]>([]);
  const [responses, setResponses] = useState<BlockResponse[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { display_name: string; avatar_url: string | null }>>({});
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const myId = useAuthStore(s => s.session?.user?.id);

  const refresh = async () => {
    const its = await fetchBlockItems(eventId, 'challenges');
    setItems(its);
    if (its.length > 0) {
      const resps = await fetchResponses(its.map(i => i.id));
      setResponses(resps);
      // Подтянем профили выполнивших
      const userIds = Array.from(new Set(resps.map(r => r.user_id)));
      if (userIds.length > 0) {
        const { data } = await supabase
          .from('users')
          .select('id, display_name, avatar_url')
          .in('id', userIds);
        const map: Record<string, any> = {};
        (data || []).forEach((u: any) => { map[u.id] = u; });
        setProfiles(map);
      }
    } else {
      setResponses([]);
    }
    setLoading(false);
  };
  useEffect(() => { refresh(); }, [eventId]);

  const handleAdd = async () => {
    const t = title.trim();
    if (!t) return;
    const data: ChallengeData = { title: t };
    if (description.trim()) data.description = description.trim();
    const item = await addBlockItem(eventId, 'challenges', data);
    if (item) {
      setTitle(''); setDescription('');
      setAdding(false);
      refresh();
    }
  };

  const handleDelete = async (id: string) => {
    await deleteBlockItem(id);
    refresh();
  };

  const handleToggle = async (itemId: string, currentlyDone: boolean) => {
    if (!myId) return;
    if (currentlyDone) {
      await removeResponse(itemId, 'done');
    } else {
      await setResponse(itemId, 'done', { at: new Date().toISOString() });
    }
    refresh();
  };

  // Список моих выполненных
  const myDone = items.filter(it =>
    responses.some(r => r.item_id === it.id && r.user_id === myId && r.response_kind === 'done')
  );

  return (
    <BlockShell
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9l6 6 6-6"/>
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 2v4"/>
      </svg>}
      iconBg="#F59E0B"
      title="Челленджи"
      subtitle={myDone.length > 0 ? `Ты выполнил: ${myDone.length}` : `${items.length} ${items.length === 1 ? 'задание' : items.length < 5 ? 'задания' : 'заданий'}`}
      onAdd={canEdit && !adding ? () => setAdding(true) : undefined}
      addLabel="Челлендж"
    >
      {loading && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8 }}>Загрузка...</div>}
      {!loading && items.length === 0 && !adding && (
        <div style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--fs-label)' }}>
          Челленджей пока нет
        </div>
      )}

      {items.map(item => {
        const data = item.data as ChallengeData;
        const itemResponses = responses.filter(r => r.item_id === item.id && r.response_kind === 'done');
        const myResponse = itemResponses.find(r => r.user_id === myId);
        const isDone = !!myResponse;
        return (
          <div key={item.id} style={{
            padding: 12, marginBottom: 8, background: 'var(--bg)', borderRadius: 10,
            opacity: isDone ? 0.85 : 1,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <button
                onClick={() => handleToggle(item.id, isDone)}
                style={{
                  flexShrink: 0, marginTop: 1, width: 22, height: 22, borderRadius: 11,
                  background: isDone ? '#10B981' : 'transparent',
                  border: `2px solid ${isDone ? '#10B981' : 'var(--border)'}`,
                  cursor: 'pointer', padding: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 200ms, border-color 200ms',
                }}
                aria-label={isDone ? 'Отменить' : 'Выполнено'}
              >
                {isDone && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <div style={{
                    fontSize: 'var(--fs-snap14)', fontWeight: 600, color: 'var(--text)',
                    textDecoration: isDone ? 'line-through' : 'none',
                  }}>{data.title}</div>
                </div>
                {data.description && (
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 3 }}>
                    {data.description}
                  </div>
                )}
                {/* Кто выполнил — аватары */}
                {itemResponses.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                    {itemResponses.slice(0, 6).map(r => {
                      const u = profiles[r.user_id];
                      return u?.avatar_url ? (
                        <img key={r.user_id} src={u.avatar_url} alt="" style={{
                          width: 18, height: 18, borderRadius: 9, objectFit: 'cover',
                          border: '1.5px solid var(--surface-light)',
                        }} />
                      ) : (
                        <div key={r.user_id} style={{
                          width: 18, height: 18, borderRadius: 9, background: avatarColor(r.user_id),
                          color: '#fff', fontSize: 9, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: '1.5px solid var(--surface-light)',
                        }}>{(u?.display_name || '?')[0].toUpperCase()}</div>
                      );
                    })}
                    {itemResponses.length > 6 && (
                      <span style={{ fontSize: 'var(--fs-snap10)', color: 'var(--muted)', marginLeft: 2 }}>
                        +{itemResponses.length - 6}
                      </span>
                    )}
                    <span style={{ fontSize: 'var(--fs-snap10)', color: 'var(--muted)', marginLeft: 4 }}>
                      выполнили
                    </span>
                  </div>
                )}
              </div>
              {canEdit && (
                <button onClick={() => handleDelete(item.id)} aria-label="Удалить" style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--muted)', padding: 2, flexShrink: 0,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              )}
            </div>
          </div>
        );
      })}

      {adding && (
        <div style={{
          padding: 12, marginBottom: 8, background: 'var(--bg)',
          borderRadius: 10, border: '1px solid var(--primary)',
        }}>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Название челленджа"
            maxLength={120}
            autoFocus
            style={{
              width: '100%', padding: 8, marginBottom: 6,
              background: 'transparent', border: 'none', outline: 'none',
              fontSize: 'var(--fs-snap14)', color: 'var(--text)', fontWeight: 500,
              boxSizing: 'border-box',
            }}
          />
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Описание (необязательно)"
            maxLength={300}
            style={{
              width: '100%', padding: 8, marginBottom: 6,
              background: 'transparent', border: 'none', outline: 'none',
              fontSize: 'var(--fs-caption)', color: 'var(--muted)',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setAdding(false); setTitle(''); setDescription(''); }} style={{
              flex: 1, padding: 8, borderRadius: 8,
              background: 'var(--surface-light)', border: '1px solid var(--border)',
              color: 'var(--text)', fontSize: 'var(--fs-label)', cursor: 'pointer',
            }}>Отмена</button>
            <button onClick={handleAdd} disabled={!title.trim()} style={{
              flex: 1, padding: 8, borderRadius: 8,
              background: title.trim() ? 'var(--primary)' : 'var(--border)',
              color: title.trim() ? 'var(--bg)' : 'var(--muted)',
              border: 'none', fontSize: 'var(--fs-label)', fontWeight: 600,
              cursor: title.trim() ? 'pointer' : 'default',
            }}>Добавить</button>
          </div>
        </div>
      )}
    </BlockShell>
  );
}
