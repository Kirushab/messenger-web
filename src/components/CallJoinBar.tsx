import { useActiveCallsStore } from '@/stores/activeCallsStore';
import { useCallStore } from '@/stores/callStore';

// Вариант 1: закреплённая плашка в чате под шапкой — «идёт звонок · присоединиться».
export default function CallJoinBar({ conversationId, conversationName }: { conversationId: string; conversationName: string }) {
  const call = useActiveCallsStore(s => s.calls[conversationId]);
  const callStatus = useCallStore(s => s.callStatus);
  const groupConversationId = useCallStore(s => s.groupConversationId);
  const joinGroupCall = useCallStore(s => s.joinGroupCall);

  if (!call) return null;
  // Я уже в этом звонке — плашку не показываем (открыт оверлей звонка)
  if (callStatus !== 'idle' && groupConversationId === conversationId) return null;

  const busyElsewhere = callStatus !== 'idle';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'rgba(22,163,74,0.12)',
      borderBottom: '1px solid rgba(22,163,74,0.25)',
      padding: '8px 14px',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: '#16A34A', animation: 'callPulse 1.2s ease-in-out infinite', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--text)' }}>
          {call.call_type === 'video' ? 'Идёт видеозвонок' : 'Идёт звонок'}
        </div>
        <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)' }}>{call.participant_ids.length} участн.</div>
      </div>
      <button
        onClick={() => { if (!busyElsewhere) joinGroupCall(conversationId, conversationName, call.room_id, call.call_type); }}
        disabled={busyElsewhere}
        style={{ flexShrink: 0, background: busyElsewhere ? 'var(--surface-light)' : '#16A34A', color: busyElsewhere ? 'var(--muted)' : '#fff', border: 'none', borderRadius: 999, padding: '7px 16px', fontSize: 'var(--fs-label)', fontWeight: 700, cursor: busyElsewhere ? 'default' : 'pointer' }}
      >Присоединиться</button>
      <style>{`@keyframes callPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.7)} }`}</style>
    </div>
  );
}
