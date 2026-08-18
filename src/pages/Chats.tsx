import { useEffect, useState, useRef, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '@/stores/toastStore';
import { haptic } from '@/lib/haptics';
import EmptyState from '@/components/EmptyState';
import SwipeToDeleteRow from '@/components/SwipeToDeleteRow';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { useActiveCallsStore } from '@/stores/activeCallsStore';
import { SkeletonChatItem } from '@/components/Skeleton';
import { networkManager } from '@/lib/networkManager';
import { avatarColor, fmtRelative } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { clearChatPassword } from '@/lib/crypto';
import { ConversationWithDetails, User } from '@/types';
import StoriesTray from '@/components/StoriesTray';
import { stripMentionTokens } from '@/lib/mentions';

// Превращает spec-маркеры из system-сообщений в читаемое превью.
// В Chat.tsx эти маркеры рендерятся как полноценные карточки (EventCard,
// AuctionCard, TinderBetCard), но в списке чатов они раньше выводились сырыми:
// «[EVENT:47377d8f-...]» — пугающе и некрасиво.
const PvIcon = ({ children }: { children: ReactNode }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }}>{children}</svg>
);

function formatLastMessagePreview(msg: { type: string; content?: string | null; attachments?: any[] } | null | undefined): ReactNode {
  if (!msg) return 'Нет сообщений';
  const c = msg.content || '';
  if (msg.type === 'call') {
    return <><PvIcon><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.7 19.7 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.7 19.7 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"/></PvIcon>Звонок</>;
  }
  if (msg.type === 'poll') {
    return <><PvIcon><path d="M5 19V11"/><path d="M12 19V5"/><path d="M19 19V8"/></PvIcon>Опрос</>;
  }
  if (msg.type === 'system') {
    if (c.startsWith('[EVENT:')) return <><PvIcon><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></PvIcon>Событие</>;
    if (c.startsWith('[TINDER:') || c.startsWith('[TINDER_BET:')) return <><PvIcon><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z"/></PvIcon>Тиндер-карточка</>;
    if (c.startsWith('[AUCTION:')) return <><PvIcon><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/></PvIcon>Аукцион</>;
    if (c.startsWith('[CHESS:')) return <><PvIcon><path d="M7.5 18.5h9c.4-3-.5-4.7-2-5.9l1.3-1.1c.7-.6.9-1.7.4-2.5l-2-3.2a2.5 2.5 0 0 0-1.8-1.1l-2.9-.4c-1-.1-1.9.5-2.1 1.4l-.3 1.3c-.1.5 0 1.1.5 1.5l1.2 1.1-1.7 2.9c-.9 1.6-.9 3.4 0 5z"/><path d="M6 21.5h12"/></PvIcon>Шахматы</>;
    return (c || '').substring(0, 60);
  }
  // Legacy: старые авто-подписи с emoji-префиксом в content → SVG-иконка
  {
    const legacy: [string, ReactNode, string?][] = [
      ['📷', <PvIcon key="i"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></PvIcon>],
      ['🎤', <PvIcon key="v"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></PvIcon>],
      ['🎥', <PvIcon key="m"><path d="M23 7l-7 5 7 5z"/><rect x="1" y="5" width="15" height="14" rx="2"/></PvIcon>],
      ['📎', <PvIcon key="f"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></PvIcon>],
      ['📍', <PvIcon key="p"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></PvIcon>],
    ];
    for (const [em, ic] of legacy) {
      if (c.startsWith(em)) return <>{ic}{c.slice(em.length).trim() || 'Вложение'}</>;
    }
  }
  // Локация: раньше показывался сырой JSON {"lat":...}
  if (msg.type === 'location' || (c.trim().startsWith('{') && c.includes('"lat"'))) {
    return <><PvIcon><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></PvIcon>Локация</>;
  }
  const filename = c.toLowerCase();
  const att = msg.attachments?.[0];
  const attName = (att?.file_name || '').toLowerCase();
  const attMime = (att?.mime_type || '').toLowerCase();

  if (filename.includes('videonote_') || attName.includes('videonote_')) {
    return <><PvIcon><circle cx="12" cy="12" r="9"/><polygon points="10 9 16 12 10 15"/></PvIcon>Кружочек</>;
  }
  if (filename.includes('voice_') || attName.includes('voice_') || attMime.startsWith('audio/')) {
    return <><PvIcon><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></PvIcon>Голосовое</>;
  }
  if (attMime.startsWith('image/')) {
    return <><PvIcon><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></PvIcon>{msg.attachments && msg.attachments.length > 1 ? `Фото (${msg.attachments.length})` : 'Фото'}</>;
  }
  if (attMime.startsWith('video/')) {
    return <><PvIcon><path d="M23 7l-7 5 7 5z"/><rect x="1" y="5" width="15" height="14" rx="2"/></PvIcon>Видео</>;
  }
  if (att) {
    return <><PvIcon><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></PvIcon>{att.file_name || 'Файл'}</>;
  }
  return stripMentionTokens(c) || 'Нет сообщений';
}

