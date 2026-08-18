export type LocalMediaPreview = {
  sourceUrl: string;
  previewUrl: string;
  isVideo: boolean;
  width?: number;
  height?: number;
};

const waitFor = (target: EventTarget, event: string, timeoutMs = 12000) => new Promise<void>((resolve, reject) => {
  let done = false;
  const cleanup = () => {
    target.removeEventListener(event, onDone as EventListener);
    target.removeEventListener('error', onError as EventListener);
    clearTimeout(timer);
  };
  const onDone = () => { if (done) return; done = true; cleanup(); resolve(); };
  const onError = () => { if (done) return; done = true; cleanup(); reject(new Error(`Media ${event} failed`)); };
  const timer = window.setTimeout(() => { if (done) return; done = true; cleanup(); reject(new Error(`Media ${event} timeout`)); }, timeoutMs);
  target.addEventListener(event, onDone as EventListener, { once: true });
  target.addEventListener('error', onError as EventListener, { once: true });
});

export async function captureVideoPoster(sourceUrl: string, crossOrigin = false): Promise<{ blob: Blob; width: number; height: number }> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  if (crossOrigin) video.crossOrigin = 'anonymous';
  video.src = sourceUrl;

  await waitFor(video, 'loadedmetadata');
  const width = Math.max(1, video.videoWidth || 1);
  const height = Math.max(1, video.videoHeight || 1);

  // iOS/Safari often paints a black frame at t=0. Seek a tiny bit into the video.
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const target = duration > 0.2 ? Math.min(0.18, Math.max(0.06, duration * 0.03)) : 0;
  if (target > 0 && Math.abs(video.currentTime - target) > 0.01) {
    video.currentTime = target;
    try { await waitFor(video, 'seeked'); } catch { /* loadeddata fallback below */ }
  }
  if (video.readyState < 2) {
    try { await waitFor(video, 'loadeddata'); } catch { /* best effort */ }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(video, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('Poster encode failed')), 'image/jpeg', 0.86);
  });

  video.removeAttribute('src');
  video.load();
  return { blob, width, height };
}

export async function readImageDimensions(file: File): Promise<{ width?: number; height?: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    if (img.decode) await img.decode();
    else await waitFor(img, 'load');
    return { width: img.naturalWidth || undefined, height: img.naturalHeight || undefined };
  } catch {
    return {};
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function createLocalMediaPreview(file: File): Promise<LocalMediaPreview> {
  const sourceUrl = URL.createObjectURL(file);
  const isVideo = file.type.startsWith('video/');
  if (!isVideo) {
    const dims = await readImageDimensions(file);
    return { sourceUrl, previewUrl: sourceUrl, isVideo: false, ...dims };
  }

  try {
    const { blob, width, height } = await captureVideoPoster(sourceUrl, false);
    const previewUrl = URL.createObjectURL(blob);
    return { sourceUrl, previewUrl, isVideo: true, width, height };
  } catch {
    // Keep the real video URL as a fallback; UI video elements still preload a frame.
    return { sourceUrl, previewUrl: sourceUrl, isVideo: true };
  }
}

export function revokeLocalMediaPreview(preview: LocalMediaPreview) {
  try { URL.revokeObjectURL(preview.sourceUrl); } catch { /* noop */ }
  if (preview.previewUrl !== preview.sourceUrl) {
    try { URL.revokeObjectURL(preview.previewUrl); } catch { /* noop */ }
  }
}
