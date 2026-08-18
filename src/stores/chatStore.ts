import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { toast } from '@/stores/toastStore';
import { uploadFile } from '@/lib/storage';
import { playMessageSound, showNotification, updateBadge } from '@/lib/notifications';
import { getNotifPref } from '@/lib/notifPrefs';
import { hasActivePushSubscription, notifyMessageRecipients } from '@/lib/pushNotifications';
import {
  cacheMessages, getCachedMessages, cacheConversations, getCachedConversations,
  cacheProfiles, getCachedProfile, addToQueue, type QueuedMessage,
} from '@/lib/offlineCache';
import { networkManager } from '@/lib/networkManager';
import { encryptFile, decryptMessage, getChatPassword } from '@/lib/crypto';
import { isUserMentioned, stripMentionTokens } from '@/lib/mentions';
import type { ConversationWithDetails, Message, MessageWithSender, User, Reaction, FileAttachment, StoryReplySnapshot } from '@/types';

// Размеры фото/видео на момент отправки — чтобы чат резервировал точный aspect-ratio
// пузыря ДО загрузки файла и лента не «прыгала». Возвращает null для не-медиа / ошибок.
async function getMediaDimensions(file: File): Promise<{ width: number; height: number } | null> {
  try {
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      try {
        return await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img.naturalWidth && img.naturalHeight ? { width: img.naturalWidth, height: img.naturalHeight } : null);
          img.onerror = () => resolve(null);
          img.src = url;
        });
      } finally { URL.revokeObjectURL(url); }
    }
    if (file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      try {
        return await new Promise((resolve) => {
          const v = document.createElement('video');
          v.preload = 'metadata';
          v.onloadedmetadata = () => resolve(v.videoWidth && v.videoHeight ? { width: v.videoWidth, height: v.videoHeight } : null);
          v.onerror = () => resolve(null);
          v.src = url;
        });
      } finally { URL.revokeObjectURL(url); }
    }
  } catch { /* ignore */ }
  return null;
}

interface ChatState {
  conversations: ConversationWithDetails[];
  currentMessages: MessageWithSender[];
  loadingConversations: boolean;
  loadingMessages: boolean;
  uploadProgress: number;
  totalUnread: number;
  // Typing indicator
  typingUsers: Record<string, { name: string; timer: any }>;
  typingByConv: Record<string, { name: string; timer: any }>;
  // Read receipts: other members' last_read_at per conversation
  memberReadTimes: Record<string, string>; // usedId -> last_read_at
  pinnedIds: string[]; // message ids закреплённых в текущей беседе (новые первыми)
  blockedIds: string[]; // user ids, которых заблокировал текущий пользователь
  hasMoreOlder: boolean; // есть ли более старые сообщения для подгрузки
  loadingOlder: boolean; // идёт подгрузка старых

  fetchConversations: (userId: string) => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<void>;
  loadOlderMessages: (conversationId: string) => Promise<void>;
  sendMessage: (convId: string, senderId: string, content: string, replyToId?: string, extras?: { storyReplySnapshot?: StoryReplySnapshot | null }) => Promise<{ error: string | null }>;
  sendWidgetMessage: (convId: string, senderId: string, content: string, type: Message['type']) => Promise<{ id: string | null; error: string | null }>;
  retrySend: (msg: MessageWithSender) => Promise<{ error: string | null }>;
  forwardMessage: (targetConvId: string, senderId: string, original: MessageWithSender) => Promise<{ error: string | null }>;
  sendFileMessage: (convId: string, senderId: string, file: File, encryptionOpts?: { password: string }, extras?: { is_spoiler?: boolean; expires_at?: string | null; caption?: string }) => Promise<{ error: string | null }>;
  sendAlbumMessage: (convId: string, senderId: string, files: File[], onProgress?: (idx: number, total: number, p: number) => void, extras?: { is_spoiler?: boolean; expires_at?: string | null; caption?: string }) => Promise<{ error: string | null }>;
  deleteMessage: (msgId: string) => Promise<void>;
  createDirectChat: (myId: string, targetId: string, forceNew?: boolean, isEncrypted?: boolean) => Promise<{ id: string; error: string | null }>;
  createGroupChat: (myId: string, memberIds: string[], name: string, isEncrypted?: boolean) => Promise<{ id: string; error: string | null }>;
  addGroupMember: (convId: string, userId: string, actorId: string) => Promise<{ error: string | null }>;
  removeGroupMember: (convId: string, userId: string) => Promise<{ error: string | null }>;
  leaveGroup: (convId: string, userId: string) => Promise<void>;
  deleteGroup: (convId: string) => Promise<void>;
  renameGroup: (convId: string, name: string) => Promise<{ error: string | null }>;
  subscribeToMessages: (convId: string) => () => void;
  subscribeToConversations: (userId: string) => () => void;
  subscribeToTyping: (convId: string, myId: string) => () => void;
  subscribeListTyping: (convIds: string[], myId: string) => () => void;
  sendTyping: (convId: string, userId: string, displayName: string) => void;
  fetchReadReceipts: (convId: string, myId: string) => Promise<void>;
  searchUsers: (q: string, myId: string) => Promise<User[]>;
  searchMessages: (q: string, userId: string) => Promise<any[]>;
  // New features
  updateLastSeen: (userId: string) => Promise<void>;
  toggleReaction: (messageId: string, userId: string, emoji: string, active?: boolean) => Promise<void>;
  fetchReactions: (messageIds: string[]) => Promise<Record<string, Reaction[]>>;
  pinMessage: (convId: string, messageId: string | null) => Promise<void>;
  fetchPinned: (convId: string) => Promise<void>;
  togglePinMessage: (convId: string, messageId: string, userId: string) => Promise<void>;
  fetchBlocked: (userId: string) => Promise<void>;
  blockUser: (blockerId: string, blockedId: string) => Promise<void>;
  unblockUser: (blockerId: string, blockedId: string) => Promise<void>;
  toggleChatPin: (convId: string, userId: string, val: boolean) => Promise<void>;
  toggleChatMute: (convId: string, userId: string, val: boolean) => Promise<void>;
  toggleChatArchive: (convId: string, userId: string, val: boolean) => Promise<void>;
  updateBio: (userId: string, bio: string) => Promise<void>;
  sendLocation: (convId: string, senderId: string, lat: number, lng: number) => Promise<void>;
  fetchMediaGallery: (convId: string) => Promise<FileAttachment[]>;
  createPoll: (convId: string, userId: string, question: string, options: string[]) => Promise<void>;
  votePoll: (pollId: string, optionId: string, userId: string) => Promise<void>;
  fetchPoll: (pollId: string) => Promise<any>;
}

let typingDebounce: any = null;
let fetchMessagesReqId = 0;
const MSG_PAGE = 40; // #21 — размер страницы сообщений (последние N + подгрузка старых)

const ATTACHMENT_RETRY_DELAYS = [0, 160, 360, 760, 1500, 3000, 6000, 10000];
const attachmentHydrationInFlight = new Set<string>();
const attachmentHydrationRetryCount = new Map<string, number>();
const attachmentHydrationRetryTimers = new Map<string, number>();

function messageExpectsAttachment(message: Pick<Message, 'id' | 'type' | 'content'> & { attachments?: FileAttachment[]; expected_attachment_count?: number }): boolean {
  const expected = Number((message as any).expected_attachment_count || 0);
  if (expected > 0 && (message.attachments?.length || 0) < expected) return true;
  if (message.attachments?.length) return false;
  if (['image', 'file', 'voice', 'album'].includes(String(message.type))) return true;
  const content = String(message.content || '').trim();
  return /^(videonote_|voice_)/i.test(content) || /\.(?:jpe?g|png|webp|gif|heic|mp4|mov|m4v|webm|mp3|m4a|ogg|opus|pdf|docx?|xlsx?|zip)$/i.test(content);
}