function SavedAvatar({ size = 48 }: { size?: number }) {
  return (
    <div className="av saved-chat-avatar" style={{ width:size, height:size, borderRadius:size/2, background:'var(--text)', color:'var(--bg)', flexShrink:0 }}>
      <svg width={Math.round(size * 0.46)} height={Math.round(size * 0.46)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 4.8A2.8 2.8 0 0 1 8.8 2h6.4A2.8 2.8 0 0 1 18 4.8V22l-6-3.8L6 22V4.8Z"/>
      </svg>
    </div>
  );
}

function Avatar({ user: u, size = 48, showOnline }: { user: { id: string; display_name: string; avatar_url?: string | null; last_seen?: string } | null; size?: number; showOnline?: boolean }) {
  if (!u) return <div className="av" style={{ width: size, height: size, borderRadius: size/2, background: '#333', fontSize: size*0.4 }}>?</div>;
  const online = showOnline && u.last_seen && (Date.now() - new Date(u.last_seen).getTime() < 120000);
  const dot = online ? <div style={{ position:'absolute',bottom:-1,right:-1,width:11,height:11,borderRadius:6,background:'var(--success)',border:'2px solid var(--bg)' }} /> : null;
  if (u.avatar_url) return <div style={{position:'relative',flexShrink:0}}><img src={u.avatar_url} alt="" style={{ width: size, height: size, borderRadius: size/2, objectFit: 'cover' }} />{dot}</div>;
  return <div style={{position:'relative',flexShrink:0}}><div className="av" style={{ width: size, height: size, borderRadius: size/2, background: avatarColor(u.id), fontSize: size*0.4 }}>{u.display_name?.[0]?.toUpperCase()}</div>{dot}</div>;
}

export default function Chats() {
  const nav = useNavigate();
  const { user } = useAuthStore();
  const { conversations, loadingConversations, fetchConversations, subscribeToConversations, searchUsers, createDirectChat, createGroupChat, toggleChatPin, toggleChatMute, toggleChatArchive, subscribeListTyping } = useChatStore();
  // Скелетон до первого завершения загрузки — чтобы «Здесь будут твои разговоры» не мигал при входе
  const wasLoadingRef = useRef(false);
  const [everLoaded, setEverLoaded] = useState(false);
  useEffect(() => {
    if (loadingConversations) { wasLoadingRef.current = true; }
    else if (wasLoadingRef.current) { setEverLoaded(true); }
  }, [loadingConversations]);
  const typingByConv = useChatStore(s => s.typingByConv);
  const activeCalls = useActiveCallsStore(s => s.calls);
  const [searchParams, setSearchParams] = useSearchParams();
  const [showNew, setShowNew] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [rk, setRk] = useState(0);
  const [menuForChat, setMenuForChat] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const pressPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const deleteChat = async (chatId: string) => {
    if (!user) return;
    try {
      // Защищённый чат удаляется локально как новый: не тянем старый пароль/сессию в будущий чат.
      clearChatPassword(chatId);
      await supabase.from('conversation_members').delete().eq('conversation_id', chatId).eq('user_id', user.id);
      await fetchConversations(user.id);
      toast.success('Чат удалён');
    } catch (e: any) {
      toast.error('Ошибка: ' + (e?.message || e));
    }
    setMenuForChat(null);
  };

  const markRead = async (chatId: string) => {
    if (!user) return;
    try {
      const nowIso = new Date().toISOString();
      await supabase.from('conversation_members').update({ last_read_at: nowIso }).eq('conversation_id', chatId).eq('user_id', user.id);
      useChatStore.setState(s => {
        const conversations = s.conversations.map(c => c.id === chatId ? {
          ...c,
          unread_count: 0,
          members: c.members.map((m: any) => m.user_id === user.id ? { ...m, last_read_at: nowIso } : m),
        } : c);
        return { conversations, totalUnread: conversations.reduce((sum: number, c: any) => sum + (c.unread_count || 0), 0) };
      });
      await fetchConversations(user.id);
    } catch (e) { console.error('markRead:', e); }
  };

  const startPress = (chatId: string, e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t) pressPosRef.current = { x: t.clientX, y: t.clientY };
    longPressTimerRef.current = window.setTimeout(() => { haptic.select(); setMenuPos(pressPosRef.current); setMenuForChat(chatId); }, 500);
  };
  const cancelPress = () => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  };
  useEffect(() => { if (searchParams.get('new') === '1') { setShowNew(true); setSearchParams({}); } }, [searchParams]);
  const [mode, setMode] = useState<'direct' | 'group'>('direct');
  const [encryptChat, setEncryptChat] = useState(false);
  const [protectedChatAccess, setProtectedChatAccess] = useState(!!user?.encrypted_chat_access);
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [creating, setCreating] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => networkManager.subscribe(setIsOnline), []);
  // Group creation
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [groupName, setGroupName] = useState('');
  const [step, setStep] = useState<'pick' | 'name'>('pick');
  // Анимация закрытия + жесты листа
  const [newClosing, setNewClosing] = useState(false);
  const [sheetDrag, setSheetDrag] = useState(0);
  const sheetDragging = useRef(false);
  const grabStart = useRef({ x: 0, y: 0 });
  const grabAxis = useRef<'' | 'v'>('');
  const bodyStart = useRef({ x: 0, y: 0 });
  const swipedRef = useRef(false);

  // Загружаем чаты при первом mount + при возврате во вкладку (rk++).
  // Если данные уже в сторе и это re-mount тем же юзером — пропускаем фетч:
  // realtime-подписка держит список свежим. Это убирает «лоадер при каждом
  // переключении табов».
  const lastChatsFetchKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user) return;
    const key = user.id + ':' + rk;
    if (lastChatsFetchKeyRef.current === key && conversations.length > 0) {
      return; // ничего не делаем, realtime обновит
    }
    lastChatsFetchKeyRef.current = key;
    fetchConversations(user.id);
    return subscribeToConversations(user.id);
  }, [user?.id, rk]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible' && user) setRk(k => k + 1); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [user?.id]);

  // #8 — подписка на «печатает» по всем чатам списка; пересоздаём при смене набора чатов.
  const convIdsKey = conversations.map(c => c.id).sort().join(',');
  useEffect(() => {
    if (!user || conversations.length === 0) return;
    return subscribeListTyping(conversations.map(c => c.id), user.id);
  }, [user?.id, convIdsKey]);

  useEffect(() => {
    if (!showNew || !user) return;
    const t = setTimeout(async () => { const r = await searchUsers(query, user.id); setUsers(r); }, query ? 300 : 0);
    return () => clearTimeout(t);
  }, [query, user?.id, showNew]);

  // Доступ к незавершённым защищённым чатам выдаётся только через
  // Консоль → Доступы. Перечитываем флаг при каждом открытии меню, чтобы
  // разрешение появлялось без повторного входа в аккаунт.
  useEffect(() => {
    let active = true;
    const fallback = !!user?.encrypted_chat_access;
    setProtectedChatAccess(fallback);
    if (!fallback) setEncryptChat(false);
    if (!showNew || !user?.id) return () => { active = false; };

    void supabase
      .from('users')
      .select('encrypted_chat_access')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active || error) return;
        const allowed = !!data?.encrypted_chat_access;
        setProtectedChatAccess(allowed);
        if (!allowed) setEncryptChat(false);
      });

    return () => { active = false; };
  }, [showNew, user?.id, user?.encrypted_chat_access]);

  const closeModal = () => {
    setShowNew(false); setQuery(''); setUsers([]); setMode('direct');
    setSelectedUsers([]); setGroupName(''); setStep('pick'); setEncryptChat(false);
    setSheetDrag(0); setNewClosing(false);
  };

  // П1 — закрытие с выездом вниз
  const animateClose = () => {
    haptic.tap();
    setNewClosing(true);
    setSheetDrag(window.innerHeight);
    setTimeout(() => closeModal(), 280);
  };

  // П2 — вертикальный свайп по граберу/шапке для закрытия
  const onGrabDown = (e: React.PointerEvent) => { sheetDragging.current = true; grabStart.current = { x: e.clientX, y: e.clientY }; grabAxis.current = ''; };
  const onGrabMove = (e: React.PointerEvent) => {
    if (!sheetDragging.current) return;
    const dx = e.clientX - grabStart.current.x, dy = e.clientY - grabStart.current.y;
    if (!grabAxis.current && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) grabAxis.current = 'v';
    if (grabAxis.current === 'v' && dy > 0) setSheetDrag(dy);
  };
  const onGrabUp = () => {
    if (!sheetDragging.current) return;
    sheetDragging.current = false;
    if (sheetDrag > 110) { animateClose(); return; }
    setSheetDrag(0);
  };

  // У4 — горизонтальный свайп по телу листа переключает режим
  const onBodyDown = (e: React.PointerEvent) => { bodyStart.current = { x: e.clientX, y: e.clientY }; };
  const onBodyUp = (e: React.PointerEvent) => {
    const dx = e.clientX - bodyStart.current.x, dy = e.clientY - bodyStart.current.y;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      swipedRef.current = true;
      haptic.tap();
      setTimeout(() => { swipedRef.current = false; }, 350);
      if (dx < 0) { setMode('group'); }
      else { setMode('direct'); setSelectedUsers([]); setStep('pick'); }
    }
  };

  // У1 — недавние собеседники из личных чатов
  const getOtherUser = (c: ConversationWithDetails) => {
    const m = c.members.find(m => m.user_id !== user?.id);
    return (m as any)?.user as User | undefined;
  };
  const recentContacts: User[] = (() => {
    const seen = new Set<string>(); const out: User[] = [];
    for (const c of conversations) {
      if (c.type !== 'direct') continue;
      const o = getOtherUser(c);
      if (o && o.id !== user?.id && !seen.has(o.id)) { seen.add(o.id); out.push(o); }
      if (out.length >= 8) break;
    }
    return out;
  })();

  const renderUserRow = (u: User, idx: number) => {
    const selected = !!selectedUsers.find(s => s.id === u.id);
    return (
      <div key={u.id} className="chat-item nc-result" style={{ opacity: creating ? 0.5 : 1, animationDelay: Math.min(idx, 9) * 26 + 'ms' }}
        onClick={() => { if (swipedRef.current) { swipedRef.current = false; return; } (mode === 'direct' ? startDirectChat(u) : toggleSelect(u)); }}>
        {mode === 'group' && (
          <div className={'nc-check' + (selected ? ' on' : '')}>
            {selected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
          </div>
        )}
        <Avatar user={u} size={40} showOnline />
        <div className="ci-info"><div className="ci-name">{u.display_name}</div><div className="ci-preview">{u.email}</div></div>
      </div>
    );
  };

  const startDirectChat = async (target: User) => {
    if (!user || creating) return;
    setCreating(true);
    const shouldEncrypt = protectedChatAccess && encryptChat;
    const { id, error } = await createDirectChat(user.id, target.id, shouldEncrypt, shouldEncrypt);
    if (id && shouldEncrypt) clearChatPassword(id);
    setCreating(false);
    if (error) { toast.error(error); return; }
    haptic.success();
    closeModal();
    await fetchConversations(user.id);
    nav('/chat/' + id);
  };

  const toggleSelect = (u: User) => {
    haptic.tap();
    if (selectedUsers.find(s => s.id === u.id)) {
      setSelectedUsers(selectedUsers.filter(s => s.id !== u.id));
    } else {
      setSelectedUsers([...selectedUsers, u]);
    }
  };

  const handleCreateGroup = async () => {
    if (!user || !groupName.trim() || selectedUsers.length < 1 || creating) return;
    setCreating(true);
    const shouldEncrypt = protectedChatAccess && encryptChat;
    const { id, error } = await createGroupChat(user.id, selectedUsers.map(u => u.id), groupName, shouldEncrypt);
    if (id && shouldEncrypt) clearChatPassword(id);
    setCreating(false);
    if (error) { toast.error(error); return; }
    haptic.success();
    closeModal();
    await fetchConversations(user.id);
    nav('/chat/' + id);
  };

  const getOther = (c: ConversationWithDetails) => {
    const m = c.members.find(m => m.user_id !== user?.id);
    return (m as any)?.user || null;
  };

  const isSavedChat = (c: ConversationWithDetails) => !!c.is_saved && c.saved_owner_id === user?.id;

  const getName = (c: ConversationWithDetails) => {
    if (isSavedChat(c)) return 'Избранное';
    if (c.type === 'group') return c.name || 'Группа';
    return getOther(c)?.display_name || 'Чат';
  };

  const getAvatar = (c: ConversationWithDetails) => {
    if (isSavedChat(c)) return <SavedAvatar />;
    if (c.type === 'group') {
      return <div className="av" style={{ width: 48, height: 48, borderRadius: 24, background: avatarColor(c.id), fontSize: 'var(--fs-title)' }}><svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='#fff' strokeWidth='1.5'><path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2'/><circle cx='9' cy='7' r='4'/><path d='M23 21v-2a4 4 0 0 0-3-3.87'/><path d='M16 3.13a4 4 0 0 1 0 7.75'/></svg></div>;
    }
    const o = getOther(c);
    return <Avatar user={o || { id: c.id, display_name: getName(c) }} showOnline={c.type === 'direct'} />;
  };

  const renderRow = (c: ConversationWithDetails) => {
    const saved = isSavedChat(c);
    const otherU = getOther(c);
    const typing = saved ? null : (typingByConv as any)[c.id];
    const draft = (() => { try { return localStorage.getItem('draft:' + c.id); } catch { return null; } })();
    // #10 — статус доставки своего последнего сообщения (личные чаты)
    const lm = c.last_message as any;
    let checks: React.ReactNode = null;
    if (!saved && lm && lm.sender_id === user?.id && c.type === 'direct' && lm.type !== 'system') {
      const other = c.members.find(m => m.user_id !== user?.id) as any;
      const read = other?.last_read_at && new Date(other.last_read_at).getTime() >= new Date(lm.created_at).getTime();
      checks = read
        ? <svg width="17" height="12" viewBox="0 0 24 16" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><path d="M1 9l4 4L14 4"/><path d="M9 13L19 3"/></svg>
        : <svg width="13" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--muted)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><path d="M2 9l4 4L14 4"/></svg>;
    }
    const row = (
      <div
        className={"chat-item tap-effect" + (saved ? ' saved-chat-row' : '')}
        onClick={() => nav('/chat/' + c.id)}
        onContextMenu={(e) => { if (saved) return; e.preventDefault(); haptic.select(); setMenuPos({ x: e.clientX, y: e.clientY }); setMenuForChat(c.id); }}
        onTouchStart={(e) => { if (!saved) startPress(c.id, e); }}
        onTouchEnd={saved ? undefined : cancelPress}
        onTouchMove={saved ? undefined : cancelPress}
        onTouchCancel={saved ? undefined : cancelPress}
      >
        {getAvatar(c)}
        <div className="ci-info">
          <div className="ci-name"><span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{getName(c)}</span>{activeCalls[c.id] && <span style={{ display:'inline-flex', alignItems:'center', gap:4, marginLeft:6, padding:'1px 7px', borderRadius:999, background:'#16A34A', color:'#fff', fontSize: 'var(--fs-snap10)', fontWeight:700, verticalAlign:'1px', flexShrink:0 }}><span style={{ width:5, height:5, borderRadius:3, background:'#fff', animation:'callPulse 1.2s ease-in-out infinite' }} />Live</span>}{c.is_muted && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft:5, flexShrink:0 }}><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg>}{c.type === 'group' && <span style={{ color: 'var(--muted)', fontSize: 'var(--fs-micro)', marginLeft: 4, flexShrink:0 }}>{c.members.length}</span>}{c.type === 'direct' && (otherU?.custom_status_text ? <span style={{ color: otherU.custom_status_color || 'var(--muted)', fontSize: 'var(--fs-micro)', marginLeft: 6, fontWeight: 600, letterSpacing: 0.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{otherU.custom_status_text}</span> : otherU?.bio && <span style={{ color: 'var(--muted)', fontSize: 'var(--fs-micro)', marginLeft: 6, fontWeight: 400 }}>{otherU.bio.substring(0, 20)}</span>)}</div>
          <div className="ci-preview">{(() => {
            if (typing) return <span style={{ color:'var(--accent)', fontWeight:500, display:'inline-flex', alignItems:'center' }}>{c.type === 'group' && typing.name ? typing.name.split(' ')[0] + ' печатает' : 'печатает'}<span className="typing-dots"><span/><span/><span/></span></span>;
            if (draft && draft.trim()) return <><span style={{ color:'#E74C3C', fontWeight:500 }}>Черновик: </span>{draft.trim().slice(0, 40)}</>;
            if (saved && !c.last_message) return 'Сохраняйте сообщения и файлы';
            if (c.last_message?.is_encrypted) return <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'-1px',marginRight:4}}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Защищённый чат</>;
            const lm = c.last_message as any;
            const preview = formatLastMessagePreview(lm);
            if (!lm || lm.type === 'system') return preview;
            let prefix = '';
            if (!saved && lm.sender_id === user?.id) prefix = 'Вы: ';
            else if (c.type === 'group') {
              const sname = (c.members.find(m => m.user_id === lm.sender_id) as any)?.user?.display_name;
              if (sname) prefix = sname.split(' ')[0] + ': ';
            }
            return <>{prefix && <span style={{ color:'var(--text)', fontWeight:500 }}>{prefix}</span>}{preview}</>;
          })()}</div>
        </div>
        <div className="ci-meta">
          {c.last_message && <div className="ci-time" style={{ display:'flex', alignItems:'center', gap:3 }}>{checks}{fmtRelative(c.last_message.created_at)}</div>}
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            {c.is_pinned && !saved && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><line x1="12" y1="17" x2="12" y2="22"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>}
            {c.unread_count > 0 && <div className="ci-unread" style={c.is_muted ? { background:'var(--muted)' } : undefined}>{c.unread_count}</div>}
          </div>
        </div>
      </div>
    );
    if (saved) return <div key={c.id} className="chat-row-shell saved-chat-shell">{row}</div>;
    return (
      <SwipeToDeleteRow key={c.id} className="chat-row-shell" onDelete={() => deleteChat(c.id)} onSwipeRight={c.unread_count > 0 ? () => markRead(c.id) : undefined}>
        {row}
      </SwipeToDeleteRow>
    );
  };

  return (
    <div className="chats-screen" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {!isOnline && (
        <div style={{
          background: '#E74C3C', color: '#fff', padding: '6px 12px',
          textAlign: 'center', fontSize: 'var(--fs-caption)', fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.58 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01"/></svg>
          Оффлайн — сообщения отправятся при появлении связи
        </div>
      )}
      <div className="page-header chats-appear chats-appear-1" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <h1>Чаты</h1>
        <div style={{display:'flex', alignItems:'center', gap:2}}>
          <button onClick={() => nav('/languages')} style={{
            background:'transparent', border:'none', width:36, height:36,
            borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center',
            cursor:'pointer', flexShrink:0,
          }} aria-label="Обучение">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          </button>
          <button onClick={() => nav('/map')} style={{
            background:'transparent', border:'none', width:36, height:36,
            borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center',
            cursor:'pointer', flexShrink:0,
          }} aria-label="Карта">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </button>
          <button onClick={() => { haptic.select(); setShowNew(true); }} className="nc-plus-btn" style={{
            background:'transparent', border:'none', width:36, height:36,
            borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center',
            cursor:'pointer', flexShrink:0,
          }} aria-label="Новый чат">
            {/* VK-стиль: квадратик с карандашиком */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="chats-appear chats-appear-2"><StoriesTray /></div>

      {/* Поиск чатов */}
      <div className="chats-appear chats-appear-3" style={{padding:'4px 12px 8px', flexShrink:0}}>
        <div style={{
          display:'flex', alignItems:'center', gap:8,
          background:'var(--surface-light)',
          borderRadius:10, padding:'8px 12px',
        }}>
          <div style={{position:'relative', width:16, height:16, flexShrink:0}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{
              position:'absolute', inset:0,
              transition:'opacity 0.24s ease, transform 0.24s cubic-bezier(0.4, 0, 0.2, 1)',
              opacity: chatSearchQuery ? 0 : 1,
              transform: chatSearchQuery ? 'rotate(-90deg) scale(0.6)' : 'rotate(0) scale(1)',
            }}>
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.3-4.3"/>
            </svg>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" style={{
              position:'absolute', inset:0,
              cursor: chatSearchQuery ? 'pointer' : 'default',
              transition:'opacity 0.24s ease, transform 0.24s cubic-bezier(0.4, 0, 0.2, 1)',
              opacity: chatSearchQuery ? 1 : 0,
              transform: chatSearchQuery ? 'rotate(0) scale(1)' : 'rotate(90deg) scale(0.6)',
              pointerEvents: chatSearchQuery ? 'auto' : 'none',
            }} onClick={() => setChatSearchQuery('')}>
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </div>
          <input
            value={chatSearchQuery}
            onChange={e => setChatSearchQuery(e.target.value)}
            placeholder="Поиск"
            style={{
              flex:1, background:'transparent', border:'none', outline:'none',
              color:'var(--text)', fontSize: 'var(--fs-body)',
            }}
          />
        </div>
      </div>
      <div className="page-scroll chats-list-scroll">
        {conversations.length === 0 && !everLoaded && (
          <div>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonChatItem key={i} />)}
          </div>
        )}
        {everLoaded && conversations.length === 0 && (
          <EmptyState
            icon={null}
            title="Здесь будут твои разговоры"
            subtitle={'Найди друга через поиск\u00A0выше или начни групповой чат — кнопка создания в правом верхнем углу.'}
          />
        )}
        {(() => {
          const filtered = conversations.filter(c => {
            if (!chatSearchQuery.trim()) return true;
            const q = chatSearchQuery.toLowerCase().trim();
            const name = getName(c).toLowerCase();
            const lastMsg = stripMentionTokens((c as any).last_message?.content || '').toLowerCase();
            return name.includes(q) || lastMsg.includes(q);
          });
          const main = filtered.filter(c => !c.is_archived);
          const archived = filtered.filter(c => c.is_archived);
          if (showArchived) {
            return (
              <>
                <div className="archive-title-row tap-effect chats-appear chats-appear-4" onClick={() => { haptic.tap(); setShowArchived(false); }}>
                  <button className="archive-back" aria-label="Назад">
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                  </button>
                  <div className="archive-title-copy">
                    <div>Архив</div>
                    <span>{archived.length} {archived.length === 1 ? 'чат' : archived.length < 5 ? 'чата' : 'чатов'}</span>
                  </div>
                </div>
                {archived.length ? archived.map(renderRow) : <div className="nc-empty">В архиве пока нет чатов</div>}
              </>
            );
          }
          return (
            <>
              {archived.length > 0 && (
                <div className="archive-row tap-effect chats-appear chats-appear-4" onClick={() => { haptic.tap(); setShowArchived(true); }}>
                  <div className="archive-ic archive-ic-avatar">
                    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="4" rx="1"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/></svg>
                  </div>
                  <div style={{ flex:1, fontSize:'var(--fs-body)', fontWeight:600, color:'var(--text)' }}>Архив</div>
                  <div className="archive-count">{archived.length}</div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </div>
              )}
              {main.map(renderRow)}
            </>
          );
        })()}
      </div>
      

      {menuForChat && menuPos && (() => {
        const mc = conversations.find(x => x.id === menuForChat);
        if (!mc || mc.is_saved) return null;
        const closeMenu = () => { setMenuForChat(null); setMenuPos(null); };
        const rowStyle: React.CSSProperties = { width:'100%', background:'none', border:'none', padding:'12px 14px', display:'flex', alignItems:'center', gap:12, cursor:'pointer', borderRadius:9, color:'var(--text)', fontSize:'var(--fs-body)', fontWeight:500 };
        const act = (fn: () => void) => { haptic.tap(); fn(); closeMenu(); };
        const MENU_W = 248, MENU_H = 250;
        const vw = window.innerWidth, vh = window.innerHeight;
        const left = Math.min(Math.max(8, menuPos.x), vw - MENU_W - 8);
        const openUp = menuPos.y + MENU_H > vh - 12;
        const top = openUp ? Math.max(8, menuPos.y - MENU_H) : menuPos.y;
        const originY = openUp ? 'bottom' : 'top';
        return (
        <div className="cmenu-overlay" onClick={closeMenu}>
          <div className="cmenu-pop" style={{ left, top, width: MENU_W, transformOrigin: `${originY} left` }} onClick={e => e.stopPropagation()}>
            <button className="cmenu-row" onClick={() => act(() => { if (user) toggleChatPin(mc.id, user.id, !mc.is_pinned); })} style={rowStyle}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>
              {mc.is_pinned ? 'Открепить' : 'Закрепить наверх'}
            </button>
            <button className="cmenu-row" onClick={() => act(() => { if (user) toggleChatMute(mc.id, user.id, !mc.is_muted); })} style={rowStyle}>
              {mc.is_muted
                ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg>}
              {mc.is_muted ? 'Включить звук' : 'Без звука'}
            </button>
            <button className="cmenu-row" onClick={() => act(() => { if (user) toggleChatArchive(mc.id, user.id, !mc.is_archived); })} style={rowStyle}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="5" rx="1"/><path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/></svg>
              {mc.is_archived ? 'Вернуть из архива' : 'В архив'}
            </button>
            <div style={{ height:1, background:'var(--border)', margin:'4px 10px' }} />
            <button className="cmenu-row" onClick={() => act(() => deleteChat(mc.id))} style={{ ...rowStyle, color:'#E74C3C' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              Удалить чат
            </button>
          </div>
        </div>
        );
      })()}

      {showNew && (
        <div
          className="modal-overlay nc-overlay"
          onClick={animateClose}
          style={{ opacity: newClosing ? 0 : 1, transition: 'opacity .28s ease', ['--nc-veil' as any]: sheetDrag > 0 ? Math.max(0.15, 1 - sheetDrag / 350) : 1 }}
        >
          <div
            className="modal-content nc-sheet"
            onClick={e => e.stopPropagation()}
            style={{ transform: `translateY(${sheetDrag}px)`, transition: sheetDragging.current ? 'none' : 'transform .3s cubic-bezier(0.16,1,0.3,1)' }}
          >
            {/* Грабер + шапка — зона свайпа вниз (П2, Д1) */}
            <div className="nc-drag" onPointerDown={onGrabDown} onPointerMove={onGrabMove} onPointerUp={onGrabUp} onPointerCancel={onGrabUp}>
              <div className="nc-grabber" />
              <div className="modal-header" style={{ marginBottom: 12 }}>
                <h2 className="nc-title">{mode === 'direct' ? 'Новый чат' : step === 'pick' ? 'Участники' : 'Название группы'}</h2>
                <button className="nc-close" onClick={animateClose} aria-label="Закрыть">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            {/* Сегмент со скользящей пилюлей (П3, Д2) */}
            <div className="nc-seg">
              <div className="nc-seg-pill" style={{ transform: mode === 'group' ? 'translateX(100%)' : 'translateX(0)' }} />
              <button className={'nc-seg-btn' + (mode === 'direct' ? ' active' : '')} onClick={() => { haptic.tap(); setMode('direct'); setSelectedUsers([]); setStep('pick'); }}>Личный</button>
              <button className={'nc-seg-btn' + (mode === 'group' ? ' active' : '')} onClick={() => { haptic.tap(); setMode('group'); }}>Группа</button>
            </div>

            {/* Незавершённая функция видна только пользователям из allowlist в Консоли. */}
            {protectedChatAccess && (
              <div className="nc-enc" onClick={() => setEncryptChat(!encryptChat)}>
                <div className={'nc-enc-ic' + (encryptChat ? ' on' : '')}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                </div>
                <div className="nc-enc-txt">
                  <div className="nc-enc-title">Защищённый чат</div>
                </div>
                <div className={'nc-switch' + (encryptChat ? ' on' : '')}><div className="nc-knob" /></div>
              </div>
            )}

            {/* Тело: горизонтальный свайп режима (У4) + переход шага (П4) */}
            <div className="nc-body" onPointerDown={onBodyDown} onPointerUp={onBodyUp}>
              <div className="nc-step" key={mode + step}>
                {mode === 'group' && step === 'name' ? (
                  <>
                    <input placeholder="Название группы..." value={groupName} onChange={e => setGroupName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateGroup()} />
                    <div style={{ margin: '12px 0', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {selectedUsers.map(u => (
                        <span key={u.id} className="chip nc-chip" onClick={() => toggleSelect(u)}>{u.display_name}<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{marginLeft:4,verticalAlign:'-2px'}}><path d="M18 6 6 18M6 6l12 12"/></svg></span>
                      ))}
                    </div>
                    <button className="btn" onClick={handleCreateGroup} disabled={!groupName.trim() || creating}>{creating ? '...' : 'Создать группу'}</button>
                  </>
                ) : (
                  <>
                    <input placeholder="Поиск по имени или email..." value={query} onChange={e => setQuery(e.target.value)} />

                    {mode === 'group' && selectedUsers.length > 0 && (
                      <div style={{ margin: '10px 0', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {selectedUsers.map(u => (
                          <span key={u.id} className="chip nc-chip" onClick={() => toggleSelect(u)}>{u.display_name}<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{marginLeft:4,verticalAlign:'-2px'}}><path d="M18 6 6 18M6 6l12 12"/></svg></span>
                        ))}
                      </div>
                    )}

                    <div style={{ marginTop: 12 }}>
                      {query ? (
                        <>
                          {users.map((u, i) => renderUserRow(u, i))}
                          {users.length === 0 && <div className="nc-empty">Никого не найдено по запросу «{query}»</div>}
                        </>
                      ) : (
                        <>
                          {recentContacts.length > 0 && <div className="nc-recent-label">Недавние</div>}
                          {recentContacts.map((u, i) => renderUserRow(u, i))}
                          {recentContacts.length === 0 && <div className="nc-empty">Введите имя или email, чтобы найти человека</div>}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Sticky-футер выбора группы (У2) */}
            {mode === 'group' && step === 'pick' && selectedUsers.length >= 1 && (
              <div className="nc-footer">
                <span className="nc-count">Выбрано: {selectedUsers.length}</span>
                <button className="btn" style={{ flex: 1 }} onClick={() => { haptic.tap(); setStep('name'); }}>Далее</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ChatEmptySvg() {
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" fill="none">
      <circle cx="42" cy="42" r="40" fill="var(--surface-light)" />
      <path d="M28 30 L56 30 Q60 30 60 34 L60 48 Q60 52 56 52 L40 52 L32 60 L32 52 L28 52 Q24 52 24 48 L24 34 Q24 30 28 30 Z"
        fill="var(--accent)" opacity="0.4" stroke="var(--accent)" strokeWidth="2" />
      <circle cx="34" cy="41" r="2" fill="var(--text)" opacity="0.6" />
      <circle cx="42" cy="41" r="2" fill="var(--text)" opacity="0.6" />
      <circle cx="50" cy="41" r="2" fill="var(--text)" opacity="0.6" />
    </svg>
  );
}
