import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface LinkData {
  title?: string;
  description?: string;
  image_url?: string | null;
  publisher?: string;
  failed?: boolean;
}

const previewCache = new Map<string, LinkData | null>();
const incompleteRefreshes = new Set<string>();
const PREVIEW_TIMEOUT_MS = 10000;

function wait(ms: number) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

function normalizePreviewData(raw: any): LinkData | null {
  if (!raw || raw.error || raw.failed) return raw?.failed ? { failed: true } : null;
  if (!raw.title && !raw.image_url && !raw.description) return null;
  return {
    title: raw.title || undefined,
    description: raw.description || undefined,
    image_url: raw.image_url || null,
    publisher: raw.publisher || undefined,
  };
}

function getLinkIdentity(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    let path = decodeURIComponent(parsed.pathname || '/').replace(/\/+$/, '');
    if (!path || path === '/') path = '';
    const shortPath = path.length > 52 ? `${path.slice(0, 49)}…` : path;
    return {
      host,
      label: `${host}${shortPath}`,
    };
  } catch {
    return { host: 'Ссылка', label: 'Открыть ссылку' };
  }
}

function isBookingUrl(url: string): boolean {
  try { return /(^|\.)booking\.com$/i.test(new URL(url).hostname); } catch { return false; }
}

function isWeakPreviewImage(url: string | null | undefined): boolean {
  if (!url) return true;
  return /s\.wordpress\.com\/mshots|mshots\/v1|generating[-_ ]preview|placeholder|spacer|blank/i.test(url);
}

async function queryPreviewCache(url: string): Promise<LinkData | null> {
  try {
    const { data } = await supabase
      .from('link_previews')
      .select('title,description,image_url,publisher,failed,expires_at')
      .eq('url', url)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    return normalizePreviewData(data);
  } catch {
    return null;
  }
}

async function invokePreviewWithTimeout(url: string, force = false): Promise<LinkData | null> {
  let timeoutId = 0;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error('link-preview timeout')), PREVIEW_TIMEOUT_MS);
    });
    const result = await Promise.race([
      supabase.functions.invoke('link-preview', { body: { url, force } }),
      timeout,
    ]) as any;
    return normalizePreviewData(result?.data);
  } catch {
    return null;
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}

async function loadPreview(url: string): Promise<LinkData> {
  const cached = await queryPreviewCache(url);
  if (cached && !cached.failed) return cached;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parsed = await invokePreviewWithTimeout(url, !!cached?.failed || attempt > 0);
    if (parsed && !parsed.failed) return parsed;
    await wait(attempt === 0 ? 350 : 700);
    const rescued = await queryPreviewCache(url);
    if (rescued && !rescued.failed) return rescued;
  }
  return { failed: true };
}

export function extractUrl(text: string): string | null {
  if (!text) return null;
  const m = text.match(/https?:\/\/[^\s<>]+/);
  if (!m) return null;
  return m[0]
    .replace(/[.,!?;:'"»”’]+$/g, '')
    .replace(/[)\]}>]+$/g, '');
}

function detectDirectMedia(url: string): 'image' | 'video' | null {
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (/\.(jpe?g|png|webp|gif|bmp|svg|avif|heic|heif)$/.test(path)) return 'image';
    if (/\.(mp4|webm|mov|m4v|ogv)$/.test(path)) return 'video';
    return null;
  } catch {
    return null;
  }
}

interface Props {
  url: string;
  isMine: boolean;
  onLayoutChange?: () => void;
}

