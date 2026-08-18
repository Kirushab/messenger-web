type WarmEntry = {
  video: HTMLVideoElement;
  createdAt: number;
  timer: number | null;
};

const warmPool = new Map<string, WarmEntry>();
const MAX_WARM_VIDEOS = 5;
const MAX_AGE_MS = 90_000;


function removeWarmEntry(url: string, entry: WarmEntry) {
  if (entry.timer) window.clearTimeout(entry.timer);
  try { entry.video.pause(); } catch {}
  try { entry.video.removeAttribute('src'); entry.video.load(); } catch {}
  try { entry.video.remove(); } catch {}
  warmPool.delete(url);
}

function cleanupWarmPool() {
  const now = Date.now();
  for (const [url, entry] of warmPool) {
    if (now - entry.createdAt > MAX_AGE_MS) {
      removeWarmEntry(url, entry);
    }
  }
  while (warmPool.size > MAX_WARM_VIDEOS) {
    const oldest = [...warmPool.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
    if (!oldest) break;
    const [url, entry] = oldest;
    removeWarmEntry(url, entry);
  }
}

/**
 * Best-effort browser/CDN warm-up for the next video.
 * We keep a tiny off-screen <video preload="auto"> alive briefly so Safari/Chrome
 * can request the first media ranges before the user reaches that item.
 */
export function warmVideo(url: string | null | undefined) {
  if (!url || typeof document === 'undefined') return;
  cleanupWarmPool();
  if (warmPool.has(url)) return;

  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.setAttribute('aria-hidden', 'true');
  video.tabIndex = -1;
  video.style.position = 'fixed';
  video.style.width = '1px';
  video.style.height = '1px';
  video.style.left = '-10px';
  video.style.bottom = '-10px';
  video.style.opacity = '0';
  video.style.pointerEvents = 'none';
  video.src = url;

  // Appending is more reliable on iOS Safari than keeping a detached media node.
  document.body.appendChild(video);
  const entry: WarmEntry = { video, createdAt: Date.now(), timer: null };
  entry.timer = window.setTimeout(() => removeWarmEntry(url, entry), MAX_AGE_MS);
  warmPool.set(url, entry);
  try { video.load(); } catch {}
}

export function bufferedAhead(video: HTMLVideoElement): number {
  const current = video.currentTime || 0;
  try {
    for (let i = 0; i < video.buffered.length; i += 1) {
      const start = video.buffered.start(i);
      const end = video.buffered.end(i);
      if (current >= start - 0.05 && current <= end + 0.05) return Math.max(0, end - current);
    }
  } catch {}
  return 0;
}

export function initialBufferTarget(video: HTMLVideoElement): number {
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const connection = (navigator as any)?.connection;
  const effectiveType = String(connection?.effectiveType || '');
  let target = 2.4;
  if (effectiveType === '3g') target = 3.2;
  if (effectiveType === '2g' || effectiveType === 'slow-2g') target = 4.2;
  if (duration > 0) target = Math.min(target, Math.max(0.7, duration * 0.35));
  return target;
}
