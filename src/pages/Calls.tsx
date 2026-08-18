import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { useCallStore } from '@/stores/callStore';
import { avatarColor } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';

type CallRecord = {
  id: string;
  type: 'audio' | 'video';
  status: 'missed' | 'answered' | 'declined' | 'ongoing';
  initiated_by: string;
  started_at: string;
  ended_at: string | null;
  duration_sec: number | null;
  participants: string[];
  conversation_id?: string | null;
  otherId: string;
  otherName: string;
  otherAvatar: string | null;
};

function fmtDay(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (diff < 2) return 'вчера';
  if (diff < 7) {
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    return days[d.getDay()];
  }
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

function fmtDuration(sec: number | null): string {
  if (!sec || sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m > 0) return `${m} мин ${s} сек`;
  return `${s} сек`;
}

export default function Calls() {
  const { user } = useAuthStore();
  const { searchUsers, fetchConversations } = useChatStore();
  const { startCall } = useCallStore();
  const nav = useNavigate();
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'missed'>('all');
  const [showNewCall, setShowNewCall] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const loadCalls = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('call_logs')
      .select('*')
      .contains('participants', [user.id])
      .order('started_at', { ascending: false })
      .limit(100);

    const enriched: CallRecord[] = await Promise.all((data || []).map(async (c: any) => {
      const oid = c.participants?.find((p: string) => p !== user.id) || c.initiated_by;
      const { data: ou } = await supabase.from('users').select('display_name, avatar_url').eq('id', oid).maybeSingle();
      const duration = c.ended_at ? Math.floor((new Date(c.ended_at).getTime() - new Date(c.started_at).getTime()) / 1000) : null;
      return {
        ...c,
        otherId: oid,
        otherName: ou?.display_name || 'Неизвестный',
        otherAvatar: ou?.avatar_url || null,
        duration_sec: duration,
      };
    }));

    setCalls(enriched);
    setLoading(false);
  };

  useEffect(() => { loadCalls(); }, [user?.id]);

  const filtered = filter === 'missed' ? calls.filter(c => c.status === 'missed') : calls;

  const callBack = (record: CallRecord) => {
    if (!user) return;
    startCall({
      id: record.otherId,
      display_name: record.otherName,
      avatar_url: record.otherAvatar,
      email: '', status: 'online', last_seen: '', created_at: '',
    } as any, record.type, record.conversation_id || undefined);
  };

  const handleUserSearch = async (q: string) => {
    setSearchQ(q);
    if (q.trim().length < 1 || !user) { setSearchResults([]); return; }
    const results = await searchUsers(q.trim(), user.id);
    setSearchResults(results);
  };

  const handleNewCallUser = (targetUser: any, type: 'audio' | 'video') => {
    if (!user) return;
    setShowNewCall(false);
    setSearchQ('');
    setSearchResults([]);
    // Экран звонка открывается сразу; callStore сам найдёт или создаст личный чат.
    startCall(targetUser, type);
    window.setTimeout(() => { void fetchConversations(user.id); }, 1800);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <div className="page-scroll" style={{ padding: 0, paddingBottom: 76 }}>
        <button className="calls-new-btn" onClick={() => setShowNewCall(true)}>
          <div className="cnb-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              <line x1="18" y1="6" x2="24" y2="6"/>
              <line x1="21" y1="3" x2="21" y2="9"/>
            </svg>
          </div>
          <span>Новый звонок</span>
        </button>

        {loading && <div className="loader"><div className="spinner" /></div>}

        {!loading && filtered.length === 0 && (
          <EmptyState
            icon="📞"
            title={filter === 'missed' ? 'Нет пропущенных' : 'Нет звонков'}
            subtitle="Начни новый звонок кнопкой выше"
          />
        )}

        {filtered.map(c => {
          const outgoing = c.initiated_by === user?.id;
          const missed = c.status === 'missed';
          return (
            <div key={c.id} className="call-row call-list-slide-in">
              <div className="call-arrow">
                {outgoing
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={missed ? '#EF4444' : 'var(--success)'} strokeWidth="1.8" strokeLinecap="round"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg>
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={missed ? '#EF4444' : 'var(--success)'} strokeWidth="1.8" strokeLinecap="round"><path d="M17 7L7 17"/><path d="M17 17H7V7"/></svg>
                }
              </div>
              {c.otherAvatar
                ? <img src={c.otherAvatar} alt="" className="call-avatar" />
                : <div className="call-avatar call-avatar-fallback" style={{background:avatarColor(c.otherId)}}>{c.otherName[0]?.toUpperCase()}</div>
              }
              <div className="call-info">
                <div className={'call-name' + (missed ? ' missed' : '')}>{c.otherName}</div>
                <div className="call-sub">
                  {missed ? 'Пропущенный' : (outgoing ? 'Исходящий' : 'Входящий')}
                  {c.duration_sec ? ` · ${fmtDuration(c.duration_sec)}` : ''}
                </div>
              </div>
              <div className="call-meta">
                <span className="call-time">{fmtDay(c.started_at)}</span>
                <button className="call-action-btn" onClick={(e) => { e.stopPropagation(); callBack(c); }} title={c.type === 'video' ? 'Видеозвонок' : 'Аудиозвонок'}>
                  {c.type === 'video'
                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  }
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* New call modal */}
      {showNewCall && <div className="modal-overlay" onClick={() => { setShowNewCall(false); setSearchQ(''); setSearchResults([]); }}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>НОВЫЙ ЗВОНОК</h2>
            <button className="modal-close" onClick={() => { setShowNewCall(false); setSearchQ(''); setSearchResults([]); }}>✕</button>
          </div>
          <input
            placeholder="Поиск контакта..."
            value={searchQ}
            onChange={e => handleUserSearch(e.target.value)}
            autoFocus
            style={{marginBottom: 12}}
          />
          <div style={{maxHeight: '50vh', overflowY: 'auto'}}>
            {searchResults.map(u => (
              <div key={u.id} className="new-call-item">
                {u.avatar_url
                  ? <img src={u.avatar_url} alt="" style={{width:40,height:40,borderRadius:20,objectFit:'cover'}} />
                  : <div className="av" style={{width:40,height:40,borderRadius:20,background:avatarColor(u.id),fontSize: 'var(--fs-snap16)'}}>{u.display_name?.[0]?.toUpperCase()}</div>
                }
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize: 'var(--fs-snap14)', fontWeight:500, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{u.display_name}</div>
                  <div style={{fontSize: 'var(--fs-caption)', color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{u.email}</div>
                </div>
                <button className="call-action-btn" onClick={() => handleNewCallUser(u, 'audio')} title="Аудиозвонок">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </button>
                <button className="call-action-btn" onClick={() => handleNewCallUser(u, 'video')} title="Видеозвонок">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                </button>
              </div>
            ))}
            {searchQ.trim() && searchResults.length === 0 && <div style={{textAlign:'center', color:'var(--muted)', padding:20}}>Не найдено</div>}
            {!searchQ.trim() && <div style={{textAlign:'center', color:'var(--muted)', padding:20, fontSize: 'var(--fs-label)'}}>Начни вводить имя</div>}
          </div>
        </div>
      </div>}

      {/* Floating bottom segmented switch (above tab-bar) */}
      <div className="calls-bottom-bar">
        <div className="calls-segmented">
          <button className={'cs-btn' + (filter === 'all' ? ' active' : '')} onClick={() => setFilter('all')}>Все</button>
          <button className={'cs-btn' + (filter === 'missed' ? ' active' : '')} onClick={() => setFilter('missed')}>Пропущенные</button>
        </div>
      </div>
    </div>
  );
}
