import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { usePixelStore, PALETTE, CANVAS_SIZE, COOLDOWN_MS } from '@/stores/pixelStore';

const MIN_SCALE = 1;
const MAX_SCALE = 30;

export default function PixelBoard() {
  const nav = useNavigate();
  const { session } = useAuthStore();
  const myId = session?.user?.id;

  const { round, pixels, loading, error, lastPlacedAt, loadCanvas, placePixel, subscribeRealtime, unsubscribeRealtime } = usePixelStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 4 });
  const [selectedPixel, setSelectedPixel] = useState<{ x: number; y: number } | null>(null);
  const [chosenColor, setChosenColor] = useState<number>(7); // start with white
  const [now, setNow] = useState(Date.now());
  const [placementError, setPlacementError] = useState<string | null>(null);

  // Тикаем для cooldown UI
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    loadCanvas();
    subscribeRealtime();
    return () => unsubscribeRealtime();
  }, []);

  // Центрируем при первой загрузке
  const centeredRef = useRef(false);
  useEffect(() => {
    if (centeredRef.current) return;
    const cont = containerRef.current;
    if (!cont) return;
    const rect = cont.getBoundingClientRect();
    if (rect.width < 50) return;
    // Подбираем масштаб чтобы холст влезал по ширине с небольшим отступом
    const targetScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, (rect.width - 32) / CANVAS_SIZE));
    const scaledSize = CANVAS_SIZE * targetScale;
    setTransform({
      x: (rect.width - scaledSize) / 2,
      y: (rect.height - scaledSize) / 2,
      scale: targetScale,
    });
    centeredRef.current = true;
  }, [loading]);

  // Рендер canvas каждый раз когда меняются pixels
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Чистим серым фоном
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Используем ImageData для скорости
    const imageData = ctx.createImageData(CANVAS_SIZE, CANVAS_SIZE);
    const data = imageData.data;

    for (let i = 0; i < pixels.length; i++) {
      const colorIdx = pixels[i];
      let r = 34, g = 34, b = 34;
      if (colorIdx >= 0 && colorIdx < PALETTE.length) {
        const hex = PALETTE[colorIdx];
        r = parseInt(hex.slice(1, 3), 16);
        g = parseInt(hex.slice(3, 5), 16);
        b = parseInt(hex.slice(5, 7), 16);
      }
      const di = i * 4;
      data[di] = r;
      data[di + 1] = g;
      data[di + 2] = b;
      data[di + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
  }, [pixels]);

  // ============ Touch handling ============

  const touchStateRef = useRef({
    mode: 'idle' as 'idle' | 'pan' | 'pinch',
    startX: 0, startY: 0,
    startTx: 0, startTy: 0,
    startDist: 0,
    startScale: 0,
    pinchCenterX: 0, pinchCenterY: 0,
    moved: false,
    tStart: 0,
  });

  const onTouchStart = (e: React.TouchEvent) => {
    const t = touchStateRef.current;
    t.moved = false;
    t.tStart = Date.now();

    if (e.touches.length === 1) {
      t.mode = 'pan';
      t.startX = e.touches[0].clientX;
      t.startY = e.touches[0].clientY;
      t.startTx = transform.x;
      t.startTy = transform.y;
    } else if (e.touches.length === 2) {
      t.mode = 'pinch';
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      t.startDist = Math.sqrt(dx * dx + dy * dy);
      t.startScale = transform.scale;
      t.pinchCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      t.pinchCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      t.startTx = transform.x;
      t.startTy = transform.y;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const t = touchStateRef.current;
    if (t.mode === 'pan' && e.touches.length === 1) {
      const dx = e.touches[0].clientX - t.startX;
      const dy = e.touches[0].clientY - t.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) t.moved = true;
      setTransform(prev => ({ ...prev, x: t.startTx + dx, y: t.startTy + dy }));
    } else if (t.mode === 'pinch' && e.touches.length === 2) {
      t.moved = true;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, t.startScale * (dist / t.startDist)));
      // Pinch around pinch center
      const ratio = newScale / t.startScale;
      const cont = containerRef.current!.getBoundingClientRect();
      const cx = t.pinchCenterX - cont.left;
      const cy = t.pinchCenterY - cont.top;
      const newX = cx - (cx - t.startTx) * ratio;
      const newY = cy - (cy - t.startTy) * ratio;
      setTransform({ x: newX, y: newY, scale: newScale });
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const t = touchStateRef.current;
    const wasTap = !t.moved && Date.now() - t.tStart < 300 && e.changedTouches.length === 1;
    if (wasTap) {
      handleTap(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    }
    if (e.touches.length === 0) t.mode = 'idle';
    else if (e.touches.length === 1) {
      // Перешли с пинча на пан — обновляем стартовые значения чтобы не дёрнулось
      t.mode = 'pan';
      t.startX = e.touches[0].clientX;
      t.startY = e.touches[0].clientY;
      t.startTx = transform.x;
      t.startTy = transform.y;
    }
  };

  // Mouse fallback
  const mouseStateRef = useRef({ down: false, mode: 'idle' as 'idle' | 'pan', x: 0, y: 0, tx: 0, ty: 0, moved: false });

  const onMouseDown = (e: React.MouseEvent) => {
    mouseStateRef.current = { down: true, mode: 'pan', x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y, moved: false };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!mouseStateRef.current.down) return;
    const dx = e.clientX - mouseStateRef.current.x;
    const dy = e.clientY - mouseStateRef.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) mouseStateRef.current.moved = true;
    setTransform(prev => ({ ...prev, x: mouseStateRef.current.tx + dx, y: mouseStateRef.current.ty + dy }));
  };
  const onMouseUp = (e: React.MouseEvent) => {
    if (!mouseStateRef.current.moved) handleTap(e.clientX, e.clientY);
    mouseStateRef.current.down = false;
    mouseStateRef.current.mode = 'idle';
  };
  const onWheel = (e: React.WheelEvent) => {
    const cont = containerRef.current!.getBoundingClientRect();
    const cx = e.clientX - cont.left;
    const cy = e.clientY - cont.top;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, transform.scale * factor));
    const ratio = newScale / transform.scale;
    const newX = cx - (cx - transform.x) * ratio;
    const newY = cy - (cy - transform.y) * ratio;
    setTransform({ x: newX, y: newY, scale: newScale });
  };

  const handleTap = (clientX: number, clientY: number) => {
    const cont = containerRef.current?.getBoundingClientRect();
    if (!cont) return;
    const localX = clientX - cont.left - transform.x;
    const localY = clientY - cont.top - transform.y;
    const px = Math.floor(localX / transform.scale);
    const py = Math.floor(localY / transform.scale);
    if (px < 0 || px >= CANVAS_SIZE || py < 0 || py >= CANVAS_SIZE) {
      setSelectedPixel(null);
      return;
    }
    setSelectedPixel({ x: px, y: py });
    setPlacementError(null);
  };

  const cooldownLeft = Math.max(0, COOLDOWN_MS - (now - lastPlacedAt));
  const cooldownActive = cooldownLeft > 0;

  const handlePlace = async () => {
    if (!selectedPixel || !myId || cooldownActive) return;
    setPlacementError(null);
    const { error } = await placePixel(myId, selectedPixel.x, selectedPixel.y, chosenColor);
    if (error) {
      setPlacementError(error);
      return;
    }
    // Успех — закрываем выбор
    setSelectedPixel(null);
  };

  // ============ RENDER ============

  return (
    <div style={{position:'relative', height:'100%', overflow:'hidden', background:'var(--bg)'}}>
      {/* Шапка */}
      <div style={{
        position:'absolute',
        top:'max(8px, env(safe-area-inset-top, 8px))',
        left:8, right:8,
        zIndex:10,
        display:'flex',
        alignItems:'center',
        gap:8,
        pointerEvents:'none',
      }}>
        <button
          onClick={() => nav(-1)}
          style={{
            width:38, height:38, borderRadius:19,
            background:'var(--surface)', backdropFilter:'blur(10px)',
            border:'1px solid var(--border)', color:'var(--text)', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            pointerEvents:'auto',
            fontSize: 'var(--fs-title)', lineHeight:1,
            boxShadow:'0 2px 8px rgba(0,0,0,0.12)',
          }}
        >‹</button>
        <div style={{
          background:'var(--surface)', backdropFilter:'blur(10px)',
          padding:'8px 14px', borderRadius:20,
          color:'var(--text)', fontSize: 'var(--fs-snap14)', fontWeight:600,
          pointerEvents:'auto',
          border:'1px solid var(--border)',
          boxShadow:'0 2px 8px rgba(0,0,0,0.12)',
        }}>Pixel-доска</div>
        <div style={{flex:1}} />
        {round && (
          <div style={{
            background:'var(--surface)', backdropFilter:'blur(10px)',
            padding:'6px 10px', borderRadius:14,
            color:'var(--text)', fontSize: 'var(--fs-micro)', opacity:0.85,
            pointerEvents:'auto',
            border:'1px solid var(--border)',
            boxShadow:'0 2px 8px rgba(0,0,0,0.12)',
          }}>Раунд {new Date(round.started_at).toLocaleString('ru', { month: 'long' })}</div>
        )}
      </div>

      {/* Сам холст */}
      <div
        ref={containerRef}
        style={{position:'absolute', inset:0, touchAction:'none', cursor:'grab'}}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => { mouseStateRef.current.down = false; }}
        onWheel={onWheel}
      >
        <div style={{
          position:'absolute',
          left: transform.x,
          top: transform.y,
          width: CANVAS_SIZE * transform.scale,
          height: CANVAS_SIZE * transform.scale,
        }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            style={{
              width:'100%', height:'100%',
              imageRendering:'pixelated',
              boxShadow:'0 0 0 1px var(--border), 0 8px 24px rgba(0,0,0,0.3)',
              display:'block',
              background:'var(--surface-light)',
            }}
          />
          {/* Overlay для выбранного пикселя */}
          {selectedPixel && (
            <div style={{
              position:'absolute',
              left: selectedPixel.x * transform.scale,
              top: selectedPixel.y * transform.scale,
              width: transform.scale,
              height: transform.scale,
              background: PALETTE[chosenColor],
              border: '2px solid #fff',
              boxShadow: '0 0 0 2px rgba(0,0,0,0.7), 0 0 12px rgba(255,255,255,0.5)',
              pointerEvents:'none',
              animation: 'pixelPulse 1.5s ease-in-out infinite',
            }} />
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{
          position:'absolute', top:60, left:'50%', transform:'translateX(-50%)',
          background:'rgba(0,0,0,0.65)', color:'#fff',
          padding:'6px 14px', borderRadius:14, fontSize: 'var(--fs-caption)', zIndex:9,
        }}>Загружаю холст...</div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          position:'absolute', top:60, left:16, right:16,
          background:'rgba(239,68,68,0.95)', color:'#fff',
          padding:'10px 14px', borderRadius:10, fontSize: 'var(--fs-label)', zIndex:9,
        }}>{error}</div>
      )}

      {/* Bottom palette + place button */}
      {selectedPixel && (
        <div style={{
          position:'absolute',
          bottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
          left:12, right:12,
          zIndex:10,
          background:'var(--surface)',
          backdropFilter:'blur(14px)',
          padding:14,
          borderRadius:14,
          border:'1px solid var(--border)',
          boxShadow:'0 4px 24px rgba(0,0,0,0.15)',
        }}>
          <div style={{
            color:'var(--text)', fontSize: 'var(--fs-micro)', opacity:0.7,
            marginBottom:10, textAlign:'center',
          }}>
            Пиксель ({selectedPixel.x}, {selectedPixel.y})
          </div>

          <div style={{
            display:'grid',
            gridTemplateColumns:'repeat(8, 1fr)',
            gap:6,
            marginBottom:12,
          }}>
            {PALETTE.map((c, idx) => (
              <button
                key={idx}
                onClick={() => setChosenColor(idx)}
                style={{
                  aspectRatio:'1/1',
                  background: c,
                  border: chosenColor === idx ? '3px solid var(--accent)' : '1px solid var(--border)',
                  borderRadius: 6,
                  cursor:'pointer',
                  padding:0,
                  boxShadow: chosenColor === idx ? '0 0 8px rgba(243,156,18,0.5)' : 'none',
                  transition:'transform 0.1s',
                  transform: chosenColor === idx ? 'scale(1.08)' : 'scale(1)',
                }}
                aria-label={`Цвет ${idx}`}
              />
            ))}
          </div>

          {placementError && (
            <div style={{fontSize: 'var(--fs-caption)', color:'#FCA5A5', marginBottom:8, textAlign:'center'}}>{placementError}</div>
          )}

          <div style={{display:'flex', gap:8}}>
            <button
              onClick={() => setSelectedPixel(null)}
              style={{
                flex:1, padding:'12px',
                background:'rgba(255,255,255,0.1)',
                border:'1px solid rgba(255,255,255,0.2)',
                borderRadius:10, color:'#fff',
                fontSize: 'var(--fs-snap14)', fontWeight:500, cursor:'pointer',
              }}
            >Отмена</button>
            <button
              onClick={handlePlace}
              disabled={cooldownActive}
              style={{
                flex:2, padding:'12px',
                background: cooldownActive ? 'rgba(255,255,255,0.15)' : '#3B82F6',
                border:'none', borderRadius:10, color:'#fff',
                fontSize: 'var(--fs-snap14)', fontWeight:600,
                cursor: cooldownActive ? 'default' : 'pointer',
                fontVariantNumeric:'tabular-nums',
              }}
            >
              {cooldownActive ? `Подожди ${Math.ceil(cooldownLeft / 1000)} сек` : 'Поставить'}
            </button>
          </div>
        </div>
      )}

      {/* Cooldown indicator (когда нет выбранного пикселя но cooldown активен) */}
      {!selectedPixel && cooldownActive && (
        <div style={{
          position:'absolute',
          bottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
          left:'50%',
          transform:'translateX(-50%)',
          background:'rgba(0,0,0,0.7)',
          backdropFilter:'blur(10px)',
          padding:'8px 16px',
          borderRadius:18,
          color:'#fff',
          fontSize: 'var(--fs-label)',
          fontVariantNumeric:'tabular-nums',
          zIndex:9,
        }}>
          ⏱ Cooldown: {Math.ceil(cooldownLeft / 1000)} сек
        </div>
      )}

      {/* Hint когда нет выбранного и нет cooldown */}
      {!selectedPixel && !cooldownActive && !loading && !error && (
        <div style={{
          position:'absolute',
          bottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
          left:'50%',
          transform:'translateX(-50%)',
          background:'var(--surface-light)',
          backdropFilter:'blur(10px)',
          padding:'8px 14px',
          borderRadius:18,
          color:'var(--text)',
          fontSize: 'var(--fs-caption)',
          opacity:0.9,
          textAlign:'center',
          maxWidth: 280,
          zIndex:9,
          border:'1px solid var(--border)',
        }}>
          Тапни по пикселю чтобы поставить · pinch для зума
        </div>
      )}

      <style>{`
        @keyframes pixelPulse {
          0%, 100% { box-shadow: 0 0 0 2px rgba(0,0,0,0.7), 0 0 12px rgba(255,255,255,0.5); }
          50% { box-shadow: 0 0 0 2px rgba(0,0,0,0.7), 0 0 18px rgba(255,255,255,0.9); }
        }
      `}</style>
    </div>
  );
}
