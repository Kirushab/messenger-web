import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/stores/toastStore';
import { User } from '@/types';

const COLORS = [
  { name: 'Белый', value: '#FFFFFF' },
  { name: 'Красный', value: '#FF4444' },
  { name: 'Оранжевый', value: '#FF8800' },
  { name: 'Жёлтый', value: '#FFD700' },
  { name: 'Зелёный', value: '#22CC66' },
  { name: 'Голубой', value: '#00AAFF' },
  { name: 'Фиолетовый', value: '#9966FF' },
  { name: 'Розовый', value: '#FF66AA' },
];

const EMOJIS = ['⭐','🔥','💎','👑','🚀','⚡','🎯','🏆','💯','🎉','❤️','💀','🤡','🎭','🎪','✨','🌟','💫','🌈','🎨','🎮','🎲','🧿','🔮','⚔️','🛡️','🗿','👻','😎','🤖','🦄','🐉'];

export default function AdminStatusPanel({ onClose }: { onClose: () => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [statusText, setStatusText] = useState('');
  const [statusColor, setStatusColor] = useState<string>('#FFD700');
  const [statusEmoji, setStatusEmoji] = useState<string>('⭐');
  const [saving, setSaving] = useState(false);

  // Загружаем всех пользователей
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('users').select('*').order('display_name');
      setUsers((data as User[]) || []);
    })();
  }, []);

  // При выборе пользователя — подтягиваем его текущий статус
  useEffect(() => {
    if (!selectedUser) return;
    setStatusText(selectedUser.custom_status_text || '');
    setStatusColor(selectedUser.custom_status_color || '#FFD700');
    setStatusEmoji(selectedUser.custom_status_emoji || '⭐');
  }, [selectedUser?.id]);

  const filtered = users.filter(u =>
    u.display_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const save = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('users').update({
        custom_status_text: statusText.trim() || null,
        custom_status_color: statusText.trim() ? statusColor : null,
        custom_status_emoji: statusText.trim() ? statusEmoji : null,
      }).eq('id', selectedUser.id);
      if (error) {
        toast.error('Ошибка: ' + error.message + '\n\nПроверь что миграция 012_custom_status.sql применена в Supabase.');
      } else {
        onClose();
      }
    } catch (e: any) {
      toast.error('Ошибка: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const clearStatus = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      await supabase.from('users').update({
        custom_status_text: null,
        custom_status_color: null,
        custom_status_emoji: null,
      }).eq('id', selectedUser.id);
      onClose();
    } catch (e: any) {
      toast.error('Ошибка: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{position:'fixed',inset:0,background:'var(--overlay)',zIndex:600,display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:'var(--surface)',
        borderRadius:'16px 16px 0 0',
        width:'100%',
        maxWidth:500,
        maxHeight:'90dvh',
        display:'flex',
        flexDirection:'column',
        paddingBottom:'env(safe-area-inset-bottom,0)',
        border:'1px solid var(--border)',
        animation:'slideUp .25s ease',
      }}>
        {/* Header */}
        <div style={{padding:'16px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div style={{fontSize: 'var(--fs-snap16)',fontWeight:600,color:'var(--text)'}}>Админ-панель</div>
            <div style={{fontSize: 'var(--fs-caption)',color:'var(--muted)',marginTop:2}}>Раздача статусов</div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',padding:6,color:'var(--text)'}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'14px 20px 20px'}}>
          {/* User picker */}
          {!selectedUser ? (
            <>
              <div style={{fontSize: 'var(--fs-caption)',color:'var(--muted)',marginBottom:8,textTransform:'uppercase',letterSpacing:0.5,fontWeight:600}}>Выберите пользователя</div>
              <input
                placeholder="Поиск по имени или email..."
                value={search}
                onChange={e=>setSearch(e.target.value)}
                autoFocus
                style={{width:'100%',padding:12,background:'var(--bg)',border:'1px solid var(--border)',borderRadius:10,color:'var(--text)',fontSize: 'var(--fs-snap14)',marginBottom:10,outline:'none'}}
              />
              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                {filtered.map(u => (
                  <div key={u.id} onClick={()=>setSelectedUser(u)} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',cursor:'pointer',borderRadius:8,background:'var(--bg)'}}>
                    {u.avatar_url
                      ? <img src={u.avatar_url} alt="" style={{width:36,height:36,borderRadius:18,objectFit:'cover'}} />
                      : <div style={{width:36,height:36,borderRadius:18,background:'var(--surface-light)',display:'flex',alignItems:'center',justifyContent:'center',fontSize: 'var(--fs-snap14)',fontWeight:600,color:'var(--text)'}}>{u.display_name?.[0]?.toUpperCase() || '?'}</div>
                    }
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize: 'var(--fs-snap14)',fontWeight:500,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                        {u.display_name}
                        {u.custom_status_text && (
                          <span style={{marginLeft:6,fontSize: 'var(--fs-caption)',color:u.custom_status_color || 'var(--muted)',fontWeight:400}}>
                            {u.custom_status_emoji} {u.custom_status_text}
                          </span>
                        )}
                      </div>
                      <div style={{fontSize: 'var(--fs-caption)',color:'var(--muted)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{u.email}</div>
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && <div style={{textAlign:'center',color:'var(--muted)',padding:24,fontSize: 'var(--fs-label)'}}>Никого не найдено</div>}
              </div>
            </>
          ) : (
            <>
              {/* Selected user header */}
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:'var(--bg)',borderRadius:10,marginBottom:16}}>
                {selectedUser.avatar_url
                  ? <img src={selectedUser.avatar_url} alt="" style={{width:40,height:40,borderRadius:20,objectFit:'cover'}} />
                  : <div style={{width:40,height:40,borderRadius:20,background:'var(--surface-light)',display:'flex',alignItems:'center',justifyContent:'center',fontSize: 'var(--fs-snap16)',fontWeight:600,color:'var(--text)'}}>{selectedUser.display_name?.[0]?.toUpperCase() || '?'}</div>
                }
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize: 'var(--fs-snap14)',fontWeight:600,color:'var(--text)'}}>{selectedUser.display_name}</div>
                  <div style={{fontSize: 'var(--fs-caption)',color:'var(--muted)'}}>{selectedUser.email}</div>
                </div>
                <button onClick={()=>setSelectedUser(null)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted)',fontSize: 'var(--fs-label)',padding:6}}>Сменить</button>
              </div>

              {/* Preview */}
              {(statusText || statusEmoji) && (
                <div style={{padding:'12px 16px',background:'var(--bg)',borderRadius:10,marginBottom:16,textAlign:'center'}}>
                  <div style={{fontSize: 'var(--fs-micro)',color:'var(--muted)',marginBottom:4,textTransform:'uppercase',letterSpacing:0.5}}>Превью</div>
                  <div style={{fontSize: 'var(--fs-snap16)',fontWeight:600,color:statusColor,display:'inline-flex',alignItems:'center',gap:6}}>
                    <span>{statusEmoji}</span>
                    <span>{statusText || '(пусто)'}</span>
                  </div>
                </div>
              )}

              {/* Status text */}
              <div style={{fontSize: 'var(--fs-caption)',color:'var(--muted)',marginBottom:6,textTransform:'uppercase',letterSpacing:0.5,fontWeight:600}}>Текст статуса</div>
              <input
                placeholder="Например: OWNER, BOSS, VIP..."
                value={statusText}
                onChange={e=>setStatusText(e.target.value.slice(0, 20))}
                maxLength={20}
                autoFocus
                style={{width:'100%',padding:12,background:'var(--bg)',border:'1px solid var(--border)',borderRadius:10,color:'var(--text)',fontSize: 'var(--fs-snap14)',marginBottom:16,outline:'none'}}
              />

              {/* Colors */}
              <div style={{fontSize: 'var(--fs-caption)',color:'var(--muted)',marginBottom:8,textTransform:'uppercase',letterSpacing:0.5,fontWeight:600}}>Цвет текста</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(8,1fr)',gap:6,marginBottom:16}}>
                {COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={()=>setStatusColor(c.value)}
                    title={c.name}
                    style={{
                      width:'100%',aspectRatio:'1',borderRadius:'50%',
                      background:c.value,
                      border:statusColor===c.value ? '3px solid var(--text)' : '2px solid var(--border)',
                      cursor:'pointer',padding:0,
                      boxShadow:statusColor===c.value ? '0 0 0 2px var(--surface)' : 'none',
                    }}
                  />
                ))}
              </div>

              {/* Emojis */}
              <div style={{fontSize: 'var(--fs-caption)',color:'var(--muted)',marginBottom:8,textTransform:'uppercase',letterSpacing:0.5,fontWeight:600}}>Эмодзи</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(8,1fr)',gap:4,marginBottom:20}}>
                {EMOJIS.map(e => (
                  <button
                    key={e}
                    onClick={()=>setStatusEmoji(e)}
                    style={{
                      fontSize: 'var(--fs-title)',padding:'8px 0',cursor:'pointer',
                      background:statusEmoji===e ? 'var(--surface-light)' : 'transparent',
                      border:statusEmoji===e ? '2px solid var(--text)' : '1px solid var(--border)',
                      borderRadius:8,
                    }}
                  >{e}</button>
                ))}
              </div>

              {/* Actions */}
              <div style={{display:'flex',gap:8}}>
                <button onClick={clearStatus} disabled={saving || !selectedUser.custom_status_text} style={{flex:1,padding:12,background:'var(--bg)',color:'var(--danger)',border:'1px solid var(--border)',borderRadius:10,cursor:'pointer',fontSize: 'var(--fs-snap14)',fontWeight:500,opacity:saving || !selectedUser.custom_status_text ? 0.5 : 1}}>Удалить статус</button>
                <button onClick={save} disabled={saving || !statusText.trim()} style={{flex:2,padding:12,background:'var(--text)',color:'var(--bg)',border:'none',borderRadius:10,cursor:'pointer',fontSize: 'var(--fs-snap14)',fontWeight:600,opacity:saving || !statusText.trim() ? 0.5 : 1}}>
                  {saving ? 'Сохранение...' : 'Применить'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