function wait(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function hydrateMessageAttachments(
  convId: string,
  messageIds: string[],
  setState: (updater: any) => void,
  getState: () => ChatState,
) {
  const freshIds = Array.from(new Set(messageIds)).filter(id => id && !attachmentHydrationInFlight.has(id));
  if (!freshIds.length) return;
  freshIds.forEach(id => attachmentHydrationInFlight.add(id));
  const pending = new Set(freshIds);
  try {
    for (const delay of ATTACHMENT_RETRY_DELAYS) {
      if (delay) await wait(delay);
      if (!pending.size) break;
      const ids = Array.from(pending);
      const { data } = await supabase.from('file_attachments').select('*').in('message_id', ids);
      const grouped = new Map<string, FileAttachment[]>();
      for (const row of (data || []) as FileAttachment[]) {
        const list = grouped.get(row.message_id) || [];
        list.push(row);
        grouped.set(row.message_id, list);
      }
      if (!grouped.size) continue;
      setState((state: ChatState) => ({
        currentMessages: state.currentMessages.map(message => {
          const attachments = grouped.get(message.id);
          if (!attachments?.length) return message;
          const expected = Number((message as any).expected_attachment_count || 0);
          const keepStatus = expected > 0 && attachments.length < expected;
          return ({
            ...message,
            attachments,
            status: keepStatus ? ((message as any).status || 'sending') : ((message as any).status === 'failed' ? 'failed' : 'sent'),
          } as MessageWithSender);
        }),
      }));
      grouped.forEach((attachments, id) => {
        const message = getState().currentMessages.find(item => item.id === id);
        const expected = Number((message as any)?.expected_attachment_count || 0);
        if (!expected || attachments.length >= expected) pending.delete(id);
      });
      const hydrated = getState().currentMessages.filter(message => grouped.has(message.id) && message.conversation_id === convId);
      if (hydrated.length) void cacheMessages(hydrated);
    }
  } catch (error) {
    console.warn('hydrateMessageAttachments:', error);
  } finally {
    freshIds.forEach(id => attachmentHydrationInFlight.delete(id));
    // Supabase Realtime often delivers the message row a little earlier than the
    // attachment row. If all short retries were exhausted, schedule a few quiet
    // background rescue passes instead of leaving a permanent empty skeleton.
    for (const id of freshIds) {
      const hydratedMessage = getState().currentMessages.find(message => message.id === id);
      const expected = Number((hydratedMessage as any)?.expected_attachment_count || 0);
      const hydratedCount = hydratedMessage?.attachments?.length || 0;
      const hydrated = expected > 0 ? hydratedCount >= expected : hydratedCount > 0;
      if (hydrated) {
        attachmentHydrationRetryCount.delete(id);
        const timer = attachmentHydrationRetryTimers.get(id);
        if (timer) window.clearTimeout(timer);
        attachmentHydrationRetryTimers.delete(id);
        continue;
      }
      const attempts = attachmentHydrationRetryCount.get(id) || 0;
      if (attempts >= 3 || attachmentHydrationRetryTimers.has(id)) continue;
      attachmentHydrationRetryCount.set(id, attempts + 1);
      const timer = window.setTimeout(() => {
        attachmentHydrationRetryTimers.delete(id);
        const message = getState().currentMessages.find(item => item.id === id && item.conversation_id === convId);
        if (message && messageExpectsAttachment(message)) {
          void hydrateMessageAttachments(convId, [id], setState, getState);
        }
      }, 12000 + attempts * 12000);
      attachmentHydrationRetryTimers.set(id, timer);
    }
  }
}


function mergeFetchedMessages(server: MessageWithSender[], local: MessageWithSender[], convId: string): MessageWithSender[] {
  const pending = local.filter(m =>
    m.conversation_id === convId &&
    (String(m.id).startsWith('temp_') || ['sending', 'queued', 'failed'].includes(String((m as any).status || '')))
  );
  const localById = new Map(local.filter(message => message.conversation_id === convId).map(message => [message.id, message]));
  const consumedTemps = new Set<string>();
  const merged = server.map(message => {
    const previousById = localById.get(message.id);
    const matchingTemp = pending.find(temp =>
      !consumedTemps.has(temp.id) &&
      temp.sender_id === message.sender_id &&
      temp.content === message.content &&
      String(temp.type) === String(message.type) &&
      Math.abs(new Date(message.created_at).getTime() - new Date(temp.created_at).getTime()) < 90000
    );
    const previous = previousById || matchingTemp;
    if (!previous) return message;
    if (matchingTemp) consumedTemps.add(matchingTemp.id);
    const serverHasAttachments = !!message.attachments?.length;
    return {
      ...previous,
      ...message,
      created_at: previous.created_at || message.created_at,
      server_created_at: (message as any).server_created_at || message.created_at,
      sender: message.sender || previous.sender,
      reply_to: message.reply_to || previous.reply_to || null,
      // Fetch может попасть между INSERT messages и INSERT file_attachments.
      // Сохраняем локальные blob-вложения до полной серверной гидрации.
      attachments: serverHasAttachments ? message.attachments : (previous.attachments || []),
      status: serverHasAttachments ? ((message as any).status || 'sent') : ((previous as any).status || 'sending'),
      client_id: (previous as any).client_id || (message as any).client_id || previous.id,
      expected_attachment_count: (previous as any).expected_attachment_count,
    } as MessageWithSender;
  });
  for (const temp of pending) {
    if (consumedTemps.has(temp.id)) continue;
    const duplicate = server.some(saved =>
      saved.sender_id === temp.sender_id &&
      saved.content === temp.content &&
      String(saved.type) === String(temp.type) &&
      Math.abs(new Date(saved.created_at).getTime() - new Date(temp.created_at).getTime()) < 90000
    );
    if (!duplicate && !merged.some(m => m.id === temp.id)) merged.push(temp);
  }
  return merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [], currentMessages: [], loadingConversations: false,
  loadingMessages: false, uploadProgress: 0, totalUnread: 0,
  typingUsers: {}, typingByConv: {}, memberReadTimes: {}, pinnedIds: [], blockedIds: [], hasMoreOlder: false, loadingOlder: false,

  fetchConversations: async (userId) => {
    if (!userId) return;
    set({ loadingConversations: true });

    // 1. Мгновенно отдаём из кэша
    try {
      const cached = await getCachedConversations();
      if (cached.length > 0) {
        set({ conversations: cached as any, loadingConversations: false });
      }
    } catch {}

    // 2. Оффлайн — останавливаемся на кэше
    if (!networkManager.isOnline()) {
      set({ loadingConversations: false });
      return;
    }

    const loadTimer = setTimeout(() => set({ loadingConversations: false }), 8000);
    try {
      // Every account owns exactly one private self-chat. The RPC creates it
      // atomically on first use and is safe to call on every refresh.
      const { error: savedError } = await supabase.rpc('ensure_saved_conversation');
      if (savedError) console.warn('ensure_saved_conversation:', savedError.message);

      const { data: mem } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', userId);
      if (!mem?.length) { set({ conversations: [], loadingConversations: false }); return; }
      const ids = mem.map(m => m.conversation_id);
      const { data: convs } = await supabase.from('conversations').select('*').in('id', ids).order('updated_at', { ascending: false });
      if (!convs?.length) { set({ conversations: [], loadingConversations: false }); return; }
      const enriched = await Promise.all(convs.map(async (c) => {
        try {
          const { data: members } = await supabase.from('conversation_members').select('*, user:users(*)').eq('conversation_id', c.id);
          const { data: lastMsg } = await supabase.from('messages').select('*').eq('conversation_id', c.id).is('deleted_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
          let unread = 0;
          const my = members?.find(m => m.user_id === userId);
          if (my?.last_read_at) {
            const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('conversation_id', c.id).neq('sender_id', userId).gt('created_at', my.last_read_at).is('deleted_at', null);
            unread = count || 0;
          }
          return { ...c, members: members || [], last_message: lastMsg || null, unread_count: unread, is_pinned: !!(my as any)?.is_pinned, is_muted: !!(my as any)?.is_muted, is_archived: !!(my as any)?.is_archived };
        } catch { return { ...c, members: [], last_message: null, unread_count: 0, is_pinned: false, is_muted: false, is_archived: false }; }
      }));
      // Закреплённые — наверх; внутри групп сохраняем порядок по времени.
      enriched.sort((a: any, b: any) => {
        if (!!a.is_saved !== !!b.is_saved) return a.is_saved ? -1 : 1;
        if (!!a.is_pinned !== !!b.is_pinned) return a.is_pinned ? -1 : 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
      set({ conversations: enriched });
      const total = enriched.reduce((sum, c) => sum + c.unread_count, 0);
      set({ totalUnread: total });
      updateBadge(total);

      // Кэшируем чаты и профили участников
      cacheConversations(enriched);
      const allUsers = enriched.flatMap((c: any) => (c.members || []).map((m: any) => m.user).filter(Boolean));
      cacheProfiles(allUsers);
    } catch (e) { console.error('fetchConv:', e); }
    finally { clearTimeout(loadTimer); set({ loadingConversations: false }); }
  },

  fetchMessages: async (convId) => {
    const myReqId = ++fetchMessagesReqId;
    set(state => {
      const sameConversation = state.currentMessages.length > 0 && state.currentMessages.every(m => m.conversation_id === convId);
      return { loadingMessages: true, currentMessages: sameConversation ? state.currentMessages : [] };
    });

    // 1. Мгновенно показываем из кэша
    try {
      const cached = await getCachedMessages(convId);
      if (myReqId !== fetchMessagesReqId) return;
      if (cached.length > 0) {
        const recentCached = [...cached].sort((a: any, b: any) => (a.created_at < b.created_at ? -1 : 1)).slice(-MSG_PAGE);
        const withSenders: MessageWithSender[] = await Promise.all(
          recentCached.map(async (m: any) => {
            const sender = m.sender || await getCachedProfile(m.sender_id);
            return {
              ...m,
              sender: sender || { id: m.sender_id, display_name: 'Пользователь' },
              reply_to: m.reply_to || null,
              attachments: m.attachments || [],
            };
          })
        );
        set(state => ({ currentMessages: mergeFetchedMessages(withSenders, state.currentMessages, convId), loadingMessages: false }));
        const missingAttachmentIds = withSenders.filter(messageExpectsAttachment).map(message => message.id);
        if (missingAttachmentIds.length) void hydrateMessageAttachments(convId, missingAttachmentIds, set, get);
      }
    } catch {}

    // 2. Оффлайн — останавливаемся
    if (!networkManager.isOnline()) {
      set({ loadingMessages: false });
      return;
    }

    const forceTimer = setTimeout(() => set({ loadingMessages: false }), 4000);
    try {
      // Исчезающие сообщения: не загружаем то что уже истекло.
      // expires_at IS NULL → обычное; expires_at > now → ещё живое.
      const nowIso = new Date().toISOString();
      const { data: raw } = await supabase
        .from('messages')
        .select('*, sender:users(*), attachments:file_attachments(*), reactions:message_reactions(*)')
        .eq('conversation_id', convId)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order('created_at', { ascending: false })
        .limit(MSG_PAGE);
      if (myReqId !== fetchMessagesReqId) { clearTimeout(forceTimer); return; }
      // Fetch replies separately
      const replyIds = (raw || []).filter(m => m.reply_to_id).map(m => m.reply_to_id);
      let repliesMap: Record<string, any> = {};
      if (replyIds.length > 0) {
        const { data: reps } = await supabase.from('messages').select('id, content, sender:users(display_name)').in('id', replyIds);
        if (reps) reps.forEach(r => { repliesMap[r.id] = r; });
      }
      const msgs: MessageWithSender[] = (raw || []).map(m => ({
        ...m,
        reply_to: m.reply_to_id && repliesMap[m.reply_to_id] ? repliesMap[m.reply_to_id] : null,
        attachments: m.attachments || [],
      })).reverse(); // получили новые-первыми → разворачиваем в хронологический порядок
      set(state => ({ currentMessages: mergeFetchedMessages(msgs, state.currentMessages, convId), hasMoreOlder: (raw?.length || 0) === MSG_PAGE }));
      const missingAttachmentIds = msgs.filter(messageExpectsAttachment).map(message => message.id);
      if (missingAttachmentIds.length) void hydrateMessageAttachments(convId, missingAttachmentIds, set, get);

      // Кэшируем свежие сообщения и профили
      cacheMessages(msgs);
      const uniqueSenders = Array.from(
        new Map(msgs.map(m => [m.sender?.id, m.sender] as [string | undefined, User | undefined]).filter((entry): entry is [string, User] => !!entry[0] && !!entry[1])).values()
      );
      cacheProfiles(uniqueSenders as any[]);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const readAt = new Date().toISOString();
        await supabase.from('conversation_members').update({ last_read_at: readAt }).eq('conversation_id', convId).eq('user_id', user.id);
        const conversations = get().conversations.map(c => c.id === convId ? {
          ...c,
          unread_count: 0,
          members: c.members.map((m: any) => m.user_id === user.id ? { ...m, last_read_at: readAt } : m),
        } : c);
        const total = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
        set({ conversations, totalUnread: total });
        updateBadge(total);
      }
    } catch (e) {
      console.error('fetchMsg:', e);
      setTimeout(async () => {
        try {
          const { data } = await supabase.from('messages').select('*, sender:users(*), attachments:file_attachments(*), reactions:message_reactions(*)').eq('conversation_id', convId).order('created_at', { ascending: false }).limit(MSG_PAGE);
          if (data) {
            const fallback = data.map(m => ({ ...m, reply_to: null, attachments: m.attachments || [] })).reverse() as MessageWithSender[];
            set(state => ({ currentMessages: mergeFetchedMessages(fallback, state.currentMessages, convId), hasMoreOlder: data.length === MSG_PAGE }));
            const missingAttachmentIds = fallback.filter(messageExpectsAttachment).map(message => message.id);
            if (missingAttachmentIds.length) void hydrateMessageAttachments(convId, missingAttachmentIds, set, get);
          }
        } catch {}
        set({ loadingMessages: false });
      }, 1000);
      return;
    }
    finally { clearTimeout(forceTimer); set({ loadingMessages: false }); }
  },

  loadOlderMessages: async (convId) => {
    const st = get();
    if (st.loadingOlder || !st.hasMoreOlder) return;
    const cur = st.currentMessages;
    if (!cur.length || !networkManager.isOnline()) return;
    const oldest = cur[0];
    set({ loadingOlder: true });
    try {
      const nowIso = new Date().toISOString();
      const { data: raw } = await supabase
        .from('messages')
        .select('*, sender:users(*), attachments:file_attachments(*), reactions:message_reactions(*)')
        .eq('conversation_id', convId)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .lt('created_at', oldest.created_at)
        .order('created_at', { ascending: false })
        .limit(MSG_PAGE);
      const older = raw || [];
      const replyIds = older.filter(m => m.reply_to_id).map(m => m.reply_to_id);
      const repliesMap: Record<string, any> = {};
      if (replyIds.length > 0) {
        const { data: reps } = await supabase.from('messages').select('id, content, sender:users(display_name)').in('id', replyIds);
        if (reps) reps.forEach(r => { repliesMap[r.id] = r; });
      }
      const olderMsgs: MessageWithSender[] = older.map(m => ({
        ...m,
        reply_to: m.reply_to_id && repliesMap[m.reply_to_id] ? repliesMap[m.reply_to_id] : null,
        attachments: m.attachments || [],
      })).reverse();
      const existing = new Set(get().currentMessages.map(m => m.id));
      const newOlder = olderMsgs.filter(m => !existing.has(m.id));
      set({ currentMessages: [...newOlder, ...get().currentMessages], hasMoreOlder: older.length === MSG_PAGE, loadingOlder: false });
      const missingAttachmentIds = newOlder.filter(messageExpectsAttachment).map(message => message.id);
      if (missingAttachmentIds.length) void hydrateMessageAttachments(convId, missingAttachmentIds, set, get);
      cacheMessages(newOlder);
    } catch (e) { console.error('loadOlder:', e); set({ loadingOlder: false }); }
  },

  sendMessage: async (convId, senderId, content, replyToId, extras) => {
    const trimmed = content.trim();
    if (!trimmed) return { error: 'empty' };

    const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const now = new Date().toISOString();
    const conv = get().conversations.find(c => c.id === convId);
    const senderFromConversation = (conv?.members || []).find((m: any) => m.user_id === senderId)?.user as User | undefined;
    const optimistic: MessageWithSender = {
      id: tempId,
      conversation_id: convId,
      sender_id: senderId,
      content: trimmed,
      type: 'text',
      created_at: now,
      updated_at: now,
      deleted_at: null,
      edited_at: null,
      reply_to_id: replyToId || null,
      sender: senderFromConversation || ({ id: senderId, display_name: 'Вы' } as any),
      reply_to: replyToId ? (get().currentMessages.find(m => m.id === replyToId) || null) : null,
      attachments: [],
      story_reply_snapshot: extras?.storyReplySnapshot || null,
      status: networkManager.isOnline() ? 'sending' : 'queued',
      client_id: tempId,
    } as any;

    // Критично для ощущения скорости: добавляем сообщение синхронно, до IndexedDB и сети.
    set(state => ({
      currentMessages: [...state.currentMessages, optimistic],
      conversations: state.conversations.map(c => c.id === convId
        ? { ...c, last_message: optimistic, updated_at: now }
        : c),
    }));

    // Профиль из локального кэша подставляем в фоне, не задерживая первый кадр сообщения.
    void getCachedProfile(senderId).then(profile => {
      if (!profile) return;
      set(state => ({
        currentMessages: state.currentMessages.map(m => m.id === tempId ? ({ ...m, sender: profile } as MessageWithSender) : m),
      }));
    }).catch(() => {});

    if (!networkManager.isOnline()) {
      const queued: QueuedMessage = {
        tempId,
        conversation_id: convId,
        sender_id: senderId,
        content: trimmed,
        type: 'text',
        reply_to_id: replyToId || null,
        story_reply_snapshot: extras?.storyReplySnapshot || null,
        created_at: now,
        retries: 0,
      };
      await addToQueue(queued);
      return { error: null };
    }

    const insert: any = { conversation_id: convId, sender_id: senderId, content: trimmed, type: 'text' };
    if (replyToId) insert.reply_to_id = replyToId;
    if (extras?.storyReplySnapshot) insert.story_reply_snapshot = extras.storyReplySnapshot;
    const { data: inserted, error } = await supabase
      .from('messages')
      .insert(insert)
      .select('*, sender:users(*), attachments:file_attachments(*), reactions:message_reactions(*)')
      .single();
    if (error || !inserted) {
      set(state => ({
        currentMessages: state.currentMessages.map(m => m.id === tempId ? ({ ...(m as any), status: 'failed' } as any) : m),
      }));
      return { error: error?.message || 'Не удалось отправить' };
    }

    const saved = {
      ...inserted,
      sender: inserted.sender || senderFromConversation || optimistic.sender,
      attachments: inserted.attachments || [],
      reply_to: optimistic.reply_to,
      status: 'sent',
      client_id: tempId,
    } as any;
    set(state => ({
      currentMessages: state.currentMessages.map(m => m.id === tempId ? saved : m),
      conversations: state.conversations.map(c => c.id === convId ? { ...c, last_message: saved, updated_at: saved.created_at || now } : c),
    }));
    cacheMessages([saved]);
    if (saved.sender) cacheProfiles([saved.sender as any]);
    void supabase.from('conversations').update({ updated_at: saved.created_at || now }).eq('id', convId);
    void notifyMessageRecipients(saved.id);
    return { error: null };
  },

  sendWidgetMessage: async (convId, senderId, content, type) => {
    const tempId = 'temp_widget_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const now = new Date().toISOString();
    const conv = get().conversations.find(c => c.id === convId);
    const senderFromConversation = (conv?.members || []).find((m: any) => m.user_id === senderId)?.user as User | undefined;
    const optimistic: MessageWithSender = {
      id: tempId,
      conversation_id: convId,
      sender_id: senderId,
      content,
      type,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      reply_to_id: null,
      sender: senderFromConversation || ({ id: senderId, display_name: 'Вы' } as any),
      reply_to: null,
      attachments: [],
      status: 'sending',
      client_id: tempId,
    } as any;

    set(state => {
      const chatIsOpen = state.currentMessages.length === 0 || state.currentMessages.some(message => message.conversation_id === convId);
      return {
        currentMessages: chatIsOpen ? [...state.currentMessages, optimistic] : state.currentMessages,
        conversations: state.conversations.map(c => c.id === convId
          ? { ...c, last_message: optimistic, updated_at: now }
          : c),
      };
    });

    void getCachedProfile(senderId).then(profile => {
      if (!profile) return;
      set(state => ({
        currentMessages: state.currentMessages.map(message => message.id === tempId
          ? ({ ...message, sender: profile } as MessageWithSender)
          : message),
      }));
    }).catch(() => {});

    const { data: inserted, error } = await supabase
      .from('messages')
      .insert({ conversation_id: convId, sender_id: senderId, content, type })
      .select('*, sender:users(*), attachments:file_attachments(*), reactions:message_reactions(*)')
      .single();

    if (error || !inserted) {
      set(state => ({
        currentMessages: state.currentMessages.map(message => message.id === tempId
          ? ({ ...(message as any), status: 'failed' } as any)
          : message),
      }));
      return { id: null, error: error?.message || 'Не удалось отправить виджет' };
    }

    const saved = {
      ...inserted,
      sender: inserted.sender || senderFromConversation || optimistic.sender,
      attachments: inserted.attachments || [],
      reply_to: null,
      status: 'sent',
      client_id: tempId,
    } as any;

    set(state => {
      const alreadyPresent = state.currentMessages.some(message => message.id === saved.id);
      const withoutTemp = state.currentMessages.filter(message => message.id !== tempId);
      const chatIsOpen = withoutTemp.length === 0 || withoutTemp.some(message => message.conversation_id === convId);
      return {
        currentMessages: alreadyPresent || !chatIsOpen ? withoutTemp : [...withoutTemp, saved],
        conversations: state.conversations.map(c => c.id === convId
          ? { ...c, last_message: saved, updated_at: saved.created_at || now }
          : c),
      };
    });

    void cacheMessages([saved]);
    if (saved.sender) void cacheProfiles([saved.sender as any]);
    void supabase.from('conversations').update({ updated_at: saved.created_at || now }).eq('id', convId);
    void notifyMessageRecipients(saved.id);
    return { id: saved.id, error: null };
  },

  retrySend: async (msg) => {
    const m: any = msg;
    set(s => ({ currentMessages: s.currentMessages.filter(x => x.id !== m.id) }));
    if (m.type && m.type !== 'text') {
      const result = await get().sendWidgetMessage(m.conversation_id, m.sender_id, m.content, m.type);
      return { error: result.error };
    }
    return get().sendMessage(m.conversation_id, m.sender_id, m.content, m.reply_to_id || undefined);
  },

  forwardMessage: async (targetConvId, senderId, original) => {
    if ((original as any).is_encrypted) return { error: 'Зашифрованные сообщения нельзя пересылать' };
    // Сохраняем исходного автора (если пересылают уже пересланное — берём оригинал)
    const fromName = (original as any).forwarded_from_name || original.sender?.display_name || 'Неизвестно';
    const fromId = (original as any).forwarded_from_id || original.sender_id || null;
    const type = original.type === 'system' ? 'text' : original.type;
    const insert: any = {
      conversation_id: targetConvId,
      sender_id: senderId,
      content: original.content,
      type,
      forwarded_from_name: fromName,
      forwarded_from_id: fromId,
    };
    const { data: msg, error } = await supabase.from('messages').insert(insert).select().single();
    if (error || !msg) return { error: error?.message || 'Не удалось переслать' };

    const atts = (original.attachments || []) as any[];
    if (atts.length) {
      const rows = atts.map(a => ({
        message_id: msg.id,
        file_url: a.file_url,
        file_name: a.file_name,
        file_size: a.file_size,
        mime_type: a.mime_type,
        encrypted_iv: a.encrypted_iv ?? null,
        is_encrypted: a.is_encrypted ?? false,
      }));
      await supabase.from('file_attachments').insert(rows);
    }
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', targetConvId);
    void notifyMessageRecipients(msg.id);
    return { error: null };
  },

  sendFileMessage: async (convId, senderId, file, encryptionOpts, extras) => {
    set({ uploadProgress: 0 });

    const now = new Date().toISOString();
    const tempId = 'temp_file_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const localUrl = URL.createObjectURL(file);
    const conv = get().conversations.find(c => c.id === convId);
    const senderFromConversation = (conv?.members || []).find((m: any) => m.user_id === senderId)?.user as User | undefined;

    let msgType: string = 'file';
    if (file.type.startsWith('image/')) msgType = 'image';
    if (file.type.startsWith('audio/')) msgType = 'voice';
    const isVoice = msgType === 'voice' || /^voice_/i.test(file.name);
    const isVideoNote = /^videonote_/i.test(file.name);
    const auto = msgType === 'image' ? 'Фото' : (isVoice || isVideoNote) ? file.name : file.name;
    const content = (extras?.caption && extras.caption.trim() && !isVoice && !isVideoNote && !encryptionOpts?.password)
      ? extras.caption.trim()
      : auto;

    const optimisticAttachment: FileAttachment = {
      id: 'temp_att_' + tempId,
      message_id: tempId,
      file_url: localUrl,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      thumbnail_url: null,
      width: isVideoNote ? 480 : null,
      height: isVideoNote ? 480 : null,
    };
    const optimistic: MessageWithSender = {
      id: tempId,
      conversation_id: convId,
      sender_id: senderId,
      content,
      type: msgType as any,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      reply_to_id: null,
      sender: senderFromConversation || ({ id: senderId, display_name: 'Вы' } as any),
      reply_to: null,
      attachments: [optimisticAttachment],
      status: 'sending',
      client_id: tempId,
    } as any;

    // Audio/video notes and files appear in the chat immediately, before upload.
    set(state => ({
      currentMessages: [...state.currentMessages, optimistic],
      conversations: state.conversations.map(c => c.id === convId
        ? { ...c, last_message: optimistic, updated_at: now }
        : c),
    }));

    const dimsPromise = (file.type.startsWith('image/') || file.type.startsWith('video/'))
      ? getMediaDimensions(file)
      : Promise.resolve(null);
    void dimsPromise.then(dims => {
      if (!dims) return;
      set(state => ({
        currentMessages: state.currentMessages.map(message => message.id === tempId
          ? ({ ...message, attachments: message.attachments.map(att => ({ ...att, width: dims.width, height: dims.height })) } as MessageWithSender)
          : message),
      }));
    }).catch(() => {});

    try {
      let uploadedFile = file;
      let encData: any = null;
      if (encryptionOpts?.password) {
        const enc = await encryptFile(file, encryptionOpts.password, convId);
        uploadedFile = enc.file;
        encData = { iv: enc.iv, origName: enc.origName, origMime: enc.origMime };
      }

      const res = await uploadFile(convId, uploadedFile, progress => set({ uploadProgress: progress }));
      if (res.error) {
        set(state => ({ currentMessages: state.currentMessages.map(message => message.id === tempId ? ({ ...message, status: 'failed' } as any) : message) }));
        set({ uploadProgress: 0 });
        return { error: res.error };
      }

      const insertPayload: any = { conversation_id: convId, sender_id: senderId, content, type: msgType, is_encrypted: !!encData };
      if (extras?.is_spoiler) insertPayload.is_spoiler = true;
      if (extras?.expires_at) insertPayload.expires_at = extras.expires_at;
      const { data: msg, error } = await supabase
        .from('messages')
        .insert(insertPayload)
        .select('*, sender:users(*)')
        .single();
      if (error || !msg) {
        set(state => ({ currentMessages: state.currentMessages.map(message => message.id === tempId ? ({ ...message, status: 'failed' } as any) : message) }));
        set({ uploadProgress: 0 });
        return { error: error?.message || 'Не удалось отправить файл' };
      }

      const dims = await dimsPromise;
      const attachmentPayload = {
        message_id: msg.id,
        file_url: res.url,
        file_name: encData ? encData.origName : file.name,
        file_size: file.size,
        mime_type: encData ? encData.origMime : file.type,
        encrypted_iv: encData ? encData.iv : null,
        is_encrypted: !!encData,
        width: dims?.width ?? (isVideoNote ? 480 : null),
        height: dims?.height ?? (isVideoNote ? 480 : null),
      };
      const { data: insertedAttachment, error: attachmentError } = await supabase
        .from('file_attachments')
        .insert(attachmentPayload)
        .select('*')
        .single();
      if (attachmentError) {
        set(state => ({ currentMessages: state.currentMessages.map(message => (message.id === tempId || message.id === msg.id) ? ({ ...message, status: 'failed' } as any) : message) }));
        set({ uploadProgress: 0 });
        return { error: attachmentError.message };
      }

      const attachment = (insertedAttachment || { id: 'att_' + msg.id, thumbnail_url: null, ...attachmentPayload }) as FileAttachment;
      const saved: MessageWithSender = {
        ...msg,
        // Не меняем визуальную временную шкалу локального сообщения в момент
        // clock -> check. Серверное время сохраняем отдельно для служебных задач.
        created_at: optimistic.created_at,
        server_created_at: msg.created_at,
        sender: msg.sender || senderFromConversation || optimistic.sender,
        reply_to: null,
        attachments: [{
          ...attachment,
          width: attachment.width ?? optimisticAttachment.width,
          height: attachment.height ?? optimisticAttachment.height,
        }],
        status: 'sent',
        client_id: tempId,
      } as any;

      set(state => {
        let replaced = false;
        const next: MessageWithSender[] = [];
        const seen = new Set<string>();
        for (const message of state.currentMessages) {
          let candidate = message;
          if (message.id === tempId || message.id === msg.id) {
            candidate = saved;
            replaced = true;
          }
          if (seen.has(candidate.id)) continue;
          seen.add(candidate.id);
          next.push(candidate);
        }
        if (!replaced) next.push(saved);
        return {
          currentMessages: next,
          conversations: state.conversations.map(c => c.id === convId
            ? { ...c, last_message: saved, updated_at: saved.created_at || now }
            : c),
        };
      });
      cacheMessages([saved]);
      if (saved.sender) cacheProfiles([saved.sender]);
      void supabase.from('conversations').update({ updated_at: saved.created_at || now }).eq('id', convId);
      void notifyMessageRecipients(msg.id);
      window.setTimeout(() => URL.revokeObjectURL(localUrl), 15000);
      set({ uploadProgress: 0 });
      return { error: null };
    } catch (sendError: any) {
      set(state => ({ currentMessages: state.currentMessages.map(message => message.id === tempId ? ({ ...message, status: 'failed' } as any) : message) }));
      set({ uploadProgress: 0 });
      return { error: sendError?.message || 'Не удалось отправить файл' };
    }
  },

  sendAlbumMessage: async (convId, senderId, files, onProgress, extras) => {
    if (!files.length) return { error: 'empty' };
    if (files.length > 10) files = files.slice(0, 10);
    set({ uploadProgress: 0 });

    const now = new Date().toISOString();
    const tempId = 'temp_group_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const conv = get().conversations.find(c => c.id === convId);
    const senderFromConversation = (conv?.members || []).find((m: any) => m.user_id === senderId)?.user as User | undefined;
    const isMedia = (file: File) => file.type.startsWith('image/') || file.type.startsWith('video/');
    const allMedia = files.every(isMedia);
    const hasVideo = files.some(file => file.type.startsWith('video/'));
    const hasImage = files.some(file => file.type.startsWith('image/'));
    const msgType = allMedia ? 'album' : 'file';
    const auto = allMedia
      ? `📸 ${files.length} ${hasVideo && !hasImage ? 'видео' : hasImage && !hasVideo ? 'фото' : 'медиа'}`
      : `📎 ${files.length} файлов`;
    const content = extras?.caption?.trim() || auto;

    const localUrls = files.map(file => URL.createObjectURL(file));
    const optimisticAttachments: FileAttachment[] = files.map((file, index) => ({
      id: `temp_att_${tempId}_${index}`,
      message_id: tempId,
      file_url: localUrls[index],
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || 'application/octet-stream',
      thumbnail_url: null,
      width: null,
      height: null,
    }));
    const optimistic: MessageWithSender = {
      id: tempId,
      conversation_id: convId,
      sender_id: senderId,
      content,
      type: msgType as any,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      reply_to_id: null,
      sender: senderFromConversation || ({ id: senderId, display_name: 'Вы' } as any),
      reply_to: null,
      attachments: optimisticAttachments,
      status: 'sending',
      client_id: tempId,
      is_spoiler: !!extras?.is_spoiler,
      expires_at: extras?.expires_at || null,
      expected_attachment_count: files.length,
    } as any;

    // Одна локальная запись сразу показывает весь альбом/пакет файлов.
    set(state => ({
      currentMessages: [...state.currentMessages, optimistic],
      conversations: state.conversations.map(c => c.id === convId
        ? { ...c, last_message: optimistic, updated_at: now }
        : c),
    }));

    // Размеры медиа вычисляются параллельно и подставляются без ожидания загрузки.
    const dimensionPromises = files.map(file => isMedia(file) ? getMediaDimensions(file) : Promise.resolve(null));
    dimensionPromises.forEach((promise, index) => {
      void promise.then(dims => {
        if (!dims) return;
        set(state => ({
          currentMessages: state.currentMessages.map(message => message.id === tempId
            ? ({
                ...message,
                attachments: message.attachments.map((attachment, attachmentIndex) => attachmentIndex === index
                  ? { ...attachment, width: dims.width, height: dims.height }
                  : attachment),
              } as MessageWithSender)
            : message),
        }));
      }).catch(() => {});
    });

    try {
      // Сначала загружаем все объекты. Серверное сообщение создаётся только после
      // успешной загрузки пакета, поэтому у получателя не возникает пустой карточки.
      const uploaded: Array<{
        file: File;
        url: string;
        width: number | null;
        height: number | null;
      }> = [];

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const result = await uploadFile(convId, file, progress => {
          const totalProgress = ((index + progress / 100) / files.length) * 100;
          set({ uploadProgress: totalProgress });
          onProgress?.(index, files.length, progress);
        });
        if (result.error || !result.url) {
          throw new Error(result.error || `Не удалось загрузить ${file.name}`);
        }
        const dims = await dimensionPromises[index];
        uploaded.push({
          file,
          url: result.url,
          width: dims?.width ?? null,
          height: dims?.height ?? null,
        });
      }

      const insertPayload: any = {
        conversation_id: convId,
        sender_id: senderId,
        content,
        type: msgType,
        is_encrypted: false,
      };
      if (extras?.is_spoiler) insertPayload.is_spoiler = true;
      if (extras?.expires_at) insertPayload.expires_at = extras.expires_at;

      const { data: msg, error: messageError } = await supabase
        .from('messages')
        .insert(insertPayload)
        .select('*, sender:users(*)')
        .single();
      if (messageError || !msg) throw new Error(messageError?.message || 'Не удалось создать группу вложений');

      const attachmentPayloads = uploaded.map(item => ({
        message_id: msg.id,
        file_url: item.url,
        file_name: item.file.name,
        file_size: item.file.size,
        mime_type: item.file.type || 'application/octet-stream',
        is_encrypted: false,
        width: item.width,
        height: item.height,
      }));
      const { data: insertedAttachments, error: attachmentError } = await supabase
        .from('file_attachments')
        .insert(attachmentPayloads)
        .select('*');
      if (attachmentError) {
        // Не оставляем в чате серверное сообщение без вложений.
        await supabase.from('messages').delete().eq('id', msg.id);
        throw new Error(attachmentError.message);
      }

      const finalAttachments: FileAttachment[] = attachmentPayloads.map((payload, index) => ({
        id: (insertedAttachments as any[] | null)?.[index]?.id || `att_${msg.id}_${index}`,
        thumbnail_url: (insertedAttachments as any[] | null)?.[index]?.thumbnail_url || null,
        ...(insertedAttachments as any[] | null)?.[index],
        ...payload,
      })) as FileAttachment[];

      const saved: MessageWithSender = {
        ...msg,
        created_at: optimistic.created_at,
        server_created_at: msg.created_at,
        sender: msg.sender || senderFromConversation || optimistic.sender,
        reply_to: null,
        attachments: finalAttachments,
        status: 'sent',
        client_id: tempId,
        expected_attachment_count: files.length,
      } as any;

      set(state => {
        let replaced = false;
        const next: MessageWithSender[] = [];
        const seen = new Set<string>();
        for (const message of state.currentMessages) {
          let candidate = message;
          if (message.id === tempId || message.id === msg.id) {
            candidate = saved;
            replaced = true;
          }
          if (seen.has(candidate.id)) continue;
          seen.add(candidate.id);
          next.push(candidate);
        }
        if (!replaced) next.push(saved);
        return {
          currentMessages: next,
          conversations: state.conversations.map(c => c.id === convId
            ? { ...c, last_message: saved, updated_at: saved.created_at || now }
            : c),
        };
      });

      cacheMessages([saved]);
      if (saved.sender) cacheProfiles([saved.sender]);
      void supabase.from('conversations').update({ updated_at: msg.created_at || now }).eq('id', convId);
      void notifyMessageRecipients(msg.id);
      window.setTimeout(() => localUrls.forEach(url => URL.revokeObjectURL(url)), 30000);
      set({ uploadProgress: 0 });
      return { error: null };
    } catch (sendError: any) {
      set(state => ({
        currentMessages: state.currentMessages.map(message => message.id === tempId
          ? ({ ...message, status: 'failed' } as any)
          : message),
      }));
      window.setTimeout(() => localUrls.forEach(url => URL.revokeObjectURL(url)), 5 * 60 * 1000);
      set({ uploadProgress: 0 });
      return { error: sendError?.message || 'Не удалось отправить группу вложений' };
    }
  },

  deleteMessage: async (msgId) => {
    await supabase.from('messages').update({ deleted_at: new Date().toISOString(), content: '' }).eq('id', msgId);
    set(s => ({
      currentMessages: s.currentMessages.map(m =>
        m.id === msgId ? { ...m, deleted_at: new Date().toISOString(), content: '' } : m
      ),
    }));
  },

  createDirectChat: async (myId, targetId, forceNew = false, isEncrypted = false) => {
    if (!forceNew && !isEncrypted) {
      const { data: my } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', myId);
      const { data: their } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', targetId);
      if (my && their) {
        const mySet = new Set(my.map(m => m.conversation_id));
        const common = their.filter(m => mySet.has(m.conversation_id)).map(m => m.conversation_id);
        if (common.length) {
          // Only reuse non-encrypted chat
          const { data: dc } = await supabase.from('conversations').select('id').in('id', common).eq('type', 'direct').eq('is_encrypted', false).limit(1).maybeSingle();
          if (dc) return { id: dc.id, error: null };
        }
      }
    }
    const { data: conv, error } = await supabase.from('conversations').insert({ type: 'direct', created_by: myId, is_encrypted: isEncrypted }).select().single();
    if (error || !conv) return { id: '', error: error?.message || 'Error' };
    await supabase.from('conversation_members').insert([{ conversation_id: conv.id, user_id: myId, role: 'admin' }, { conversation_id: conv.id, user_id: targetId, role: 'member' }]);
    return { id: conv.id, error: null };
  },

  createGroupChat: async (myId, memberIds, name, isEncrypted = false) => {
    const { data: conv, error } = await supabase.from('conversations').insert({
      type: 'group', name: name.trim(), created_by: myId, is_encrypted: isEncrypted,
    }).select().single();
    if (error || !conv) return { id: '', error: error?.message || 'Error' };
    const allMembers = [myId, ...memberIds];
    await supabase.from('conversation_members').insert(
      allMembers.map(uid => ({
        conversation_id: conv.id,
        user_id: uid,
        role: uid === myId ? 'admin' : 'member',
      }))
    );
    // Send system message
    await supabase.from('messages').insert({
      conversation_id: conv.id, sender_id: myId,
      content: 'Группа создана', type: 'system',
    });
    return { id: conv.id, error: null };
  },

  addGroupMember: async (convId, userId, actorId) => {
    const { error } = await supabase.from('conversation_members').insert({
      conversation_id: convId, user_id: userId, role: 'member',
    });
    if (!error) {
      const { data: people } = await supabase
        .from('users')
        .select('id, display_name')
        .in('id', [actorId, userId]);
      const actorName = people?.find((person: any) => person.id === actorId)?.display_name || 'Участник';
      const addedName = people?.find((person: any) => person.id === userId)?.display_name || 'нового участника';
      const systemResult = await get().sendWidgetMessage(
        convId,
        actorId,
        `${actorName} добавил(а) в группу: ${addedName}`,
        'system',
      );
      if (systemResult.error) console.error('addGroupMember system message:', systemResult.error);
    }
    return { error: error?.message || null };
  },

  removeGroupMember: async (convId, userId) => {
    const { data: u } = await supabase.from('users').select('display_name').eq('id', userId).single();
    const { error } = await supabase.from('conversation_members').delete().eq('conversation_id', convId).eq('user_id', userId);
    if (!error) {
      await supabase.from('messages').insert({
        conversation_id: convId, sender_id: userId,
        content: (u?.display_name || 'Участник') + ' удалён из группы', type: 'system',
      });
    }
    return { error: error?.message || null };
  },

  leaveGroup: async (convId, userId) => {
    const { data: u } = await supabase.from('users').select('display_name').eq('id', userId).single();
    await supabase.from('messages').insert({ conversation_id: convId, sender_id: userId, content: (u?.display_name || 'Участник') + ' покинул группу', type: 'system' });
    await supabase.from('conversation_members').delete().eq('conversation_id', convId).eq('user_id', userId);
  },

  deleteGroup: async (convId) => {
    const { error: e1 } = await supabase.from('messages').delete().eq('conversation_id', convId);
    if (e1) console.error('Delete messages:', e1.message);
    const { error: e2 } = await supabase.from('conversation_members').delete().eq('conversation_id', convId);
    if (e2) console.error('Delete members:', e2.message);
    const { error: e3 } = await supabase.from('conversations').delete().eq('id', convId);
    if (e3) { toast.error('Ошибка: ' + e3.message + '. Выполни SQL миграцию 008.'); return; }
  },

  renameGroup: async (convId, name) => {
    const { error } = await supabase.from('conversations').update({ name: name.trim() }).eq('id', convId);
    return { error: error?.message || null };
  },

  subscribeToMessages: (convId) => {
    const ch = supabase.channel('msg:' + convId).on('postgres_changes', {
      event: '*', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + convId,
    }, async (payload) => {
      // Handle UPDATE (delete, edit)
      if (payload.eventType === 'UPDATE') {
        const updated = payload.new as Message;
        set(s => ({
          currentMessages: s.currentMessages.map(m =>
            m.id === updated.id ? { ...m, ...updated } : m
          ),
        }));
        return;
      }
      // Handle INSERT
      const msg = payload.new as Message;
      if (msg.deleted_at) return;
      if (get().currentMessages.find(m => m.id === msg.id)) return;
      const [{ data: sender }, replyResult] = await Promise.all([
        supabase.from('users').select('*').eq('id', msg.sender_id).single(),
        msg.reply_to_id
          ? supabase.from('messages').select('id, content, sender:users(display_name)').eq('id', msg.reply_to_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      if (!sender) return;
      const replyTo = (replyResult as any)?.data || null;
      const baseEnriched: MessageWithSender = { ...msg, sender: sender as User, reply_to: replyTo, attachments: [] };
      let messageForCache: MessageWithSender = baseEnriched;
      set(s => {
        const matchingTemp = s.currentMessages.find(m =>
          String(m.id).startsWith('temp_') &&
          m.sender_id === msg.sender_id &&
          m.content === msg.content &&
          String(m.type) === String(msg.type) &&
          Math.abs(new Date(m.created_at).getTime() - new Date(msg.created_at).getTime()) < 60000
        );
        const enriched = matchingTemp ? ({
          ...baseEnriched,
          // Сообщение INSERT приходит раньше строки file_attachments. Сохраняем
          // локальное blob-вложение и геометрию, чтобы аудио/кружок не исчезали
          // между отправкой и появлением галочки.
          created_at: matchingTemp.created_at,
          server_created_at: msg.created_at,
          sender: baseEnriched.sender || matchingTemp.sender,
          reply_to: baseEnriched.reply_to || matchingTemp.reply_to || null,
          attachments: matchingTemp.attachments || [],
          status: (matchingTemp as any).status || 'sending',
          client_id: (matchingTemp as any).client_id || matchingTemp.id,
          expected_attachment_count: (matchingTemp as any).expected_attachment_count,
        } as any) : baseEnriched;
        // Не кладём временный blob URL в долговременный кеш. Финальная версия с
        // серверным attachment будет закеширована после upload/гидрации.
        messageForCache = matchingTemp ? baseEnriched : enriched;
        const filtered = s.currentMessages.filter(m => {
          if (!String(m.id).startsWith('temp_')) return true;
          return !(m.sender_id === msg.sender_id && m.content === msg.content);
        });
        if (filtered.find(m => m.id === msg.id)) return { currentMessages: filtered };
        return { currentMessages: [...filtered, enriched] };
      });

      if (messageExpectsAttachment(baseEnriched)) {
        void hydrateMessageAttachments(convId, [msg.id], set, get);
      }

      // Кэшируем
      cacheMessages([messageForCache]);
      if (sender) cacheProfiles([sender]);
      const { data: { user } } = await supabase.auth.getUser();
      if (user && msg.sender_id !== user.id) {
        const enc = !!(msg as any).is_encrypted;
        const mentionedMe = !enc && isUserMentioned(msg.content || '', user.id);
        const currentConversation = get().conversations.find(conversation => conversation.id === convId);
        const chatMuted = !!currentConversation?.is_muted;
        const activeChatVisible = document.visibilityState === 'visible'
          && window.location.pathname === `/chat/${convId}`;
        const shouldAlert = !chatMuted || mentionedMe;
        const categoryEnabled = currentConversation?.type === 'group'
          ? getNotifPref('group')
          : getNotifPref('msg');
        if (activeChatVisible && shouldAlert && getNotifPref('sndMsg')) playMessageSound();
        if (!activeChatVisible && shouldAlert && getNotifPref('master') && (categoryEnabled || mentionedMe)) {
          const pushActive = await hasActivePushSubscription();
          if (!pushActive) {
            const body = enc
              ? '🔒 Новое сообщение'
              : msg.type === 'call'
                ? 'Звонок'
                : (getNotifPref('preview') ? stripMentionTokens(msg.content || '').substring(0, 80) : 'Новое сообщение');
            const title = mentionedMe ? `${(sender as any).display_name} упомянул(а) вас` : (sender as any).display_name;
            void showNotification(title, body, {
              tag: `message-${msg.id}`,
              url: `/chat/${convId}`,
            });
          }
        }
        const newTotal = get().totalUnread + 1;
        set({ totalUnread: newTotal });
        updateBadge(newTotal);
      }
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  },

  subscribeToConversations: (userId) => {
    let timer: any = null;
    const ch = supabase.channel('conv-upd').on('postgres_changes', {
      event: '*', schema: 'public', table: 'messages',
    }, () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => get().fetchConversations(userId), 2000);
    }).subscribe();
    return () => { if (timer) clearTimeout(timer); supabase.removeChannel(ch); };
  },

  // Typing indicator via broadcast
  subscribeToTyping: (convId, myId) => {
    const ch = supabase.channel('typing:' + convId);
    ch.on('broadcast', { event: 'typing' }, (msg) => {
      const { userId, displayName } = msg.payload;
      if (userId === myId) return;
      // Set typing with auto-clear after 3s
      const prev = get().typingUsers[userId];
      if (prev?.timer) clearTimeout(prev.timer);
      const timer = setTimeout(() => {
        set(s => {
          const copy = { ...s.typingUsers };
          delete copy[userId];
          return { typingUsers: copy };
        });
      }, 3000);
      set(s => ({ typingUsers: { ...s.typingUsers, [userId]: { name: displayName, timer } } }));
    }).subscribe();
    return () => { supabase.removeChannel(ch); set({ typingUsers: {} }); };
  },

  subscribeListTyping: (convIds, myId) => {
    // Подписка на «печатает» сразу по всем чатам списка (тот же топик typing:convId).
    const channels = convIds.map(convId => {
      const ch = supabase.channel('typing:' + convId);
      ch.on('broadcast', { event: 'typing' }, (msg) => {
        const { userId, displayName } = msg.payload;
        if (userId === myId) return;
        set(s => {
          const prev = s.typingByConv[convId];
          if (prev?.timer) clearTimeout(prev.timer);
          const timer = setTimeout(() => {
            set(s2 => { const copy = { ...s2.typingByConv }; delete copy[convId]; return { typingByConv: copy }; });
          }, 4000);
          return { typingByConv: { ...s.typingByConv, [convId]: { name: displayName, timer } } };
        });
      }).subscribe();
      return ch;
    });
    return () => { channels.forEach(ch => supabase.removeChannel(ch)); };
  },

  sendTyping: (convId, userId, displayName) => {
    if (typingDebounce) return; // Max once per 2s
    typingDebounce = setTimeout(() => { typingDebounce = null; }, 2000);
    const ch = supabase.channel('typing:' + convId);
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        ch.send({ type: 'broadcast', event: 'typing', payload: { userId, displayName } });
        setTimeout(() => supabase.removeChannel(ch), 1000);
      }
    });
  },

  fetchReadReceipts: async (convId, myId) => {
    const { data } = await supabase.from('conversation_members').select('user_id, last_read_at').eq('conversation_id', convId).neq('user_id', myId);
    if (data) {
      const map: Record<string, string> = {};
      data.forEach(m => { if (m.last_read_at) map[m.user_id] = m.last_read_at; });
      set({ memberReadTimes: map });
    }
  },

  searchUsers: async (q, myId) => {
    let req = supabase.from('users').select('*').neq('id', myId).limit(50);
    if (q.trim()) req = req.or('display_name.ilike.%' + q + '%,email.ilike.%' + q + '%');
    const { data } = await req;
    // Исключаем технический Tinder-аккаунт из поиска (нельзя начать с ним чат)
    return ((data as User[]) || []).filter(u => u.email !== 'tinder@sigmas.local');
  },

  searchMessages: async (q, userId) => {
    if (!q.trim()) return [];
    try {
      const { data: mem, error: memErr } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', userId);
      if (memErr) { console.error('search members:', memErr); return []; }
      if (!mem?.length) return [];
      const convIds = mem.map(m => m.conversation_id);
      // Search unencrypted messages in DB
      const { data, error } = await supabase.from('messages').select('*, sender:users(*), conversation:conversations(*)').in('conversation_id', convIds).eq('is_encrypted', false).ilike('content', '%' + q + '%').order('created_at', { ascending: false }).limit(30);
      if (error) { console.error('search msgs:', error); return []; }
      const results = (data || []).map(m => ({ message: m, conversation: m.conversation, sender: m.sender }));
      // Also search encrypted messages in chats with known password (decrypt locally, all in parallel)
      const encSearches = convIds
        .filter(cid => getChatPassword(cid))
        .map(async (cid) => {
          const pw = getChatPassword(cid)!;
          const { data: encMsgs } = await supabase.from('messages').select('*, sender:users(*), conversation:conversations(*)').eq('conversation_id', cid).eq('is_encrypted', true).order('created_at', { ascending: false }).limit(100);
          const decryptedMsgs = await Promise.all((encMsgs || []).map(async (em) => {
            try {
              const plain = await decryptMessage(em.content, (em as any).encrypted_iv, pw, cid);
              if (plain.toLowerCase().includes(q.toLowerCase())) {
                return { message: { ...em, content: plain }, conversation: em.conversation, sender: em.sender };
              }
            } catch {}
            return null;
          }));
          return decryptedMsgs.filter(Boolean);
        });
      const encResults = (await Promise.all(encSearches)).flat();
      results.push(...encResults as any[]);
      return results.slice(0, 50);
    } catch (e) { console.error('searchMessages:', e); return []; }
  },

  updateLastSeen: async (userId) => {
    await supabase.from('users').update({ last_seen: new Date().toISOString(), status: 'online' }).eq('id', userId);
  },

  toggleReaction: async (messageId, userId, emoji, active) => {
    const { data: existing, error: lookupError } = await supabase
      .from('message_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('emoji', emoji)
      .maybeSingle();
    if (lookupError) throw lookupError;

    const shouldBeActive = active ?? !existing;
    if (shouldBeActive && !existing) {
      const { error } = await supabase
        .from('message_reactions')
        .insert({ message_id: messageId, user_id: userId, emoji });
      if (error) throw error;
    } else if (!shouldBeActive && existing) {
      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('id', existing.id);
      if (error) throw error;
    }
  },

  fetchReactions: async (messageIds) => {
    if (!messageIds.length) return {};
    const { data } = await supabase.from('message_reactions').select('*').in('message_id', messageIds);
    const map: Record<string, Reaction[]> = {};
    (data || []).forEach(r => { if (!map[r.message_id]) map[r.message_id] = []; map[r.message_id].push(r); });
    return map;
  },

  pinMessage: async (convId, messageId) => {
    await supabase.from('conversations').update({ pinned_message_id: messageId }).eq('id', convId);
  },

  fetchPinned: async (convId) => {
    try {
      const { data } = await supabase
        .from('pinned_messages')
        .select('message_id, pinned_at')
        .eq('conversation_id', convId)
        .order('pinned_at', { ascending: false });
      set({ pinnedIds: (data || []).map((r: any) => r.message_id) });
    } catch (e) { console.error('fetchPinned:', e); set({ pinnedIds: [] }); }
  },

  togglePinMessage: async (convId, messageId, userId) => {
    const cur = get().pinnedIds;
    const isPinned = cur.includes(messageId);
    // оптимистично
    set({ pinnedIds: isPinned ? cur.filter(x => x !== messageId) : [messageId, ...cur] });
    try {
      if (isPinned) {
        await supabase.from('pinned_messages').delete().eq('conversation_id', convId).eq('message_id', messageId);
      } else {
        await supabase.from('pinned_messages').insert({ conversation_id: convId, message_id: messageId, pinned_by: userId });
      }
    } catch (e) {
      console.error('togglePinMessage:', e);
    }
    // синхронизируемся с БД (порядок/конфликты)
    await get().fetchPinned(convId);
  },

  fetchBlocked: async (userId) => {
    try {
      const { data } = await supabase.from('blocked_users').select('blocked_id').eq('blocker_id', userId);
      set({ blockedIds: (data || []).map((r: any) => r.blocked_id) });
    } catch (e) { console.error('fetchBlocked:', e); }
  },
  blockUser: async (blockerId, blockedId) => {
    const cur = get().blockedIds;
    if (!cur.includes(blockedId)) set({ blockedIds: [...cur, blockedId] });
    try {
      await supabase.from('blocked_users').insert({ blocker_id: blockerId, blocked_id: blockedId });
    } catch (e) { console.error('blockUser:', e); }
  },
  unblockUser: async (blockerId, blockedId) => {
    set({ blockedIds: get().blockedIds.filter(x => x !== blockedId) });
    try {
      await supabase.from('blocked_users').delete().eq('blocker_id', blockerId).eq('blocked_id', blockedId);
    } catch (e) { console.error('unblockUser:', e); }
  },

  toggleChatPin: async (convId, userId, val) => {
    // Оптимистично обновляем локально + пересортировываем (закреплённые наверх).
    set(s => {
      const next = s.conversations.map(c => c.id === convId ? { ...c, is_pinned: val } : c);
      next.sort((a: any, b: any) => {
        if (!!a.is_pinned !== !!b.is_pinned) return a.is_pinned ? -1 : 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
      return { conversations: next };
    });
    try { await supabase.from('conversation_members').update({ is_pinned: val }).eq('conversation_id', convId).eq('user_id', userId); } catch (e) { console.error('toggleChatPin:', e); }
  },

  toggleChatMute: async (convId, userId, val) => {
    set(s => ({ conversations: s.conversations.map(c => c.id === convId ? { ...c, is_muted: val } : c) }));
    try { await supabase.from('conversation_members').update({ is_muted: val }).eq('conversation_id', convId).eq('user_id', userId); } catch (e) { console.error('toggleChatMute:', e); }
  },

  toggleChatArchive: async (convId, userId, val) => {
    set(s => ({ conversations: s.conversations.map(c => c.id === convId ? { ...c, is_archived: val } : c) }));
    try { await supabase.from('conversation_members').update({ is_archived: val }).eq('conversation_id', convId).eq('user_id', userId); } catch (e) { console.error('toggleChatArchive:', e); }
  },

  updateBio: async (userId, bio) => {
    await supabase.from('users').update({ bio }).eq('id', userId);
  },

  sendLocation: async (convId, senderId, lat, lng) => {
    const result = await get().sendWidgetMessage(convId, senderId, JSON.stringify({ lat, lng }), 'location');
    if (result.error) throw new Error('Геолокация: ' + result.error);
  },

  fetchMediaGallery: async (convId) => {
    const { data: msgs } = await supabase.from('messages').select('id, sender_id, created_at').eq('conversation_id', convId).not('type', 'eq', 'text').not('type', 'eq', 'system').is('deleted_at', null);
    if (!msgs?.length) return [];
    const msgMap = new Map(msgs.map((m: any) => [m.id, m]));
    const { data } = await supabase.from('file_attachments').select('*').in('message_id', msgs.map(m => m.id)).order('created_at', { ascending: false });
    return (data || []).map((a: any) => ({ ...a, sender_id: msgMap.get(a.message_id)?.sender_id })) as FileAttachment[];
  },

  createPoll: async (convId, userId, question, options) => {
    const { data: poll, error } = await supabase.from('polls').insert({ conversation_id: convId, created_by: userId, question }).select().single();
    if (error) throw new Error(error.message);
    if (!poll) throw new Error('Poll not created');
    const { error: optionsError } = await supabase.from('poll_options').insert(options.map((text, i) => ({ poll_id: poll.id, text, sort_order: i })));
    if (optionsError) throw new Error(optionsError.message);
    const result = await get().sendWidgetMessage(convId, userId, poll.id, 'poll');
    if (result.error) throw new Error(result.error);
  },

  votePoll: async (pollId, optionId, userId) => {
    const { data: existingVotes, error: readError } = await supabase
      .from('poll_votes')
      .select('id, option_id')
      .eq('poll_id', pollId)
      .eq('user_id', userId);
    if (readError) throw readError;

    const selectedAgain = (existingVotes || []).some((vote: any) => vote.option_id === optionId);
    if ((existingVotes || []).length) {
      const { error: deleteError } = await supabase
        .from('poll_votes')
        .delete()
        .eq('poll_id', pollId)
        .eq('user_id', userId);
      if (deleteError) throw deleteError;
    }
    if (!selectedAgain) {
      const { error: insertError } = await supabase.from('poll_votes').insert({ poll_id: pollId, option_id: optionId, user_id: userId });
      if (insertError) throw insertError;
    }
  },

  fetchPoll: async (pollId) => {
    const { data: poll } = await supabase.from('polls').select('*').eq('id', pollId).single();
    if (!poll) return null;
    const { data: options } = await supabase.from('poll_options').select('*').eq('poll_id', pollId).order('sort_order');
    const { data: votes } = await supabase.from('poll_votes').select('*').eq('poll_id', pollId);
    return { ...poll, options: options || [], votes: votes || [] };
  },
}));
