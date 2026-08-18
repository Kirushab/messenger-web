import { useEffect, useState } from 'react';
import { fetchBlockItems, addBlockItem, fetchResponses, setResponse, type BlockItem, type BlockResponse } from '@/lib/eventBlocks';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import BlockShell from './BlockShell';

interface Props { eventId: string; canEdit: boolean; }

export default function PreferencesBlock({ eventId, canEdit }: Props) {
  const [item, setItem] = useState<BlockItem | null>(null);
  const [responses, setResponses] = useState<BlockResponse[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { display_name: string }>>({});
  const [editing, setEditing] = useState(false);
  const [drinks, setDrinks] = useState('');
  const [food, setFood] = useState('');
  const [allergies, setAllergies] = useState('');
  const [loading, setLoading] = useState(true);
  const myId = useAuthStore(s => s.session?.user?.id);

  useEffect(() => {
    (async () => {
      const its = await fetchBlockItems(eventId, 'preferences');
      let mainItem: BlockItem | null = its[0] || null;
      if (!mainItem && canEdit) {
        mainItem = await addBlockItem(eventId, 'preferences', { singleton: true });
      }
      setItem(mainItem);
      if (mainItem) {
        const resps = await fetchResponses([mainItem.id]);
        setResponses(resps);
        const ids = resps.map(r => r.user_id);
        if (ids.length > 0) {
          const { data } = await supabase.from('users').select('id,display_name').in('id', ids);
          if (data) setProfiles(Object.fromEntries(data.map((u: any) => [u.id, { display_name: u.display_name }])));
        }
        const mine = resps.find(r => r.user_id === myId);
        if (mine?.data) {
          setDrinks(mine.data.drinks || '');
          setFood(mine.data.food || '');
          setAllergies(mine.data.allergies || '');
        }
      }
      setLoading(false);
    })();
  }, [eventId, canEdit, myId]);

  const handleSave = async () => {
    if (!item) return;
    if (await setResponse(item.id, 'preference', { drinks: drinks.trim(), food: food.trim(), allergies: allergies.trim() })) {
      const updated = await fetchResponses([item.id]);
      setResponses(updated);
      const ids = updated.map(r => r.user_id);
      const { data } = await supabase.from('users').select('id,display_name').in('id', ids);
      if (data) setProfiles(Object.fromEntries(data.map((u: any) => [u.id, { display_name: u.display_name }])));
      setEditing(false);
    }
  };

  const myResponse = responses.find(r => r.user_id === myId);

  return (
    <BlockShell
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M8 21h8M12 17v4M5 3h14l-1 12H6L5 3zM4 7h16"/></svg>}
      iconBg="#BE185D"
      title="Что пьёте / едите"
      subtitle={responses.length > 0 ? `${responses.length} ответили` : 'Поделитесь предпочтениями'}
    >
      {loading && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8 }}>Загрузка...</div>}
      {!loading && item && (
        <>
          {!editing && (
            <button onClick={() => setEditing(true)} style={{
              width:'100%', padding: 10, marginBottom: 8, borderRadius: 8,
              background: myResponse ? 'var(--surface-light)' : 'var(--primary)',
              color: myResponse ? 'var(--text)' : 'var(--bg)',
              border: 'none', fontSize: 'var(--fs-label)', fontWeight: 600, cursor: 'pointer',
            }}>{myResponse ? 'Изменить мои предпочтения' : '+ Указать мои предпочтения'}</button>
          )}
          {editing && (
            <div style={{ padding: 4, marginBottom: 8, display:'flex', flexDirection:'column', gap: 6 }}>
              <input value={drinks} onChange={e => setDrinks(e.target.value)} placeholder="🍷 Напитки (вино, пиво, не пью)" style={inputStyle}/>
              <input value={food} onChange={e => setFood(e.target.value)} placeholder="🍽️ Еда (веган, мясо, без свинины)" style={inputStyle}/>
              <input value={allergies} onChange={e => setAllergies(e.target.value)} placeholder="⚠️ Аллергии (орехи, лактоза)" style={inputStyle}/>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={() => setEditing(false)} style={cancelBtn}>Отмена</button>
                <button onClick={handleSave} style={saveBtn}>Сохранить</button>
              </div>
            </div>
          )}
          {responses.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap: 6 }}>
              {responses.map(r => (
                <div key={r.id} style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: 8, fontSize: 'var(--fs-caption)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{profiles[r.user_id]?.display_name || '...'}</div>
                  {r.data?.drinks && <div style={{ color: 'var(--muted)' }}>🍷 {r.data.drinks}</div>}
                  {r.data?.food && <div style={{ color: 'var(--muted)' }}>🍽️ {r.data.food}</div>}
                  {r.data?.allergies && <div style={{ color: 'var(--muted)' }}>⚠️ {r.data.allergies}</div>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </BlockShell>
  );
}

const inputStyle: React.CSSProperties = { width:'100%',padding:10,borderRadius:8,border:'1px solid var(--border)',background:'var(--bg)',color:'var(--text)',fontSize: 'var(--fs-label)' };
const cancelBtn: React.CSSProperties = { flex:1,padding:8,borderRadius:8,background:'var(--surface-light)',border:'1px solid var(--border)',color:'var(--text)',fontSize: 'var(--fs-label)',cursor:'pointer' };
const saveBtn: React.CSSProperties = { flex:1,padding:8,borderRadius:8,background:'var(--primary)',color:'var(--bg)',border:'none',fontSize: 'var(--fs-label)',fontWeight:600,cursor:'pointer' };
