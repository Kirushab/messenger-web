import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { toast } from '@/stores/toastStore';
import { generateAuthToken, createRoom } from '@/lib/hms';
import { createVoiceFxPlugin, type VoiceFxType } from '@/lib/voiceFx';
import { User } from '@/types';
import { startCallRingtone, stopCallRingtone, startOutgoingRingback, stopOutgoingRingback, showCallNotification } from '@/lib/notifications';
import { hasActivePushSubscription, notifyIncomingCall } from '@/lib/pushNotifications';
import { getNotifPref } from '@/lib/notifPrefs';

export type CallProvider = 'peerjs' | '100ms';
let PeerClass: any = null;

// Store pending stream for answering PeerJS calls
let pendingLocalStream: MediaStream | null = null;
// Lock for switchCamera to prevent double presses
let switchCameraBusy = false;
// Дедуп подписки на состояние звука участников (чтобы не дёргать set на каждый тик)
let lastPeerAudioKey = '';

// Инициализация SDK может стартовать одновременно из Layout и по нажатию на звонок.
// Один общий promise исключает двойное создание HMSReactiveStore.
let hmsInitPromise: Promise<void> | null = null;

// Realtime broadcast даёт почти мгновенный входящий звонок, а запись в БД
// остаётся надёжным fallback. Один signalId защищает от двойной обработки.
const handledCallSignals = new Set<string>();
const callControlLocks = new Set<string>();
let activeCallAttempt = 0;
let selectedAudioOutputDeviceId: string | null = null;

async function withControlLock(key: string, fn: () => Promise<void>) {
  if (callControlLocks.has(key)) return;
  callControlLocks.add(key);
  try { await fn(); } finally { callControlLocks.delete(key); }
}

// Heartbeat активного группового звонка: пока я в звонке — раз в 25с обновляю
// last_seen в active_call_participants. Если вкладку убили — строка протухнет (>60с)
// и сама вычистится при следующем чьём-либо heartbeat, а индикаторы спрячутся по freshness.
let callHeartbeatTimer: any = null;
function startCallHeartbeat(conversationId: string, roomId: string, type: string) {
  stopCallHeartbeat();
  const tick = () => { supabase.rpc('heartbeat_call', { p_conversation: conversationId, p_room: roomId, p_type: type }).then(() => {}, () => {}); };
  tick();
  callHeartbeatTimer = setInterval(tick, 25000);
}
function stopCallHeartbeat() {
  if (callHeartbeatTimer) { clearInterval(callHeartbeatTimer); callHeartbeatTimer = null; }
}

// Текущий активный аудио-плагин эффекта (чтобы снять при смене/выходе)
let currentFxPlugin: any = null;
// Кто держал поднятую руку в прошлом снимке — для тостов «поднял руку»
let prevRaisedHands = new Set<string>();
function parseRaisedHand(metadata: any): boolean {
  if (!metadata) return false;
  try { return !!JSON.parse(typeof metadata === 'string' ? metadata : '{}').raisedHand; } catch { return false; }
}

interface CallState {
  provider: CallProvider; setProvider: (p: CallProvider) => void;
  peer: any; peerReady: boolean;
  hmsActions: any; hmsStore: any; hmsReady: boolean; hmsUnsubs: (() => void)[];
  hmsLocalTrack: string | null; hmsRemoteTrack: string | null;
  callStatus: 'idle' | 'calling' | 'ringing' | 'active';
  connectionStage: 'idle' | 'preparing' | 'ringing' | 'connecting' | 'connected';
  isAnswering: boolean;
  callType: 'audio' | 'video'; callDirection: 'outgoing' | 'incoming';
  remoteUser: User | null; roomId: string | null;
  callStartTime: number | null; currentCall: any; callTimeout: any;
  callMessageId: string | null; callMessageStartedAt: string | null;
  localStream: MediaStream | null; remoteStream: MediaStream | null;
  micEnabled: boolean; cameraEnabled: boolean;
  audioOutputMode: 'speaker' | 'earpiece';
  toggleAudioOutput: () => Promise<void>;
  toggleVideo: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  isScreenSharing: boolean;
  hmsScreenTrack: string | null;
  initPeerJS: (userId: string) => Promise<void>;
  init100ms: () => Promise<void>;
  startCall: (target: User, type: 'audio' | 'video', conversationId?: string) => Promise<void>;
  startGroupCall: (conversationId: string, conversationName: string, participants: User[], type: 'audio' | 'video') => Promise<void>;
  joinGroupCall: (conversationId: string, conversationName: string, roomId: string, type: 'audio' | 'video') => Promise<void>;
  isGroupCall: boolean;
  groupName: string | null;
  groupConversationId: string | null;
  groupParticipants: User[];
  groupPeers: any[];
  dominantSpeakerId: string | null;
  peerAudioEnabled: Record<string, boolean>;
  minimized: boolean;
  setMinimized: (v: boolean) => void;
  inviteToGroupCall: (user: User) => Promise<{ ok: boolean; error?: string }>;
  voiceFx: VoiceFxType;
  setVoiceFx: (type: VoiceFxType) => Promise<void>;
  myHandRaised: boolean;
  toggleRaiseHand: () => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
  endCall: () => Promise<void>;
  toggleMic: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  switchCamera: () => Promise<void>;
  currentFacingMode: 'user' | 'environment';
  subscribeToCallSignals: (userId: string) => () => void;
  _cleanup: () => void;
}

function makePeerId(uid: string) {
  return 'msgr_' + uid.replace(/-/g, '').substring(0, 20);
}

async function broadcastSignal(targetId: string, payload: any): Promise<void> {
  const channel = supabase.channel(`call-fast-${targetId}`);
  await new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      try { supabase.removeChannel(channel); } catch {}
      resolve();
    };
    const timer = window.setTimeout(done, 900);
    channel.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return;
      try {
        await channel.send({ type: 'broadcast', event: 'signal', payload });
      } catch {}
      clearTimeout(timer);
      done();
    });
  });
}

async function sendSignal(targetId: string, signal: any): Promise<void> {
  const payload = { ...signal, signalId: signal?.signalId || crypto.randomUUID() };
  const durable = supabase.from('call_signals').insert({ target_id: targetId, payload });
  const realtime = typeof window !== 'undefined'
    ? broadcastSignal(targetId, payload)
    : Promise.resolve();
  const [dbResult] = await Promise.allSettled([durable, realtime]);
  if (dbResult.status === 'rejected') console.error('sendSignal error:', dbResult.reason);
  else if ((dbResult.value as any)?.error) console.error('sendSignal db error:', (dbResult.value as any).error);
}

const CALL_MESSAGE_PREFIX = '[CALL_V1]';

type TimelineCallStatus = 'ongoing' | 'answered' | 'missed' | 'declined';
type CompletedCallInfo = {
  status: Exclude<TimelineCallStatus, 'ongoing'>;
  callStartTime: number | null;
  endedAt: number;
};
const completedCallRoomStatus = new Map<string, CompletedCallInfo>();

