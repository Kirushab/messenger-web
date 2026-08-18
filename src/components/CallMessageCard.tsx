import { useActiveCallsStore } from '@/stores/activeCallsStore';
import { useCallStore } from '@/stores/callStore';
import type { MessageWithSender } from '@/types';
import { haptic } from '@/lib/haptics';

export type CallMessageStatus = 'ongoing' | 'answered' | 'missed' | 'declined';

export interface CallMessagePayload {
  v: 1;
  callType: 'audio' | 'video';
  roomId: string;
  status: CallMessageStatus;
  startedAt: string;
  endedAt?: string | null;
  durationSec?: number | null;
  isGroup?: boolean;
}

const PREFIX = '[CALL_V1]';

export function encodeCallMessage(payload: CallMessagePayload): string {
  return PREFIX + JSON.stringify(payload);
}

export function parseCallMessage(content: string | null | undefined): CallMessagePayload | null {
  if (!content?.startsWith(PREFIX)) return null;
  try {
    const parsed = JSON.parse(content.slice(PREFIX.length));
    if (!parsed || parsed.v !== 1 || !parsed.roomId) return null;
    return parsed as CallMessagePayload;
  } catch {
    return null;
  }
}

function formatMessageTime(value: string): string {
  try {
    return new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatDuration(seconds?: number | null): string {
  const total = Math.max(0, Math.floor(seconds || 0));
  if (total < 60) return `${total} сек.`;
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return sec ? `${min} мин. ${sec} сек.` : `${min} мин.`;
}

function PhoneIcon({ video = false }: { video?: boolean }) {
  return video ? (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="5" width="14" height="14" rx="3" />
      <path d="m16 10 5-3v10l-5-3" />
    </svg>
  ) : (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.7 19.7 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.7 19.7 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  );
}

export default function CallMessageCard({
  message,
  currentUserId,
  conversationId,
  conversationName,
}: {
  message: MessageWithSender;
  currentUserId: string;
  conversationId: string;
  conversationName: string;
}) {
  const payload = parseCallMessage(message.content);
  const active = useActiveCallsStore(s => s.calls[conversationId]);
  const callStatus = useCallStore(s => s.callStatus);
  const activeConversationId = useCallStore(s => s.groupConversationId);
  const joinGroupCall = useCallStore(s => s.joinGroupCall);

  if (!payload) return null;

  const mine = message.sender_id === currentUserId;
  const isActive = !!active && active.room_id === payload.roomId;
  const alreadyHere = callStatus !== 'idle' && activeConversationId === conversationId;
  const busyElsewhere = callStatus !== 'idle' && !alreadyHere;
  const isVideo = payload.callType === 'video';

  let title = isVideo ? 'Видеозвонок' : 'Звонок';
  let subtitle = '';
  let tone: 'normal' | 'danger' | 'live' = 'normal';

  if (isActive) {
    title = payload.isGroup
      ? (isVideo ? 'Идёт групповой видеозвонок' : 'Идёт групповой звонок')
      : (isVideo ? 'Идёт видеозвонок' : 'Идёт звонок');
    subtitle = `${active.participant_ids.length} участн.`;
    tone = 'live';
  } else if (payload.status === 'answered') {
    title = payload.isGroup
      ? (isVideo ? 'Групповой видеозвонок' : 'Групповой звонок')
      : (mine
        ? (isVideo ? 'Исходящий видеозвонок' : 'Исходящий звонок')
        : (isVideo ? 'Входящий видеозвонок' : 'Входящий звонок'));
    subtitle = formatDuration(payload.durationSec);
  } else if (mine) {
    title = payload.status === 'declined'
      ? (isVideo ? 'Отклонённый видеозвонок' : 'Отклонённый звонок')
      : (isVideo ? 'Отменённый видеозвонок' : 'Отменённый звонок');
    subtitle = 'Без ответа';
    tone = 'danger';
  } else {
    title = isVideo ? 'Пропущенный видеозвонок' : 'Пропущенный звонок';
    subtitle = payload.status === 'declined' ? 'Отклонён' : 'Без ответа';
    tone = 'danger';
  }

  return (
    <div className={`call-message-card ${mine ? 'mine' : 'theirs'} ${tone}`}>
      <div className="call-message-icon"><PhoneIcon video={isVideo} /></div>
      <div className="call-message-copy">
        <div className="call-message-title">{title}</div>
        <div className="call-message-subtitle">
          {tone === 'danger' ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m17 7-10 10"/><path d="M7 7v10h10"/></svg>
          ) : tone === 'live' ? <span className="call-message-live-dot" /> : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m7 17 10-10"/><path d="M7 7h10v10"/></svg>
          )}
          <span>{subtitle}</span>
          <span className="call-message-time">{formatMessageTime(message.created_at)}</span>
        </div>
      </div>
      {isActive && !alreadyHere && (
        <button
          className="call-message-join"
          disabled={busyElsewhere}
          onClick={(event) => {
            event.stopPropagation();
            if (busyElsewhere) return;
            haptic.success();
            joinGroupCall(conversationId, conversationName, active!.room_id, active!.call_type);
          }}
        >
          {busyElsewhere ? 'Вы уже в звонке' : 'Присоединиться'}
        </button>
      )}
    </div>
  );
}
