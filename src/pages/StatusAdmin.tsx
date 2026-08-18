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
  custom_status_text: string | null;
  custom_status_color: string | null;
  custom_status_emoji: string | null;
}

const STATUS_PRESETS = [
  { label: 'Чёртов диджей', color: '#A855F7', emoji: '🎧' },
  { label: 'Без понта', color: '#6B7280', emoji: '🥱' },
  { label: 'Топ', color: '#10B981', emoji: '👑' },
  { label: 'Ушёл в закат', color: '#F97316', emoji: '🌅' },
  { label: 'Влюблён', color: '#EC4899', emoji: '💘' },
  { label: 'В коме', color: '#1F2937', emoji: '💀' },
  { label: 'Шуткует', color: '#FACC15', emoji: '🤡' },
  { label: 'На спорте', color: '#3B82F6', emoji: '💪' },
];

const COLORS = ['#A855F7', '#EC4899', '#10B981', '#3B82F6', '#F97316', '#DC2626', '#FACC15', '#6B7280', '#1F2937'];

export default function StatusAdmin() {
  const nav = useNavigate();
  const { user } = useAuthStore();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('users')
      .select('id, display_name, email, avatar_url, custom_status_text, custom_status_color, custom_status_emoji')
      .order('display_name', { ascending: true });
    setUsers((data || []) as UserRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Только админ имеет доступ
  if (!isOwnerEmail(user?.email)) {
    return (
      <div style={{padding:40, textAlign:'center', color:'var(--muted)'}}>
        Доступ только для администратора.
      </div>
    );
  }

  const filtered = users.filter(u =>
    !search || (u.display_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{display:'flex', flexDirection:'column', height:'100%'}}>
      <div className="safe-top" style={{
        display:'flex', alignItems:'center', gap:12,
        padding:'12px 14px', borderBottom:'1px solid var(--border)', background:'var(--surface)',
      }}>
        <button onClick={() => nav(-1)} style={{
          width:36, height:36, borderRadius:18, border:'none',
          background:'var(--surface-light)', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{fontSize: 'var(--fs-heading)', fontWeight:600}}>Редактор статусов</div>
      </div>

      <div style={{padding:'12px 14px', borderBottom:'1px solid var(--border)'}}>
        <input
          type="text"
          placeholder="Поиск по имени..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width:'100%', padding:'10px 14px',
            background:'var(--surface-light)', border:'1px solid var(--border)',
            borderRadius:10, color:'var(--text)', fontSize: 'var(--fs-snap14)', outline:'none',
          }}
        />
      </div>

      <div className="page-scroll" style={{padding:'8px 0'}}>
        {loading && <div style={{padding:24, textAlign:'center'}}><div className="spinner" style={{margin:'0 auto'}} /></div>}
        {!loading && filtered.length === 0 && (
          <div style={{padding:40, textAlign:'center', color:'var(--muted)'}}>Никого не нашёл</div>
        )}
        {filtered.map(u => (
          <button
            key={u.id}
            onClick={() => setEditing(u)}
            style={{
              width:'100%', display:'flex', alignItems:'center', gap:12,
              padding:'10px 14px',
              background:'none', border:'none',
              borderBottom:'0.5px solid var(--border)',
              cursor:'pointer', textAlign:'left',
              color:'var(--text)',
            }}
          >
            {u.avatar_url
              ? <img src={u.avatar_url} alt="" style={{width:40, height:40, borderRadius:20, objectFit:'cover', flexShrink:0}} />
              : <div style={{
                  width:40, height:40, borderRadius:20,
                  background: avatarColor(u.id),
                  color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize: 'var(--fs-snap16)', fontWeight:600, flexShrink:0,
                }}>{(u.display_name || '?')[0]?.toUpperCase()}</div>
            }
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize: 'var(--fs-body)', fontWeight:500}}>{u.display_name}</div>
              {u.custom_status_text ? (
                <div style={{
                  display:'inline-flex', alignItems:'center', gap:4, marginTop:3,
                  padding:'2px 8px', borderRadius:10,
                  background: (u.custom_status_color || '#6B7280') + '22',
                  color: u.custom_status_color || '#6B7280',
                  fontSize: 'var(--fs-micro)', fontWeight:600,
                }}>
                  {u.custom_status_emoji && <span>{u.custom_status_emoji}</span>}
                  {u.custom_status_text}
                </div>
              ) : (
                <div style={{fontSize: 'var(--fs-caption)', color:'var(--muted)', marginTop:3}}>— без статуса</div>
              )}
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        ))}
      </div>

      {editing && (
        <StatusEditor
          userRow={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
            toast.success('Статус обновлён');
          }}
        />
      )}
    </div>
  );
}