function rememberCompletedCall(state: any, status: CompletedCallInfo['status']) {
  // Только инициатор создаёт карточку звонка. У входящих участников нет позднего
  // timeline-promise, поэтому хранить для них завершённый статус не нужно.
  if (!state?.roomId || !state?.callMessageStartedAt || state?.callDirection !== 'outgoing') return;
  completedCallRoomStatus.set(state.roomId, {
    status,
    callStartTime: state.callStartTime || null,
    endedAt: Date.now(),
  });
}

function encodeCallTimeline(payload: {
  callType: 'audio' | 'video';
  roomId: string;
  status: TimelineCallStatus;
  startedAt: string;
  endedAt?: string | null;
  durationSec?: number | null;
  isGroup?: boolean;
}) {
  return CALL_MESSAGE_PREFIX + JSON.stringify({ v: 1, ...payload });
}

async function ensureDirectConversationId(myId: string, targetId: string): Promise<string | null> {
  try {
    const [mine, theirs] = await Promise.all([
      supabase.from('conversation_members').select('conversation_id').eq('user_id', myId),
      supabase.from('conversation_members').select('conversation_id').eq('user_id', targetId),
    ]);
    const mySet = new Set((mine.data || []).map((m: any) => m.conversation_id));
    const common = (theirs.data || []).map((m: any) => m.conversation_id).filter((id: string) => mySet.has(id));
    if (common.length) {
      const { data } = await supabase.from('conversations').select('id')
        .in('id', common).eq('type', 'direct').eq('is_encrypted', false).limit(1).maybeSingle();
      if (data?.id) return data.id;
    }

    const { data: conversation, error } = await supabase.from('conversations')
      .insert({ type: 'direct', created_by: myId, is_encrypted: false }).select('id').single();
    if (error || !conversation?.id) return null;
    const { error: memberError } = await supabase.from('conversation_members').insert([
      { conversation_id: conversation.id, user_id: myId, role: 'admin' },
      { conversation_id: conversation.id, user_id: targetId, role: 'member' },
    ]);
    if (memberError) return null;
    return conversation.id;
  } catch (error) {
    console.warn('ensure direct conversation for call:', error);
    return null;
  }
}

async function createCallTimelineMessage(args: {
  conversationId: string;
  senderId: string;
  callType: 'audio' | 'video';
  roomId: string;
  startedAt: string;
  isGroup: boolean;
}): Promise<string | null> {
  try {
    const { data, error } = await supabase.from('messages').insert({
      conversation_id: args.conversationId,
      sender_id: args.senderId,
      type: 'call',
      content: encodeCallTimeline({
        callType: args.callType,
        roomId: args.roomId,
        status: 'ongoing',
        startedAt: args.startedAt,
        isGroup: args.isGroup,
      }),
    }).select('id').single();
    if (error) throw error;
    return data?.id || null;
  } catch (error) {
    console.warn('create call timeline message:', error);
    return null;
  }
}

async function finishCallTimeline(state: any, status: Exclude<TimelineCallStatus, 'ongoing'>) {
  if (!state.callMessageId || !state.callMessageStartedAt || !state.roomId) return;
  const endedMs = state.callEndedAt || Date.now();
  const endedAt = new Date(endedMs).toISOString();
  const startedMs = new Date(state.callMessageStartedAt).getTime();
  const durationSec = status === 'answered'
    ? Math.max(1, Math.round((endedMs - (state.callStartTime || startedMs)) / 1000))
    : 0;
  try {
    await supabase.from('messages').update({
      content: encodeCallTimeline({
        callType: state.callType,
        roomId: state.roomId,
        status,
        startedAt: state.callMessageStartedAt,
        endedAt,
        durationSec,
        isGroup: !!state.isGroupCall,
      }),
      updated_at: endedAt,
    }).eq('id', state.callMessageId);
  } catch (error) {
    console.warn('finish call timeline message:', error);
  }
}

