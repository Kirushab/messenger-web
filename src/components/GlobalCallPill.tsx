import { useLocation } from 'react-router-dom';
import { useActiveCallsStore } from '@/stores/activeCallsStore';
import { useCallStore } from '@/stores/callStore';
import { useChatStore } from '@/stores/chatStore';
import { haptic } from '@/lib/haptics';

// Вариант 5: глобальная «живая» пилюля — видна на любом экране, когда в одной
// из твоих групп идёт звонок, а ты сейчас не в звонке.
export default function GlobalCallPill() {
  const loc = useLocation();
  const calls = useActiveCallsStore(s => s.calls);
  const conversations = useChatStore(s => s.conversations);
  const callStatus = useCallStore(s => s.callStatus);
  const joinGroupCall = useCallStore(s => s.joinGroupCall);

  // Я сейчас занят звонком — пилюлю не показываем
  if (callStatus !== 'idle') return null;

  const entries = Object.values(calls);
  if (entries.length === 0) return null;

  // Берём первый звонок, к которому я ещё не подключён, и не на его же экране чата
  const call = entries.find(c => !loc.pathname.startsWith('/chat/' + c.conversation_id));
  if (!call) return null;

  const conv = conversations.find(c => c.id === call.conversation_id);
  const name = conv?.name || 'Групповой звонок';

  return (
    <div className="call-pill-in" style={{
      position: 'fixed',
      top: 'max(8px, env(safe-area-inset-top, 8px))',
      left: 12, right: 12, zIndex: 8000,
      display: 'flex', alignItems: 'center', gap: 10,
      background: '#16A34A', color: '#fff',
      borderRadius: 14, padding: '8px 10px 8px 14px',
      boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
    }}>
      <span style={{ width: 9, height: 9, borderRadius: 5, background: '#fff', animation: 'callPulse 1.2s ease-in-out infinite', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--fs-label)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {call.call_type === 'video' ? 'Видеозвонок' : 'Звонок'} в «{name}»
        </div>
        <div style={{ fontSize: 'var(--fs-micro)', opacity: 0.85 }}>{call.participant_ids.length} в звонке</div>
      </div>
      <button
        onClick={() => { haptic.success(); joinGroupCall(call.conversation_id, name, call.room_id, call.call_type); }}
        className="call-btn-press"
        style={{ flexShrink: 0, background: '#fff', color: '#16A34A', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 'var(--fs-label)', fontWeight: 700, cursor: 'pointer' }}
      >Войти</button>
      <style>{`@keyframes callPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.7)} }`}</style>
    </div>
  );
}
