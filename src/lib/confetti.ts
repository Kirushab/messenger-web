// Confetti — canvas-based, без зависимостей.
// Использование: triggerConfetti() или triggerConfetti({ x: 100, y: 200 })

interface ConfettiParticle {
  x: number; y: number;
  vx: number; vy: number;
  rotation: number; vRotation: number;
  size: number;
  color: string;
  shape: 'square' | 'circle' | 'rect';
}

interface Options {
  x?: number;        // px от левого края (default — центр экрана)
  y?: number;        // px от верха (default — верхняя треть)
  count?: number;    // частиц (default 80)
  colors?: string[]; // палитра
  duration?: number; // мс (default 2500)
  spread?: number;   // угол разлёта в радианах от 0 (default π * 0.8)
  power?: number;    // скорость частиц (default 10)
}

const DEFAULT_COLORS = [
  '#EC4899', '#3B82F6', '#10B981', '#F59E0B',
  '#8B5CF6', '#EF4444', '#F472B6', '#FBBF24',
];

// Защита от prefers-reduced-motion
function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { return false; }
}

export function triggerConfetti(options: Options = {}) {
  if (reducedMotion()) return;

  const w = window.innerWidth;
  const h = window.innerHeight;
  const startX = options.x ?? w / 2;
  const startY = options.y ?? h / 3;
  const count = options.count ?? 80;
  const colors = options.colors ?? DEFAULT_COLORS;
  const duration = options.duration ?? 2500;
  const spread = options.spread ?? Math.PI * 0.8;
  const power = options.power ?? 10;

  // Canvas поверх всего
  const canvas = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.cssText = `
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 9999;
  `;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) { canvas.remove(); return; }
  ctx.scale(dpr, dpr);

  // Частицы
  const particles: ConfettiParticle[] = [];
  for (let i = 0; i < count; i++) {
    // Угол: вверх с разбросом по spread
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * spread;
    const speed = power * (0.6 + Math.random() * 0.6);
    const shapeRand = Math.random();
    particles.push({
      x: startX + (Math.random() - 0.5) * 30,
      y: startY + (Math.random() - 0.5) * 20,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rotation: Math.random() * Math.PI * 2,
      vRotation: (Math.random() - 0.5) * 0.35,
      size: 5 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      shape: shapeRand < 0.5 ? 'rect' : shapeRand < 0.75 ? 'square' : 'circle',
    });
  }

  const gravity = 0.32;
  const drag = 0.99;
  const startTime = Date.now();
  const fadeMs = 600;

  let rafId = 0;
  function frame() {
    if (!ctx) return;
    const elapsed = Date.now() - startTime;
    if (elapsed > duration) {
      canvas.remove();
      cancelAnimationFrame(rafId);
      return;
    }

    ctx.clearRect(0, 0, w, h);

    for (const p of particles) {
      p.vy += gravity;
      p.vx *= drag;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.vRotation;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;

      // Затухание в конце
      const fadeStart = duration - fadeMs;
      if (elapsed > fadeStart) {
        ctx.globalAlpha = Math.max(0, 1 - (elapsed - fadeStart) / fadeMs);
      }

      if (p.shape === 'rect') {
        ctx.fillRect(-p.size, -p.size / 2.5, p.size * 2, p.size / 1.25);
      } else if (p.shape === 'square') {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    rafId = requestAnimationFrame(frame);
  }

  rafId = requestAnimationFrame(frame);
}

// Из центра элемента (удобный шорткат)
export function confettiFromElement(el: HTMLElement, options: Omit<Options, 'x' | 'y'> = {}) {
  const r = el.getBoundingClientRect();
  triggerConfetti({
    ...options,
    x: r.left + r.width / 2,
    y: r.top + r.height / 2,
  });
}