export const useCallStore = create<CallState>((set, get) => ({
  provider: '100ms', peer: null, peerReady: false,
  hmsActions: null, hmsStore: null, hmsReady: false, hmsUnsubs: [],
  hmsLocalTrack: null, hmsRemoteTrack: null, hmsScreenTrack: null, isScreenSharing: false,
  callStatus: 'idle', connectionStage: 'idle', isAnswering: false, callType: 'audio', callDirection: 'outgoing',
  remoteUser: null, roomId: null, callStartTime: null,
  callMessageId: null, callMessageStartedAt: null,
  isGroupCall: false, groupName: null, groupConversationId: null, groupParticipants: [], groupPeers: [], dominantSpeakerId: null,
  voiceFx: 'none', myHandRaised: false,
  currentCall: null, callTimeout: null,
  localStream: null, remoteStream: null, micEnabled: true, cameraEnabled: false, currentFacingMode: 'user' as 'user' | 'environment',
  audioOutputMode: 'speaker' as 'speaker' | 'earpiece',
  peerAudioEnabled: {},
  minimized: false,

  setProvider: (p) => set({ provider: p }),
  setMinimized: (v) => set({ minimized: v }),

  _cleanup: () => {
    const s = get();
    activeCallAttempt += 1;

    // Сначала мгновенно закрываем интерфейс. Сетевые cleanup-операции выполняются
    // уже после этого и не заставляют пользователя ждать анимацию выхода.
    set({
      callStatus: 'idle', connectionStage: 'idle', isAnswering: false, currentCall: null, callTimeout: null,
      minimized: false, peerAudioEnabled: {},
      localStream: null, remoteStream: null, remoteUser: null,
      roomId: null, callStartTime: null, callMessageId: null, callMessageStartedAt: null, isGroupCall: false, groupName: null, groupConversationId: null, groupParticipants: [], groupPeers: [], dominantSpeakerId: null,
      voiceFx: 'none', myHandRaised: false, micEnabled: true, cameraEnabled: false, audioOutputMode: 'speaker',
      hmsLocalTrack: null, hmsRemoteTrack: null, hmsScreenTrack: null, isScreenSharing: false,
    });

    stopCallHeartbeat();
    stopCallRingtone();
    stopOutgoingRingback();
    if (currentFxPlugin && s.hmsActions?.removePluginFromAudioTrack) {
      try { void s.hmsActions.removePluginFromAudioTrack(currentFxPlugin); } catch {}
    }
    currentFxPlugin = null;
    prevRaisedHands = new Set();
    lastPeerAudioKey = '';
    if (s.groupConversationId) {
      void supabase.rpc('leave_call', { p_conversation: s.groupConversationId }).then(() => {}, () => {});
    }
    if (s.localStream) s.localStream.getTracks().forEach(t => t.stop());
    if (s.currentCall) try { s.currentCall.close(); } catch {}
    if (s.callTimeout) clearTimeout(s.callTimeout);
    pendingLocalStream = null;
  },

  initPeerJS: async (userId) => {
    if (get().peer) return;
    try {
      if (!PeerClass) {
        const m = await import('peerjs');
        PeerClass = m.default || m.Peer || m;
      }
      const pid = makePeerId(userId);
      const peer = new PeerClass(pid, {
        debug: 1,
        config: { iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun.cloudflare.com:3478' },
          // Бесплатные публичные TURN серверы (Metered / OpenRelay)
          { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
          { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
          { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
        ]}
      });

      peer.on('open', () => { console.log('PeerJS ready:', pid); set({ peerReady: true }); });

      // Handle incoming PeerJS media call
      peer.on('call', (incomingCall: any) => {
        console.log('PeerJS: incoming call received');
        const s = get();
        const stream = s.localStream || pendingLocalStream;

        if (stream && (s.callStatus === 'active' || s.callStatus === 'ringing')) {
          console.log('PeerJS: answering call with stream');
          incomingCall.answer(stream);
          set({ currentCall: incomingCall, callStatus: 'active', connectionStage: 'connected', callStartTime: s.callStartTime || Date.now() });
          incomingCall.on('stream', (rs: MediaStream) => {
            console.log('PeerJS: got remote stream');
            set({ remoteStream: rs });
          });
          incomingCall.on('close', () => {
            console.log('PeerJS: call closed');
            if (get().callStatus === 'active') get().endCall();
          });
          incomingCall.on('error', (e: any) => {
            console.error('PeerJS call error:', e);
            if (get().callStatus === 'active') get().endCall();
          });
        } else {
          // Store the call, will be answered when localStream becomes available
          console.log('PeerJS: storing pending call, status:', s.callStatus, 'hasStream:', !!stream);
          set({ currentCall: incomingCall });
          incomingCall.on('stream', (rs: MediaStream) => set({ remoteStream: rs }));
          incomingCall.on('close', () => { if (get().callStatus === 'active') get().endCall(); });

          // Retry answering after a short delay
          setTimeout(() => {
            const s2 = get();
            const str = s2.localStream || pendingLocalStream;
            if (str && s2.currentCall && !s2.remoteStream) {
              console.log('PeerJS: retry answering call');
              try { s2.currentCall.answer(str); } catch (e) { console.error('Retry answer error:', e); }
            }
          }, 1500);
        }
      });

      peer.on('error', (e: any) => {
        console.warn('PeerJS error:', e.type, e.message);
        if (e.type === 'unavailable-id') {
          set({ peerReady: false });
          setTimeout(() => { try { peer.destroy(); } catch {} set({ peer: null }); get().initPeerJS(userId); }, 5000);
        }
      });

      peer.on('disconnected', () => {
        setTimeout(() => { try { peer.reconnect(); } catch {} }, 2000);
      });

      set({ peer });
      setTimeout(() => { if (!get().peerReady) set({ peerReady: true }); }, 6000);
    } catch (e) {
      console.error('PeerJS init failed:', e);
      set({ peerReady: true });
    }
  },

  init100ms: async () => {
    if (get().hmsActions) return;
    if (hmsInitPromise) return hmsInitPromise;

    hmsInitPromise = (async () => {
        try {
          const hms = await import('@100mslive/hms-video-store');
          const store = new hms.HMSReactiveStore();
          store.triggerOnSubscribe();
          const actions = store.getActions();
          const hmsStore = store.getStore();

          // Clean up previous subscriptions if init is called again
          const prev = get().hmsUnsubs;
          for (const u of prev) { try { u(); } catch {} }

          // Все peers (включая локального) — для UI группового звонка
          const unsub1 = hmsStore.subscribe((peers: any[]) => {
            if (get().isGroupCall) set({ groupPeers: peers || [] });
            const remote = (peers || []).find((p: any) => !p.isLocal);
            set({ hmsRemoteTrack: remote?.videoTrack || null });
            if (remote && get().callStatus === 'calling' && !get().isGroupCall) {
              const timeout = get().callTimeout;
              if (timeout) clearTimeout(timeout);
              stopOutgoingRingback();
              set({ callStatus: 'active', connectionStage: 'connected', callStartTime: Date.now(), callTimeout: null });
            }
            // Тосты «поднял руку» для удалённых участников
            if (get().isGroupCall) {
              const raisedNow = new Set<string>();
              (peers || []).forEach((p: any) => { if (!p.isLocal && parseRaisedHand(p.metadata)) raisedNow.add(p.id); });
              raisedNow.forEach(id => {
                if (!prevRaisedHands.has(id)) {
                  const pr = (peers || []).find((p: any) => p.id === id);
                  toast.info('✋ ' + (pr?.name || 'Участник') + ' поднял(а) руку');
                }
              });
              prevRaisedHands = raisedNow;
            }
          }, hms.selectPeers);

          const unsub2 = hmsStore.subscribe((p: any) => {
            set({ hmsLocalTrack: p?.videoTrack || null });
          }, hms.selectLocalPeer);

          // Доминантный спикер — кто говорит сейчас громче всех
          const unsub3 = hmsStore.subscribe((speaker: any) => {
            set({ dominantSpeakerId: speaker?.id || null });
          }, hms.selectDominantSpeaker);

          // Реальное состояние микрофона КАЖДОГО участника (вкл/выкл), чтобы иконки
          // микрофонов в списке менялись. selectPeers не срабатывает на mute/unmute —
          // нужна отдельная подписка на selectIsPeerAudioEnabled по всем пирами.
          const unsub4 = hmsStore.subscribe(
            (map: Record<string, boolean>) => {
              const key = Object.keys(map).sort().map(k => k + (map[k] ? '1' : '0')).join(',');
              if (key === lastPeerAudioKey) return;
              lastPeerAudioKey = key;
              set({ peerAudioEnabled: map });
            },
            (state: any) => {
              const out: Record<string, boolean> = {};
              const ps = hms.selectPeers(state) || [];
              ps.forEach((p: any) => { out[p.id] = !!hms.selectIsPeerAudioEnabled(p.id)(state); });
              return out;
            }
          );

          // Демонстрация экрана: свой статус + трек экрана удалённого участника (с защитой на версию SDK)
          const screenUnsubs: (() => void)[] = [];
          try {
            if ((hms as any).selectIsLocalScreenShared) {
              screenUnsubs.push(hmsStore.subscribe((shared: boolean) => set({ isScreenSharing: !!shared }), (hms as any).selectIsLocalScreenShared));
            }
            if ((hms as any).selectPeerScreenSharing && (hms as any).selectScreenShareByPeerID) {
              screenUnsubs.push(hmsStore.subscribe((peer: any) => {
                if (peer && !peer.isLocal) {
                  try { const t = (hms as any).selectScreenShareByPeerID(peer.id)(hmsStore.getState()); set({ hmsScreenTrack: t?.id || null }); }
                  catch { set({ hmsScreenTrack: null }); }
                } else { set({ hmsScreenTrack: null }); }
              }, (hms as any).selectPeerScreenSharing));
            }
          } catch (e) { console.warn('screen-share subscribe failed:', e); }

          set({ hmsActions: actions, hmsStore, hmsReady: true, hmsUnsubs: [unsub1, unsub2, unsub3, unsub4, ...screenUnsubs] });
        } catch (e) {
          console.error('100ms init failed:', e);
        }
    })().finally(() => { hmsInitPromise = null; });

    return hmsInitPromise;
  },

  subscribeToCallSignals: (userId) => {
    console.log('[Calls] Subscribing for:', userId);

    const handleSignal = async (row: any) => {
      const p = row?.payload || {};
      const durableRow = row?.id && !String(row.id).startsWith('fast:');
      if (durableRow) {
        void supabase.from('call_signals').delete().eq('id', row.id).then(({ error }) => {
          if (error) console.error('delete signal:', error);
        });
      }

      const signalKey = String(p.signalId || row?.id || '');
      if (signalKey && handledCallSignals.has(signalKey)) return;
      if (signalKey) {
        handledCallSignals.add(signalKey);
        if (handledCallSignals.size > 500) handledCallSignals.clear();
      }

      const s = get();
      console.log('[Calls] Signal:', p.type, 'status:', s.callStatus);

      if (p.type === 'incoming_call') {
        if (s.callStatus !== 'idle') {
          if (p.callerId) void sendSignal(p.callerId, { type: 'call_busy', roomId: p.roomId, isGroup: !!p.isGroup });
          return;
        }

        // Показываем входящий звонок сразу по payload, не ждём отдельный SELECT профиля.
        const fallbackCaller = {
          id: p.callerId,
          display_name: p.callerName || '?',
          email: '', avatar_url: p.callerAvatar || null,
          status: 'online', last_seen: '', created_at: '',
        } as User;
        set({
          callStatus: 'ringing', connectionStage: 'ringing', isAnswering: false,
          callType: p.callType || 'audio', callDirection: 'incoming',
          remoteUser: fallbackCaller,
          roomId: p.roomId || null, provider: p.provider || '100ms',
          isGroupCall: !!p.isGroup,
          groupName: p.groupName || p.callerName || 'Звонок',
          groupConversationId: p.conversationId || null,
          callMessageId: null,
          callMessageStartedAt: p.callStartedAt || null,
          micEnabled: true, cameraEnabled: p.callType === 'video', minimized: false,
        });

        const appVisible = document.visibilityState === 'visible';
        if (appVisible && getNotifPref('sndCall')) startCallRingtone();
        if (!appVisible && getNotifPref('master') && getNotifPref('call')) {
          const pushActive = await hasActivePushSubscription();
          if (!pushActive) {
            void showCallNotification(
              p.isGroup
                ? `${p.callerName || 'Кто-то'} · ${p.groupName || 'Групповой звонок'}`
                : (p.callerName || 'Кто-то'),
              p.conversationId ? `/chat/${p.conversationId}` : '/chats',
            );
          }
        }

        void get().init100ms();
        if (p.callerId) {
          void supabase.from('users').select('*').eq('id', p.callerId).single().then(({ data }) => {
            const now = get();
            if (data && now.callStatus === 'ringing' && now.remoteUser?.id === p.callerId) {
              set({ remoteUser: data as User });
            }
          });
        }
        return;
      }

      if (p.type === 'call_context' && s.callStatus !== 'idle') {
        if (!p.roomId || !s.roomId || p.roomId !== s.roomId) return;
        if (p.conversationId) {
          set({ groupConversationId: p.conversationId });
          if (s.callStatus === 'active') startCallHeartbeat(p.conversationId, s.roomId, s.callType);
        }
        return;
      }

      if (p.type === 'call_accepted' && s.callStatus === 'calling') {
        if (p.roomId && s.roomId && p.roomId !== s.roomId) return;
        if (s.callTimeout) clearTimeout(s.callTimeout);
        stopOutgoingRingback();
        set({ callStatus: 'active', connectionStage: 'connected', callStartTime: s.callStartTime || Date.now(), callTimeout: null });
        if (s.provider === 'peerjs' && s.peer && s.localStream && s.remoteUser) {
          const rid = makePeerId(s.remoteUser.id);
          try {
            const call = s.peer.call(rid, s.localStream);
            if (call) {
              set({ currentCall: call });
              call.on('stream', (rs: MediaStream) => set({ remoteStream: rs }));
              call.on('close', () => { if (get().callStatus === 'active') void get().endCall(); });
            }
          } catch (e) { console.error('[Calls] peer.call error:', e); }
        }
        return;
      }

      if (p.type === 'call_declined' && (s.callStatus === 'calling' || s.callStatus === 'ringing')) {
        if (p.roomId && s.roomId && p.roomId !== s.roomId) return;
        // В групповом звонке отказ одного участника не завершает вызов для остальных.
        if (s.isGroupCall && s.callDirection === 'outgoing') return;
        const snapshot = { ...s };
        rememberCompletedCall(snapshot, 'declined');
        get()._cleanup();
        void finishCallTimeline(snapshot, 'declined');
        return;
      }

      if (p.type === 'call_busy' && s.callStatus === 'calling') {
        if (p.roomId && s.roomId && p.roomId !== s.roomId) return;
        if (s.isGroupCall && s.callDirection === 'outgoing') return;
        const snapshot = { ...s };
        rememberCompletedCall(snapshot, 'declined');
        get()._cleanup();
        void finishCallTimeline(snapshot, 'declined');
        toast.info('Собеседник сейчас занят');
        return;
      }

      if (p.type === 'call_ended' && s.callStatus !== 'idle') {
        if (p.roomId && s.roomId && p.roomId !== s.roomId) return;
        const snapshot = { ...s };
        const status = snapshot.callStartTime ? 'answered' : 'missed';
        rememberCompletedCall(snapshot, status);
        get()._cleanup();
        void finishCallTimeline(snapshot, status);
        if (snapshot.provider === '100ms' && snapshot.hmsActions) {
          void snapshot.hmsActions.leave().catch(() => {});
        }
      }
    };

    // Самый быстрый путь: Supabase Realtime broadcast без ожидания INSERT/CDC.
    const fast = supabase.channel('call-fast-' + userId)
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        void handleSignal({ id: 'fast:' + (payload?.signalId || crypto.randomUUID()), payload });
      })
      .subscribe();

    // Надёжный путь: запись в call_signals + postgres changes.
    const ch = supabase.channel('call-sig-' + userId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_signals' },
        async (change) => {
          const row = change.new as any;
          if (row.target_id !== userId) return;
          await handleSignal(row);
        }
      ).subscribe((status) => { console.log('[Calls] Realtime:', status); });

    const drainSignals = async () => {
      try {
        const { data } = await supabase.from('call_signals')
          .select('*').eq('target_id', userId).order('created_at').limit(3);
        for (const row of data || []) await handleSignal(row);
      } catch {}
    };

    void drainSignals();
    // Fallback быстрее старых 2.5 секунд, но основной путь всё равно broadcast/realtime.
    const poll = setInterval(drainSignals, 900);

    void supabase.from('call_signals').delete().eq('target_id', userId)
      .lt('created_at', new Date(Date.now() - 60000).toISOString())
      .then(({ error }) => { if (error) console.error('cleanup signals:', error); });

    return () => {
      supabase.removeChannel(fast);
      supabase.removeChannel(ch);
      clearInterval(poll);
    };
  },

  startCall: async (target, type, conversationId) => {
    if (get().callStatus !== 'idle') return;

    const attempt = ++activeCallAttempt;
    // Экран вызова открывается в тот же кадр, в котором пользователь нажал кнопку.
    set({
      provider: '100ms', callStatus: 'calling', connectionStage: 'preparing',
      callType: type, callDirection: 'outgoing', remoteUser: target,
      micEnabled: true, cameraEnabled: type === 'video', minimized: false,
      isGroupCall: false, groupName: target.display_name || 'Звонок',
      groupConversationId: conversationId || null,
      roomId: null, callStartTime: null, callMessageId: null, callMessageStartedAt: null,
    });
    if (getNotifPref('sndCall')) startOutgoingRingback();

    const timeout = setTimeout(() => {
      if (get().callStatus === 'calling' && activeCallAttempt === attempt) void get().endCall();
    }, 45000);
    set({ callTimeout: timeout });

    try {
      const authPromise = supabase.auth.getUser();
      const initPromise = get().init100ms();
      const { data: { user } } = await authPromise;
      if (!user || activeCallAttempt !== attempt || get().callStatus !== 'calling') {
        if (!user) get()._cleanup();
        return;
      }

      const profilePromise = supabase.from('users')
        .select('display_name, avatar_url').eq('id', user.id).single();
      const roomPromise = createRoom();
      const conversationPromise = conversationId
        ? Promise.resolve(conversationId)
        : ensureDirectConversationId(user.id, target.id);

      // Создание комнаты идёт параллельно с загрузкой SDK и профиля.
      const [profileResult, roomResult] = await Promise.all([profilePromise, roomPromise]);
      const { id: roomId, error } = roomResult;
      if (error || !roomId) throw new Error(error || 'Room failed');
      if (activeCallAttempt !== attempt || get().callStatus !== 'calling') return;

      const callStartedAt = new Date().toISOString();
      set({ roomId, callMessageStartedAt: callStartedAt, connectionStage: 'ringing' });

      // Сначала звоним собеседнику. Токен, вход в комнату и карточка в чате
      // готовятся параллельно и больше не задерживают входящий экран.
      void sendSignal(target.id, {
        type: 'incoming_call', callType: type, provider: '100ms', roomId,
        conversationId, callStartedAt,
        callerId: user.id,
        callerName: profileResult.data?.display_name || 'User',
        callerAvatar: profileResult.data?.avatar_url || null,
      });

      // История звонка не блокирует подключение к медиа-комнате. Даже если создание
      // личного чата или INSERT сообщения медленные, WebRTC начинает соединяться сразу.
      void conversationPromise.then((resolvedConversationId) => {
        if (!resolvedConversationId) return;
        void sendSignal(target.id, {
          type: 'call_context', roomId, conversationId: resolvedConversationId,
        });
        void notifyIncomingCall({
          conversationId: resolvedConversationId,
          roomId,
          callType: type,
          targetUserIds: [target.id],
        });
      }).catch(error => console.warn('direct call push context:', error));

      const timelinePromise = conversationPromise.then(async (resolvedConversationId) => {
        if (!resolvedConversationId) return { conversationId: null, messageId: null as string | null };
        const messageId = await createCallTimelineMessage({
          conversationId: resolvedConversationId, senderId: user.id, callType: type,
          roomId, startedAt: callStartedAt, isGroup: false,
        });
        return { conversationId: resolvedConversationId, messageId };
      });
      const tokenPromise = generateAuthToken(roomId, user.id);

      void timelinePromise.then(({ conversationId: resolvedConversationId, messageId }) => {
        if (!messageId) return;
        const current = get();
        if (activeCallAttempt === attempt && current.callStatus !== 'idle' && current.roomId === roomId) {
          set({ callMessageId: messageId, groupConversationId: resolvedConversationId });
          if (resolvedConversationId && current.callStatus === 'active') {
            startCallHeartbeat(resolvedConversationId, roomId, type);
          }
          return;
        }
        const completed = completedCallRoomStatus.get(roomId);
        const finalStatus = completed?.status || 'missed';
        completedCallRoomStatus.delete(roomId);
        void finishCallTimeline({
          callMessageId: messageId, callMessageStartedAt: callStartedAt, roomId, callType: type,
          isGroupCall: false, callStartTime: completed?.callStartTime || null,
          callEndedAt: completed?.endedAt || Date.now(),
        }, finalStatus);
      }).catch((error) => console.warn('late direct call timeline:', error));

      const [token] = await Promise.all([tokenPromise, initPromise]);
      if (activeCallAttempt !== attempt || get().callStatus !== 'calling') return;
      const actions = get().hmsActions;
      if (!actions) throw new Error('Звонки ещё не готовы');
      set({ connectionStage: 'connecting' });

      await actions.join({
        authToken: token,
        userName: profileResult.data?.display_name || 'User',
        settings: { isAudioMuted: false, isVideoMuted: type !== 'video' },
      });
      if (activeCallAttempt !== attempt || get().callStatus === 'idle') {
        try { await actions.leave(); } catch {}
        return;
      }
      if (get().callStatus === 'calling') set({ connectionStage: 'ringing' });
      const resolvedConversationId = get().groupConversationId;
      if (resolvedConversationId) startCallHeartbeat(resolvedConversationId, roomId, type);
    } catch (e: any) {
      console.error('100ms start error:', e);
      if (activeCallAttempt !== attempt) return;
      const snapshot = { ...get() };
      rememberCompletedCall(snapshot, 'missed');
      get()._cleanup();
      void finishCallTimeline(snapshot, 'missed');
      toast.error('Не удалось начать звонок: ' + (e?.message || e));
    }
  },

  startGroupCall: async (conversationId, conversationName, participants, type) => {
    if (get().callStatus !== 'idle') return;
    const attempt = ++activeCallAttempt;
    set({
      callStatus: 'calling', connectionStage: 'preparing', callType: type, callDirection: 'outgoing',
      isGroupCall: true, groupName: conversationName || 'Групповой звонок',
      groupConversationId: conversationId, groupParticipants: participants,
      provider: '100ms', micEnabled: true, cameraEnabled: type === 'video', minimized: false,
      roomId: null, callStartTime: null, callMessageId: null, callMessageStartedAt: null,
    });
    if (getNotifPref('sndCall')) startOutgoingRingback();

    const timeout = setTimeout(() => {
      if (get().callStatus === 'calling' && activeCallAttempt === attempt) void get().endCall();
    }, 60000);
    set({ callTimeout: timeout });

    try {
      const authPromise = supabase.auth.getUser();
      const initPromise = get().init100ms();
      const { data: { user } } = await authPromise;
      if (!user || activeCallAttempt !== attempt || get().callStatus === 'idle') {
        if (!user) get()._cleanup();
        return;
      }
      const profilePromise = supabase.from('users')
        .select('display_name, avatar_url').eq('id', user.id).single();
      const roomPromise = createRoom();
      const [profileResult, roomResult] = await Promise.all([profilePromise, roomPromise]);
      const { id: roomId, error } = roomResult;
      if (error || !roomId) throw new Error(error || 'Room failed');
      if (activeCallAttempt !== attempt || get().callStatus === 'idle') return;
      const callStartedAt = new Date().toISOString();
      set({ roomId, callMessageStartedAt: callStartedAt, connectionStage: 'ringing' });

      // Участники получают вызов сразу после создания комнаты.
      const targetUserIds = participants.filter(p => p.id !== user.id).map(p => p.id);
      participants.filter(p => p.id !== user.id).forEach(p => {
        void sendSignal(p.id, {
          type: 'incoming_call', callType: type, provider: '100ms',
          roomId, isGroup: true, conversationId, callStartedAt,
          groupName: conversationName || 'Групповой звонок',
          callerId: user.id, callerName: profileResult.data?.display_name || 'User',
          callerAvatar: profileResult.data?.avatar_url || null,
        });
      });
      void notifyIncomingCall({ conversationId, roomId, callType: type, targetUserIds });

      const timelinePromise = createCallTimelineMessage({
        conversationId, senderId: user.id, callType: type,
        roomId, startedAt: callStartedAt, isGroup: true,
      });
      const tokenPromise = generateAuthToken(roomId, user.id);

      void timelinePromise.then((messageId) => {
        participants.filter(p => p.id !== user.id).forEach(p => {
          void sendSignal(p.id, { type: 'call_context', roomId, conversationId });
        });
        if (!messageId) return;
        const current = get();
        if (activeCallAttempt === attempt && current.callStatus !== 'idle' && current.roomId === roomId) {
          set({ callMessageId: messageId });
          return;
        }
        const completed = completedCallRoomStatus.get(roomId);
        const finalStatus = completed?.status || 'missed';
        completedCallRoomStatus.delete(roomId);
        void finishCallTimeline({
          callMessageId: messageId, callMessageStartedAt: callStartedAt, roomId, callType: type,
          isGroupCall: true, callStartTime: completed?.callStartTime || null,
          callEndedAt: completed?.endedAt || Date.now(),
        }, finalStatus);
      }).catch((error) => console.warn('late group call timeline:', error));

      const [token] = await Promise.all([tokenPromise, initPromise]);
      if (activeCallAttempt !== attempt || get().callStatus === 'idle') return;
      const actions = get().hmsActions;
      if (!actions) throw new Error('Звонки ещё не готовы');
      set({ connectionStage: 'connecting' });

      await actions.join({
        authToken: token, userName: profileResult.data?.display_name || 'User',
        settings: { isAudioMuted: false, isVideoMuted: type !== 'video' },
      });
      if (activeCallAttempt !== attempt || get().callStatus === 'idle') {
        try { await actions.leave(); } catch {}
        return;
      }
      stopOutgoingRingback();
      const groupTimeout = get().callTimeout;
      if (groupTimeout) clearTimeout(groupTimeout);
      set({ callStatus: 'active', connectionStage: 'connected', callStartTime: Date.now(), callTimeout: null });
      startCallHeartbeat(conversationId, roomId, type);
    } catch (e: any) {
      console.error('Group call start error:', e);
      if (activeCallAttempt !== attempt) return;
      const snapshot = { ...get() };
      rememberCompletedCall(snapshot, 'missed');
      get()._cleanup();
      void finishCallTimeline(snapshot, 'missed');
      toast.error('Не удалось начать групповой звонок: ' + (e?.message || e));
    }
  },

  joinGroupCall: async (conversationId, conversationName, roomId, type) => {
    if (get().callStatus !== 'idle') return;
    const attempt = ++activeCallAttempt;
    set({
      callStatus: 'calling', connectionStage: 'connecting', callType: type, callDirection: 'outgoing',
      isGroupCall: true, groupName: conversationName || 'Групповой звонок',
      groupConversationId: conversationId, groupParticipants: [], provider: '100ms',
      micEnabled: true, cameraEnabled: type === 'video', roomId, callStartTime: null, minimized: false,
    });

    try {
      const authPromise = supabase.auth.getUser();
      const initPromise = get().init100ms();
      const { data: { user } } = await authPromise;
      if (!user) throw new Error('Not authenticated');
      const [profileResult, token] = await Promise.all([
        supabase.from('users').select('display_name').eq('id', user.id).single(),
        generateAuthToken(roomId, user.id),
        initPromise,
      ]);
      const actions = get().hmsActions;
      if (!actions) throw new Error('Звонки ещё не готовы');
      if (activeCallAttempt !== attempt || get().callStatus === 'idle') return;
      await actions.join({
        authToken: token, userName: profileResult.data?.display_name || 'User',
        settings: { isAudioMuted: false, isVideoMuted: type !== 'video' },
      });
      if (activeCallAttempt !== attempt || get().callStatus === 'idle') {
        try { await actions.leave(); } catch {}
        return;
      }
      set({ callStatus: 'active', connectionStage: 'connected', callStartTime: Date.now() });
      void supabase.rpc('heartbeat_call', { p_conversation: conversationId, p_room: roomId, p_type: type });
      startCallHeartbeat(conversationId, roomId, type);
    } catch (e: any) {
      console.error('Group call join error:', e);
      if (activeCallAttempt !== attempt) return;
      get()._cleanup();
      toast.error('Не удалось подключиться: ' + (e?.message || e));
    }
  },

  inviteToGroupCall: async (newUser) => {
    const s = get();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Not authenticated' };
    if (!s.isGroupCall || !s.roomId) return { ok: false, error: 'Не в групповом звонке' };
    if (s.groupParticipants.some(p => p.id === newUser.id)) {
      return { ok: false, error: 'Уже в звонке' };
    }

    const { data: profile } = await supabase.from('users').select('display_name').eq('id', user.id).single();

    try {
      await sendSignal(newUser.id, {
        type: 'incoming_call', callType: s.callType, provider: '100ms',
        roomId: s.roomId, isGroup: true, conversationId: s.groupConversationId,
        callMessageId: s.callMessageId, callStartedAt: s.callMessageStartedAt,
        groupName: s.groupName || 'Групповой звонок',
        callerId: user.id, callerName: profile?.display_name || 'User',
      });
      if (s.groupConversationId) {
        void notifyIncomingCall({
          conversationId: s.groupConversationId,
          roomId: s.roomId,
          callType: s.callType,
          targetUserIds: [newUser.id],
        });
      }
      set({ groupParticipants: [...s.groupParticipants, newUser] });
      return { ok: true };
    } catch (e: any) {
      console.error('inviteToGroupCall error:', e);
      return { ok: false, error: e.message || String(e) };
    }
  },

  setVoiceFx: async (type) => {
    const a = get().hmsActions;
    if (!a) { set({ voiceFx: type }); return; }
    if (currentFxPlugin && a.removePluginFromAudioTrack) {
      try { await a.removePluginFromAudioTrack(currentFxPlugin); } catch {}
    }
    currentFxPlugin = null;
    if (type !== 'none') {
      if (!a.addPluginToAudioTrack) { toast.error('Эффекты не поддерживаются в этой версии'); set({ voiceFx: 'none' }); return; }
      try {
        const plugin = createVoiceFxPlugin(type);
        await a.addPluginToAudioTrack(plugin);
        currentFxPlugin = plugin;
      } catch (e: any) {
        console.error('voiceFx error:', e);
        toast.error('Не удалось включить эффект');
        set({ voiceFx: 'none' });
        return;
      }
    }
    set({ voiceFx: type });
  },

  toggleRaiseHand: async () => {
    await withControlLock('hand', async () => {
      const a = get().hmsActions;
      if (!a) return;
      const previous = get().myHandRaised;
      const next = !previous;
      set({ myHandRaised: next });
      try {
        if (a.changeMetadata) await a.changeMetadata(JSON.stringify({ raisedHand: next }));
      } catch (e: any) {
        set({ myHandRaised: previous });
        console.error('raiseHand error:', e);
        toast.error('Не удалось изменить состояние руки');
      }
    });
  },

  acceptCall: async () => {
    const s = get();
    if (!s.remoteUser || s.isAnswering) return;
    stopCallRingtone();
    set({ isAnswering: true, connectionStage: 'connecting' });

    try {
      if (s.provider === 'peerjs') {
        let stream: MediaStream;
        const audioConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 48000 };
        stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
          video: s.callType === 'video'
            ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
            : false,
        });
        pendingLocalStream = stream;
        set({ localStream: stream });
        const currentCall = get().currentCall;
        if (currentCall) currentCall.answer(stream);
      } else {
        if (!s.roomId) throw new Error('Комната звонка не найдена');
        const initPromise = get().hmsActions ? Promise.resolve() : get().init100ms();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        const [profileResult, token] = await Promise.all([
          supabase.from('users').select('display_name').eq('id', user.id).single(),
          generateAuthToken(s.roomId, user.id),
          initPromise,
        ]);
        const actions = get().hmsActions;
        if (!actions) throw new Error('Звонки ещё не готовы');
        const profile = profileResult.data;
        if (get().callStatus !== 'ringing') return;
        await actions.join({
          authToken: token,
          userName: profile?.display_name || 'User',
          settings: { isAudioMuted: false, isVideoMuted: s.callType !== 'video' },
        });
      }

      if (get().callStatus === 'idle') return;
      const started = Date.now();
      set({ callStatus: 'active', connectionStage: 'connected', isAnswering: false, callStartTime: started });
      void sendSignal(s.remoteUser.id, { type: 'call_accepted', roomId: s.roomId, isGroup: s.isGroupCall });
      if (s.groupConversationId && s.roomId) {
        void supabase.rpc('heartbeat_call', {
          p_conversation: s.groupConversationId, p_room: s.roomId, p_type: s.callType,
        });
        startCallHeartbeat(s.groupConversationId, s.roomId, s.callType);
      }
    } catch (e: any) {
      console.error('accept call:', e);
      set({ isAnswering: false, connectionStage: 'ringing' });
      if (get().callStatus === 'ringing' && getNotifPref('sndCall')) startCallRingtone();
      const name = e?.name;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        toast.error('Разрешите доступ к микрофону и камере в настройках браузера');
      } else {
        toast.error('Не удалось подключиться к звонку: ' + (e?.message || e));
      }
    }
  },

  declineCall: () => {
    const s = { ...get() };
    stopCallRingtone();
    rememberCompletedCall(s, 'declined');
    get()._cleanup();
    if (s.remoteUser) void sendSignal(s.remoteUser.id, { type: 'call_declined', roomId: s.roomId, isGroup: s.isGroupCall });
  },

  endCall: async () => {
    const s = { ...get() };
    if (s.callStatus === 'idle') return;
    const finalStatus: 'answered' | 'missed' = s.callStartTime ? 'answered' : 'missed';
    rememberCompletedCall(s, finalStatus);

    // Закрываем экран и освобождаем медиа сразу; история и сигналы уходят в фоне.
    get()._cleanup();

    void (async () => {
      await finishCallTimeline(s, finalStatus);
      let currentUserId: string | null = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        currentUserId = user?.id || null;
        if (user && s.groupConversationId) {
          const participantIds = s.remoteUser
            ? [user.id, s.remoteUser.id]
            : Array.from(new Set([user.id, ...s.groupParticipants.map(p => p.id)]));
          await supabase.from('call_logs').insert({
            conversation_id: s.groupConversationId,
            initiated_by: s.callDirection === 'outgoing' ? user.id : (s.remoteUser?.id || user.id),
            type: s.callType, status: finalStatus,
            started_at: s.callMessageStartedAt || new Date(s.callStartTime || Date.now()).toISOString(),
            ended_at: new Date().toISOString(), participants: participantIds,
          });
        }
      } catch {}

      if (!s.isGroupCall && s.remoteUser) {
        await sendSignal(s.remoteUser.id, { type: 'call_ended', roomId: s.roomId, isGroup: false });
      } else if (s.isGroupCall && s.callDirection === 'outgoing' && s.callStatus !== 'active') {
        // Отмена ещё не принятого группового вызова должна мгновенно убрать экран
        // у всех приглашённых. Выход из уже активной комнаты не завершает звонок другим.
        const targets = Array.from(new Set(s.groupParticipants.map(p => p.id)))
          .filter(id => id && id !== currentUserId);
        await Promise.allSettled(targets.map(id => sendSignal(id, {
          type: 'call_ended', roomId: s.roomId, isGroup: true, endForAll: true,
        })));
      }
      if (s.provider === '100ms' && s.hmsActions) {
        try { await s.hmsActions.leave(); } catch {}
      }
    })();
  },

  toggleMic: async () => {
    await withControlLock('mic', async () => {
      const { provider, localStream, micEnabled, hmsActions } = get();
      const next = !micEnabled;
      set({ micEnabled: next });
      try {
        if (provider === 'peerjs' && localStream) {
          localStream.getAudioTracks().forEach(t => { t.enabled = next; });
        } else if (hmsActions) {
          await hmsActions.setLocalAudioEnabled(next);
        } else {
          throw new Error('Аудио ещё не готово');
        }
      } catch (e: any) {
        set({ micEnabled });
        toast.error('Не удалось переключить микрофон: ' + (e?.message || e));
      }
    });
  },

  switchCamera: async () => {
    const s = get();
    const { provider, localStream, currentFacingMode, currentCall, callType, hmsActions } = s;
    if (callType !== 'video') return;

    // Защита от двойного нажатия
    if (switchCameraBusy) return;
    switchCameraBusy = true;

    try {
      // ---- 100ms (SFU) — есть встроенный switchCamera в SDK
      if (provider === '100ms' && hmsActions) {
        try {
          await hmsActions.switchCamera();
          // SDK сам разруливает локальный preview и публикацию для других пиров
          set({ currentFacingMode: currentFacingMode === 'user' ? 'environment' : 'user' });
        } catch (e: any) {
          console.error('[100ms] switchCamera failed:', e);
          toast.error('Не удалось переключить камеру: ' + (e?.message || e));
        }
        return;
      }

      // ---- PeerJS (P2P) — ручная замена трека
      if (!localStream) return;
      const newMode: 'user' | 'environment' = currentFacingMode === 'user' ? 'environment' : 'user';

      // Сначала пытаемся через enumerateDevices + deviceId (надёжнее на iOS Safari)
      let videoConstraints: MediaTrackConstraints = {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: { ideal: newMode },
      };
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter(d => d.kind === 'videoinput');
        if (cams.length > 1) {
          const wantBack = newMode === 'environment';
          const back = cams.find(d => /back|rear|environment/i.test(d.label));
          const front = cams.find(d => /front|user|face/i.test(d.label));
          const target = wantBack ? (back || cams[1]) : (front || cams[0]);
          if (target?.deviceId) {
            videoConstraints = {
              width: { ideal: 640 },
              height: { ideal: 480 },
              deviceId: { exact: target.deviceId },
            };
          }
        }
      } catch {
        // если enumerate упадёт — упадёт обратно на facingMode
      }

      let newStream: MediaStream | null = null;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: videoConstraints,
        });
      } catch (e: any) {
        // fallback: пробуем чистый facingMode
        try {
          newStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: newMode },
          });
        } catch (e2: any) {
          toast.error('Не удалось переключить камеру: ' + (e2?.message || e2));
          return;
        }
      }

      const newTrack = newStream.getVideoTracks()[0];
      if (!newTrack) {
        newStream.getTracks().forEach(t => t.stop());
        return;
      }

      // Заменяем трек у пира (если соединение живое)
      try {
        const pc = currentCall?.peerConnection;
        if (pc) {
          const sender = pc.getSenders().find((s: any) => s.track?.kind === 'video');
          if (sender) await sender.replaceTrack(newTrack);
        }
      } catch (e) {
        console.warn('replaceTrack failed (continuing locally):', e);
      }

      // Останавливаем старые видео-треки только после успеха
      localStream.getVideoTracks().forEach(t => t.stop());

      const audioTrack = localStream.getAudioTracks()[0];
      const combined = new MediaStream();
      if (audioTrack) combined.addTrack(audioTrack);
      combined.addTrack(newTrack);
      set({ localStream: combined, currentFacingMode: newMode });
    } finally {
      switchCameraBusy = false;
    }
  },

  toggleCamera: async () => {
    await withControlLock('camera', async () => {
      const { provider, localStream, cameraEnabled, hmsActions } = get();
      const next = !cameraEnabled;
      set({ cameraEnabled: next });
      try {
        if (provider === 'peerjs' && localStream) {
          localStream.getVideoTracks().forEach(t => { t.enabled = next; });
        } else if (hmsActions) {
          await hmsActions.setLocalVideoEnabled(next);
        } else {
          throw new Error('Камера ещё не готова');
        }
      } catch (e: any) {
        set({ cameraEnabled });
        toast.error('Не удалось переключить камеру: ' + (e?.message || e));
      }
    });
  },

  // Переключение между разговорным и громким динамиком.
  // На iOS Safari WebRTC аудио маршрутизируется по типу медиа-элемента:
  //   <audio>  → earpiece (разговорный, у уха)
  //   <video>  → speaker  (основной, громкоговоритель)
  // CallOverlay рендерит оба элемента; видимый (немьютнутый) определяется
  // этим стейтом. Это единственный способ переключить вывод в Safari iOS,
  // потому что setSinkId() там не поддерживается. На desktop оба варианта
  // звучат одинаково — на устройство по умолчанию.
  toggleAudioOutput: async () => {
    await withControlLock('audio-output', async () => {
      const s = get();
      const nextMode = s.audioOutputMode === 'speaker' ? 'earpiece' : 'speaker';

      // PeerJS использует две media-ветки в CallOverlay и переключается мгновенно.
      if (s.provider === 'peerjs') {
        set({ audioOutputMode: nextMode });
        return;
      }

      try {
        const mediaDevices = navigator.mediaDevices as any;
        let deviceId: string | null = null;

        // Chrome/Edge могут показать нативный выбор устройства вывода.
        if (typeof mediaDevices?.selectAudioOutput === 'function') {
          const device = await mediaDevices.selectAudioOutput();
          deviceId = device?.deviceId || null;
        } else if (mediaDevices?.enumerateDevices) {
          const devices = (await mediaDevices.enumerateDevices()).filter((d: MediaDeviceInfo) => d.kind === 'audiooutput');
          if (devices.length > 0) {
            const index = Math.max(0, devices.findIndex((d: MediaDeviceInfo) => d.deviceId === selectedAudioOutputDeviceId));
            deviceId = devices[(index + 1) % devices.length]?.deviceId || devices[0]?.deviceId || null;
          }
        }

        if (!deviceId) {
          toast.info('Вывод звука переключается системной кнопкой устройства');
          return;
        }

        if (s.hmsActions?.setAudioOutputDevice) {
          await s.hmsActions.setAudioOutputDevice(deviceId);
        } else {
          const elements = Array.from(document.querySelectorAll('audio, video')) as Array<HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> }>;
          const switchable = elements.filter(el => typeof el.setSinkId === 'function');
          if (!switchable.length) throw new Error('Переключение вывода не поддерживается');
          await Promise.all(switchable.map(el => el.setSinkId!(deviceId!)));
        }

        selectedAudioOutputDeviceId = deviceId;
        set({ audioOutputMode: nextMode });
      } catch (e: any) {
        if (e?.name !== 'NotAllowedError') {
          toast.error('Не удалось переключить вывод звука: ' + (e?.message || e));
        }
      }
    });
  },

  // Переключение видео В ТЕКУЩЕМ звонке:
  //   • Если видео уже есть в стриме — то же что toggleCamera (вкл/выкл)
  //   • Если callType === 'audio' и видео не было — берём камеру, добавляем трек,
  //     перепереговариваем соединение (PeerJS) или просим SDK включить (100ms)
  // Это позволяет аудио-звонку «прорасти» в видео не пересозданием звонка.
  toggleVideo: async () => {
    await withControlLock('video', async () => {
      const s = get();
      const { provider, localStream, cameraEnabled, hmsActions, callStatus, currentCall } = s;
      if (callStatus !== 'active' && callStatus !== 'calling') return;
      const next = !cameraEnabled;

      // Мгновенно меняем состояние кнопки; при ошибке откатываем.
      set({ cameraEnabled: next, callType: next ? 'video' : s.callType });
      try {
        if (provider === '100ms') {
          if (!hmsActions) throw new Error('Камера ещё не готова');
          await hmsActions.setLocalVideoEnabled(next);
          return;
        }

        if (provider !== 'peerjs') return;
        const existingVideoTrack = localStream?.getVideoTracks()?.[0];
        if (existingVideoTrack) {
          existingVideoTrack.enabled = next;
          return;
        }
        if (!next) return;

        const videoStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        });
        const newVideoTrack = videoStream.getVideoTracks()[0];
        if (!newVideoTrack) throw new Error('Камера не найдена');

        const pc = currentCall?.peerConnection;
        if (pc) pc.addTrack(newVideoTrack, videoStream);
        const combined = new MediaStream();
        localStream?.getAudioTracks().forEach(t => combined.addTrack(t));
        combined.addTrack(newVideoTrack);
        set({ localStream: combined, currentFacingMode: 'user' });
      } catch (e: any) {
        set({ cameraEnabled, callType: s.callType });
        const name = e?.name;
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          toast.error('Разрешите доступ к камере в настройках браузера');
        } else {
          toast.error('Не удалось переключить видео: ' + (e?.message || e));
        }
      }
    });
  },

  toggleScreenShare: async () => {
    await withControlLock('screen', async () => {
      const { provider, hmsActions, isScreenSharing, callStatus } = get();
      if (provider !== '100ms' || !hmsActions) {
        toast.info('Демонстрация экрана недоступна в этом звонке');
        return;
      }
      if (callStatus !== 'active') return;
      if (typeof navigator === 'undefined' || !(navigator.mediaDevices as any)?.getDisplayMedia) {
        toast.error('Демонстрация экрана не поддерживается в этом браузере');
        return;
      }
      const target = !isScreenSharing;
      set({ isScreenSharing: target });
      try {
        await hmsActions.setScreenShareEnabled(target, { videoOnly: true });
      } catch (e: any) {
        set({ isScreenSharing });
        const msg = e?.message || '';
        if (e?.name !== 'NotAllowedError' && !/permission denied|cancel|abort|dismiss/i.test(msg)) {
          toast.error('Не удалось включить демонстрацию: ' + (msg || e));
        }
      }
    });
  },
}));