export default function LinkPreview({ url, isMine, onLayoutChange }: Props) {
  const direct = detectDirectMedia(url);

  if (direct === 'image') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="link-preview-card link-preview-direct"
        style={{ aspectRatio: '16 / 9' }}
      >
        <img
          src={url}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={() => onLayoutChange?.()}
          onError={(e) => {
            (e.currentTarget.parentElement as HTMLElement).style.display = 'none';
            onLayoutChange?.();
          }}
        />
      </a>
    );
  }

  if (direct === 'video') {
    return (
      <div className="link-preview-card link-preview-direct" style={{ aspectRatio: '16 / 9', background: '#000' }} onClick={(e) => e.stopPropagation()}>
        <video
          src={url}
          controls
          playsInline
          preload="metadata"
          onLoadedMetadata={() => onLayoutChange?.()}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    );
  }

  return <OpenGraphPreview url={url} isMine={isMine} onLayoutChange={onLayoutChange} />;
}

function OpenGraphPreview({ url, isMine, onLayoutChange }: Props) {
  const sessionCached = previewCache.get(url);
  const [data, setData] = useState<LinkData | null>(sessionCached && !sessionCached.failed ? sessionCached : null);
  const [loading, setLoading] = useState(!previewCache.has(url));
  const [failed, setFailed] = useState(Boolean(sessionCached?.failed));
  const [imageFailed, setImageFailed] = useState(false);
  const identity = useMemo(() => getLinkIdentity(url), [url]);

  useEffect(() => { onLayoutChange?.(); }, [loading, data, failed, imageFailed, onLayoutChange]);

  useEffect(() => {
    let cancelled = false;

    const apply = (result: LinkData) => {
      if (cancelled) return;
      previewCache.set(url, result);
      if (result.failed) {
        setFailed(true);
        setData(null);
      } else {
        setFailed(false);
        setData(result);
      }
      setLoading(false);
    };

    const refreshIncomplete = async (current: LinkData) => {
      const needsRefresh = !current.image_url || (isBookingUrl(url) && isWeakPreviewImage(current.image_url));
      if (!needsRefresh || incompleteRefreshes.has(url)) return;
      incompleteRefreshes.add(url);
      const refreshed = await invokePreviewWithTimeout(url, true);
      if (!cancelled && refreshed && !refreshed.failed) apply(refreshed);
    };

    if (previewCache.has(url)) {
      const cached = previewCache.get(url);
      if (!cached || cached.failed) {
        setFailed(true);
        setLoading(false);
      } else {
        setData(cached);
        setFailed(false);
        setLoading(false);
        void refreshIncomplete(cached);
      }
      return () => { cancelled = true; };
    }

    setLoading(true);
    setFailed(false);
    void loadPreview(url).then(result => {
      apply(result);
      if (!result.failed) void refreshIncomplete(result);
    }).catch(() => apply({ failed: true }));

    return () => { cancelled = true; };
  }, [url]);

  const cardClass = `link-preview-card ${isMine ? 'is-mine' : 'is-other'}`;
  const publisher = data?.publisher || identity.host;
  const showImage = Boolean(data?.image_url && !imageFailed);

  if (loading) {
    return (
      <div className={`${cardClass} link-preview-skeleton`} aria-hidden="true">
        <div className="link-preview-skeleton-image" />
        <div className="link-preview-skeleton-copy">
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  }

  if (failed || !data) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className={`${cardClass} link-preview-fallback`}>
        <span className="link-preview-fallback-icon" aria-hidden="true">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        </span>
        <span className="link-preview-fallback-copy">
          <strong>{identity.host}</strong>
          <span>{identity.label}</span>
        </span>
        <svg className="link-preview-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>
      </a>
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className={`${cardClass} ${showImage ? 'has-image' : 'no-image'}`}>
      {showImage && (
        <div className="link-preview-image-wrap">
          <img
            src={data.image_url || ''}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onLoad={() => onLayoutChange?.()}
            onError={() => {
              setImageFailed(true);
              onLayoutChange?.();
            }}
          />
        </div>
      )}
      <div className="link-preview-copy">
        <div className="link-preview-publisher">{publisher}</div>
        {data.title && <div className="link-preview-title">{data.title}</div>}
        {data.description && <div className="link-preview-description">{data.description}</div>}
        <div className="link-preview-url">
          <span>{identity.label}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>
        </div>
      </div>
    </a>
  );
}
