import { useVideoStore } from '@/stores/videoStore';

// Верхняя плашка видеосообщения — как у голосовых (AudioMiniPlayer), но управляет
// глобальным кружком. Видна во всех состояниях КРОМЕ беззвучного превью
// (т.е. ровно когда есть активный current). Рендерится в Layout.
export default function VideoTopBar() {
  const current = useVideoStore(s => s.current);
  const isPlaying = useVideoStore(s => s.isPlaying);
  const progress = useVideoStore(s => s.progress);
  const rate = useVideoStore(s => s.rate);
  const toggle = useVideoStore(s => s.toggle);
  const cycleRate = useVideoStore(s => s.cycleRate);
  const seekRatio = useVideoStore(s => s.seekRatio);
  const stop = useVideoStore(s => s.stop);

  if (!current) return null;

  const seekFromEvent = (clientX: number, elx: HTMLElement) => {
    const rect = elx.getBoundingClientRect();
    if (rect.width <= 0) return;
    seekRatio((clientX - rect.left) / rect.width);
  };

  return (
    <div className="audio-mini safe-top" style={{ zIndex: 1240 }}>
      <button className="audio-mini-play" onClick={toggle} aria-label={isPlaying ? 'Пауза' : 'Играть'}>
        {isPlaying
          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>}
      </button>

      <div className="audio-mini-mid">
        <div className="audio-mini-title">{current.title || 'Видеосообщение'}</div>
        <div className="audio-mini-sub">Видеосообщение</div>
        <div
          className="audio-mini-track"
          onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); seekFromEvent(e.clientX, e.currentTarget); }}
          onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) seekFromEvent(e.clientX, e.currentTarget); }}
        >
          <div className="audio-mini-fill" style={{ transform: `scaleX(${Math.max(0, Math.min(1, progress))})` }} />
        </div>
      </div>

      <button className="audio-mini-rate" onClick={cycleRate} aria-label="Скорость">
        {rate === 1 ? '1x' : rate === 1.5 ? '1.5x' : '2x'}
      </button>
      <button className="audio-mini-close" onClick={stop} aria-label="Закрыть">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>
  );
}
