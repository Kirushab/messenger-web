// Состояние «не удалось загрузить» с кнопкой повтора.
export default function ErrorRetry({ onRetry, text }: { onRetry: () => void; text?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg></div>
      <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{text || 'Не удалось загрузить'}</div>
      <div style={{ fontSize: 'var(--fs-caption)', marginBottom: 14 }}>Проверь соединение и попробуй ещё раз.</div>
      <button onClick={onRetry} className="alias-btn-press" style={{ padding: '10px 22px', borderRadius: 22, border: 'none', background: 'var(--accent)', color: 'var(--bg)', fontSize: 'var(--fs-snap14)', fontWeight: 700, cursor: 'pointer' }}>Повторить</button>
    </div>
  );
}