function StatusEditor({ userRow, onClose, onSaved }: { userRow: UserRow; onClose: () => void; onSaved: () => void }) {
  const [text, setText] = useState(userRow.custom_status_text || '');
  const [emoji, setEmoji] = useState(userRow.custom_status_emoji || '');
  const [color, setColor] = useState(userRow.custom_status_color || COLORS[0]);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('users')
      .update({
        custom_status_text: text.trim() || null,
        custom_status_emoji: emoji.trim() || null,
        custom_status_color: text.trim() ? color : null,
      })
      .eq('id', userRow.id);
    setSaving(false);
    if (error) { toast.error('Ошибка: ' + error.message); return; }
    onSaved();
  };

  const clear = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('users')
      .update({
        custom_status_text: null,
        custom_status_emoji: null,
        custom_status_color: null,
      })
      .eq('id', userRow.id);
    setSaving(false);
    if (error) { toast.error('Ошибка: ' + error.message); return; }
    onSaved();
  };

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, zIndex:60,
      background:'rgba(0,0,0,0.5)',
      display:'flex', alignItems:'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width:'100%',
        background:'var(--surface)',
        borderRadius:'16px 16px 0 0',
        padding:'14px 16px max(20px, env(safe-area-inset-bottom, 20px))',
        maxHeight:'88vh', overflowY:'auto',
      }}>
        <div style={{display:'flex', justifyContent:'center', marginBottom:14}}>
          <div style={{width:36, height:4, borderRadius:2, background:'var(--border)'}} />
        </div>

        <div style={{fontSize: 'var(--fs-heading)', fontWeight:600, marginBottom:4}}>
          Статус для {userRow.display_name}
        </div>
        <div style={{fontSize: 'var(--fs-label)', color:'var(--muted)', marginBottom:18}}>
          Пресет или кастом — текст, эмодзи и цвет
        </div>

        {/* Превью */}
        <div style={{
          padding:'12px 14px',
          background:'var(--surface-light)',
          borderRadius:12,
          marginBottom:16,
          display:'flex', alignItems:'center', gap:10,
        }}>
          <span style={{fontSize: 'var(--fs-snap14)', color:'var(--muted)'}}>Превью:</span>
          {text ? (
            <span style={{
              display:'inline-flex', alignItems:'center', gap:5,
              padding:'4px 10px', borderRadius:12,
              background: color + '22', color,
              fontSize: 'var(--fs-label)', fontWeight:600,
            }}>
              {emoji && <span>{emoji}</span>}
              {text}
            </span>
          ) : <span style={{color:'var(--muted)', fontSize: 'var(--fs-label)'}}>— пусто</span>}
        </div>

        {/* Пресеты */}
        <div style={{fontSize: 'var(--fs-caption)', fontWeight:600, color:'var(--muted)', marginBottom:8, textTransform:'uppercase', letterSpacing:0.4}}>
          Готовые
        </div>
        <div style={{display:'flex', flexWrap:'wrap', gap:6, marginBottom:18}}>
          {STATUS_PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => { setText(p.label); setEmoji(p.emoji); setColor(p.color); }}
              style={{
                padding:'6px 10px', borderRadius:14,
                background: p.color + '22', border: `1px solid ${p.color}55`,
                color: p.color, fontSize: 'var(--fs-caption)', fontWeight:600,
                cursor:'pointer', display:'flex', alignItems:'center', gap:4,
              }}
            >
              <span>{p.emoji}</span>{p.label}
            </button>
          ))}
        </div>

        {/* Текст */}
        <div style={{fontSize: 'var(--fs-caption)', fontWeight:600, color:'var(--muted)', marginBottom:6, textTransform:'uppercase', letterSpacing:0.4}}>
          Текст
        </div>
        <input
          value={text}
          onChange={e => setText(e.target.value.slice(0, 40))}
          placeholder="Чёртов диджей"
          maxLength={40}
          style={{
            width:'100%', padding:'10px 14px',
            background:'var(--surface-light)', border:'1px solid var(--border)',
            borderRadius:10, color:'var(--text)', fontSize: 'var(--fs-snap14)', outline:'none',
            marginBottom:14,
          }}
        />

        {/* Эмодзи */}
        <div style={{fontSize: 'var(--fs-caption)', fontWeight:600, color:'var(--muted)', marginBottom:6, textTransform:'uppercase', letterSpacing:0.4}}>
          Эмодзи (1 символ)
        </div>
        <input
          value={emoji}
          onChange={e => setEmoji([...e.target.value].slice(0, 2).join(''))}
          placeholder="🎧"
          style={{
            width:'100%', padding:'10px 14px',
            background:'var(--surface-light)', border:'1px solid var(--border)',
            borderRadius:10, color:'var(--text)', fontSize: 'var(--fs-heading)', outline:'none',
            textAlign:'center',
            marginBottom:14,
          }}
        />

        {/* Цвет */}
        <div style={{fontSize: 'var(--fs-caption)', fontWeight:600, color:'var(--muted)', marginBottom:6, textTransform:'uppercase', letterSpacing:0.4}}>
          Цвет
        </div>
        <div style={{display:'flex', gap:8, marginBottom:18, flexWrap:'wrap'}}>
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{
                width:36, height:36, borderRadius:18,
                background:c,
                border: color === c ? '3px solid var(--text)' : '2px solid transparent',
                cursor:'pointer',
                flexShrink:0,
              }}
              aria-label={c}
            />
          ))}
        </div>

        <div style={{display:'flex', gap:8}}>
          <button
            onClick={clear}
            disabled={saving}
            style={{
              flex:1, padding:'12px',
              background:'var(--surface-light)', border:'1px solid var(--border)',
              borderRadius:10, color:'var(--danger)',
              fontSize: 'var(--fs-snap14)', fontWeight:600, cursor:'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            Очистить
          </button>
          <button
            onClick={save}
            disabled={saving}
            style={{
              flex:2, padding:'12px',
              background:'var(--accent)', border:'none',
              borderRadius:10, color:'var(--bg)',
              fontSize: 'var(--fs-snap14)', fontWeight:600, cursor:'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Сохраняю...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
