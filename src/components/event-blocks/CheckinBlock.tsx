import { useEffect, useState } from 'react';
import { fetchBlockItems, addBlockItem, fetchResponses, setResponse, removeResponse, type BlockItem, type BlockResponse } from '@/lib/eventBlocks';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import BlockShell from './BlockShell';

interface Props { eventId: string; canEdit: boolean; }

export default function CheckinBlock({ eventId, canEdit }: Props) {
  const [item, setItem] = useState<BlockItem | null>(null);
  const [responses, setResponses] = useState<BlockResponse[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { display_name: string; avatar_url?: string }>>({});
  const [loading, setLoading] = useState(true);
  const myId = useAuthStore(s => s.session?.user?.id);

  useEffect(() => {
    (async () => {
      const its = await fetchBlockItems(eventId, 'checkin');
      let mainItem: BlockItem | null = its[0] || null;
      // Если нет item — создаём один синтетический (singleton)
      if (!mainItem && canEdit) {
        mainItem = await addBlockItem(eventId, 'checkin', { singleton: true });
      }
      setItem(mainItem);
      if (mainItem) {
        const resps = await fetchResponses([mainItem.id]);
        setResponses(resps);
        const ids = resps.map(r => r.user_id);
        if (ids.length > 0) {
          const { data } = await supabase.from('users').select('id,display_name,avatar_url').in('id', ids);
          if (data) setProfiles(Object.fromEntries(data.map((u: any) => [u.id, u])));
        }
      }
      setLoading(false);
    })();
  }, [eventId, canEdit]);

  const handleCheckin = async () => {
    if (!item || !myId) return;
    const mine = responses.find(r => r.user_id === myId && r.response_kind === 'checked_in');
    if (mine) {
      if (await removeResponse(item.id, 'checked_in')) {
        setResponses(prev => prev.filter(r => r.id !== mine.id));
      }
    } else {
      // Пробуем взять геолокацию
      const useGeo = (lat: number, lng: number) => setResponse(item.id, 'checked_in', { lat, lng });
      const noGeo = () => setResponse(item.id, 'checked_in');
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            await useGeo(pos.coords.latitude, pos.coords.longitude);
            const updated = await fetchResponses([item.id]);
            setResponses(updated);
            const ids = updated.map(r => r.user_id);
            const { data } = await supabase.from('users').select('id,display_name,avatar_url').in('id', ids);
            if (data) setProfiles(Object.fromEntries(data.map((u: any) => [u.id, u])));
          },
          async () => {
            await noGeo();
            const updated = await fetchResponses([item.id]);
            setResponses(updated);
          },
          { timeout: 5000 }
        );
      } else {
        await noGeo();
        const updated = await fetchResponses([item.id]);
        setResponses(updated);
      }
    }
  };

  const iAmHere = responses.some(r => r.user_id === myId);

  return (
    <BlockShell
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>}
      iconBg="#EF4444"
      title="Чек-ин «я на месте»"
      subtitle={responses.length > 0 ? `${responses.length} прибыли` : 'Отметьтесь когда придёте'}
    >
      {loading && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8 }}>Загрузка...</div>}
      {!loading && item && (
        <>
          <button onClick={handleCheckin} style={{
            width: '100%', padding: '12px', marginBottom: 8,
            borderRadius: 10,
            background: iAmHere ? '#10B981' : 'var(--primary)',
            color: 'var(--bg)', border: 'none',
            fontSize: 'var(--fs-snap14)', fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            {iAmHere ? '✓ Вы на месте · отменить' : 'Я на месте'}
          </button>
          {responses.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {responses.map(r => {
                const p = profiles[r.user_id];
                return (
                  <div key={r.id} style={{
                    display:'flex', alignItems:'center', gap: 6,
                    padding: '4px 10px 4px 4px', borderRadius: 16,
                    background: 'var(--bg)',
                  }}>
                    {p?.avatar_url ? (
                      <img src={p.avatar_url} alt="" style={{ width: 22, height: 22, borderRadius: 11, objectFit: 'cover' }}/>
                    ) : (
                      <div style={{
                        width: 22, height: 22, borderRadius: 11,
                        background: 'var(--primary)', color: 'var(--bg)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 'var(--fs-snap10)', fontWeight: 700,
                      }}>{(p?.display_name || '?').charAt(0).toUpperCase()}</div>
                    )}
                    <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text)' }}>{p?.display_name || '...'}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </BlockShell>
  );
}
