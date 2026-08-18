// supabase/functions/link-preview/index.ts
// Rich Open Graph parser with JSON-LD, YouTube oEmbed and screenshot fallback.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { Image } from 'https://deno.land/x/imagescript@1.2.17/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ParsedMetadata {
  title: string | null;
  description: string | null;
  publisher: string | null;
  imageUrl: string | null;
}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    const inputUrl = typeof body?.url === 'string' ? body.url.trim() : '';
    const force = body?.force === true;

    if (!isValidPublicHttpUrl(inputUrl)) return json({ error: 'Invalid URL' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: cached } = await supabase
      .from('link_previews')
      .select('*')
      .eq('url', inputUrl)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cached && !force) return json(cached);

    const videoId = extractYouTubeVideoId(inputUrl);
    let metadata: ParsedMetadata;

    if (videoId) metadata = await parseYouTubeMetadata(videoId);
    else metadata = await parseGenericMetadata(inputUrl);

    const pageUrlForImage = cleanTrackingUrl(inputUrl);
    const storedImage = metadata.imageUrl
      ? await downloadAndStoreImage(supabase, inputUrl, pageUrlForImage, metadata.imageUrl)
      : { path: null, publicUrl: null };

    const preview = {
      url: inputUrl,
      title: cleanText(metadata.title)?.slice(0, 200) || null,
      description: cleanText(metadata.description)?.slice(0, 500) || null,
      publisher: cleanText(metadata.publisher)?.slice(0, 100) || null,
      // Public source URL is retained when compression/storage fails. This is
      // preferable to a blank card and browsers can usually display it directly.
      image_url: storedImage.publicUrl || metadata.imageUrl || null,
      image_path: storedImage.path,
      cached_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      failed: false,
    };

    const { error: cacheError } = await supabase.from('link_previews').upsert(preview);
    if (cacheError) console.error('link preview cache error:', cacheError);

    return json(preview);
  } catch (error) {
    console.error('link-preview error:', error);
    return json({ error: String(error) }, 500);
  }
});

async function parseYouTubeMetadata(videoId: string): Promise<ParsedMetadata> {
  const canonical = `https://www.youtube.com/watch?v=${videoId}`;
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(canonical)}`,
      { headers: { 'User-Agent': BROWSER_HEADERS['User-Agent'], Accept: 'application/json' }, signal: AbortSignal.timeout(8000) },
    );
    if (!response.ok) throw new Error(`YouTube oEmbed HTTP ${response.status}`);
    const data = await response.json();
    return {
      title: typeof data?.title === 'string' ? data.title : 'YouTube',
      description: typeof data?.author_name === 'string' ? `Автор: ${data.author_name}` : null,
      publisher: 'YouTube',
      imageUrl: typeof data?.thumbnail_url === 'string' ? data.thumbnail_url : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    };
  } catch {
    return {
      title: 'YouTube',
      description: 'Открыть видео на YouTube',
      publisher: 'YouTube',
      imageUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    };
  }
}

async function parseGenericMetadata(inputUrl: string): Promise<ParsedMetadata> {
  const fetchUrl = cleanTrackingUrl(inputUrl);
  const identity = getSiteIdentity(fetchUrl);
  let html = '';

  for (const candidate of unique([fetchUrl, inputUrl])) {
    try {
      html = await fetchHtml(candidate);
      if (html) break;
    } catch (error) {
      console.warn('preview fetch attempt failed:', candidate, String(error));
    }
  }

  let title: string | null = null;
  let description: string | null = null;
  let publisher: string | null = null;
  let imageUrl: string | null = null;

  if (html) {
    title = extractMeta(html, ['og:title', 'twitter:title']) || extractTitle(html);
    description = extractMeta(html, ['og:description', 'twitter:description', 'description']);
    publisher = extractMeta(html, ['og:site_name', 'application-name']);
    imageUrl = extractMeta(html, ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']);

    const jsonLd = extractJsonLd(html);
    title ||= jsonLd.title;
    description ||= jsonLd.description;
    publisher ||= jsonLd.publisher;
    imageUrl ||= jsonLd.imageUrl;

    imageUrl ||= extractLinkImage(html);
    if (imageUrl) imageUrl = toAbsoluteUrl(imageUrl, fetchUrl);

    if (identity.isBooking) {
      const booking = extractBookingMetadata(html, fetchUrl);
      title = booking.title || title;
      description = booking.description || description;
      publisher = booking.publisher || publisher;
      if (!imageUrl || isWeakBookingImage(imageUrl)) imageUrl = booking.imageUrl || imageUrl;
    }
  }

  title ||= identity.title;
  publisher ||= identity.publisher;
  description ||= identity.description;

  // If a site does not expose a usable image, keep the card useful via a public screenshot.
  if (!imageUrl) imageUrl = screenshotFallbackUrl(fetchUrl);

  return { title, description, publisher, imageUrl };
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(10000),
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) throw new Error('Not HTML');
  if (!response.body) throw new Error('Empty body');

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  const max = 500_000;

  while (total < max) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    const remaining = max - total;
    chunks.push(value.byteLength > remaining ? value.slice(0, remaining) : value);
    total += Math.min(value.byteLength, remaining);
  }
  await reader.cancel().catch(() => undefined);

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(combined);
}

function extractMeta(html: string, keys: string[]): string | null {
  const wanted = new Set(keys.map(key => key.toLowerCase()));
  const tags = html.match(/<meta\b[^>]*>/gi) || [];

  for (const tag of tags) {
    const key = (getAttr(tag, 'property') || getAttr(tag, 'name') || getAttr(tag, 'itemprop') || '').toLowerCase();
    if (!wanted.has(key)) continue;
    const content = getAttr(tag, 'content');
    if (content) return decodeEntities(content).trim();
  }
  return null;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? cleanText(decodeEntities(stripTags(match[1]))) : null;
}

function extractLinkImage(html: string): string | null {
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const rel = (getAttr(tag, 'rel') || '').toLowerCase();
    if (rel === 'image_src' || rel.includes('apple-touch-icon')) {
      const href = getAttr(tag, 'href');
      if (href) return decodeEntities(href);
    }
  }
  return null;
}

function extractJsonLd(html: string): ParsedMetadata {
  const empty = { title: null, description: null, publisher: null, imageUrl: null };
  const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];

  for (const script of scripts) {
    const body = script.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '').trim();
    try {
      const parsed = JSON.parse(decodeEntities(body));
      const found = walkJsonLd(parsed);
      if (found.title || found.description || found.imageUrl) return found;
    } catch {
      // Some sites ship malformed or truncated JSON-LD; ignore that block.
    }
  }
  return empty;
}

function walkJsonLd(value: any): ParsedMetadata {
  const result: ParsedMetadata = { title: null, description: null, publisher: null, imageUrl: null };
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }

    if (!result.title) result.title = asString(node.headline) || asString(node.name);
    if (!result.description) result.description = asString(node.description);
    if (!result.publisher) result.publisher = asString(node.publisher?.name) || asString(node.brand?.name);
    if (!result.imageUrl) result.imageUrl = imageFromJsonLd(node.image) || imageFromJsonLd(node.thumbnailUrl);

    if (node['@graph']) visit(node['@graph']);
    for (const [key, child] of Object.entries(node)) {
      if (key !== '@graph' && typeof child === 'object') visit(child);
    }
  };
  visit(value);
  return result;
}

function imageFromJsonLd(value: any): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = imageFromJsonLd(item);
      if (found) return found;
    }
  }
  if (value && typeof value === 'object') return asString(value.url) || asString(value.contentUrl);
  return null;
}

async function downloadAndStoreImage(
  supabase: ReturnType<typeof createClient>,
  cacheKeyUrl: string,
  pageUrl: string,
  imageUrl: string,
): Promise<{ path: string | null; publicUrl: string | null }> {
  try {
    const absolute = toAbsoluteUrl(imageUrl, pageUrl);
    if (!absolute || !isValidPublicHttpUrl(absolute)) throw new Error('Invalid image URL');

    const response = await fetch(absolute, {
      headers: {
        'User-Agent': BROWSER_HEADERS['User-Agent'],
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        Referer: pageUrl,
      },
      signal: AbortSignal.timeout(14000),
      redirect: 'follow',
    });
    if (!response.ok) throw new Error(`Image HTTP ${response.status}`);

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) throw new Error('Not an image');
    const buffer = await response.arrayBuffer();
    if (!buffer.byteLength || buffer.byteLength > 10 * 1024 * 1024) throw new Error('Invalid image size');

    const hash = await sha256Short(cacheKeyUrl);
    let bytes: Uint8Array;
    let mime = 'image/jpeg';
    let ext = 'jpg';

    try {
      const image = await Image.decode(new Uint8Array(buffer));
      const max = 900;
      if (image.width > max || image.height > max) {
        if (image.width >= image.height) image.resize(max, Image.RESIZE_AUTO);
        else image.resize(Image.RESIZE_AUTO, max);
      }
      bytes = await image.encodeJPEG(82);
    } catch {
      if (buffer.byteLength > 2.5 * 1024 * 1024) throw new Error('Unsupported image');
      bytes = new Uint8Array(buffer);
      if (contentType.includes('png')) { mime = 'image/png'; ext = 'png'; }
      else if (contentType.includes('webp')) { mime = 'image/webp'; ext = 'webp'; }
      else if (contentType.includes('gif')) { mime = 'image/gif'; ext = 'gif'; }
    }

    const path = `${hash}.${ext}`;
    const { error } = await supabase.storage.from('link-previews').upload(path, bytes, {
      contentType: mime,
      upsert: true,
      cacheControl: '604800',
    });
    if (error) throw error;

    const { data } = supabase.storage.from('link-previews').getPublicUrl(path);
    return { path, publicUrl: data.publicUrl };
  } catch (error) {
    console.warn('preview image fallback:', String(error));
    return { path: null, publicUrl: null };
  }
}

function cleanTrackingUrl(raw: string): string {
  const url = new URL(raw);
  url.hash = '';
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  const keepForBooking = new Set(['checkin', 'checkout', 'group_adults', 'group_children', 'no_rooms', 'selected_currency']);

  for (const key of [...url.searchParams.keys()]) {
    const lower = key.toLowerCase();
    const tracking = lower.startsWith('utm_') || [
      'fbclid', 'gclid', 'yclid', 'aid', 'label', 'sid', 'srpvid', 'hpos', 'highlighted_blocks',
      'matching_block_id', 'all_sr_blocks', 'sb_price_type', 'sr_order', 'srepoch', 'dist', 'dest_id',
      'dest_type', 'type', 'ucfs', 'req_adults', 'req_children', 'room1',
    ].includes(lower);
    if (host.includes('booking.com')) {
      if (!keepForBooking.has(lower)) url.searchParams.delete(key);
    } else if (tracking) {
      url.searchParams.delete(key);
    }
  }
  return url.toString();
}

function getSiteIdentity(raw: string) {
  const url = new URL(raw);
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  const displayHost = host.split('.').slice(-2).join('.');

  if (host.includes('booking.com')) {
    const slug = url.pathname.match(/\/hotel\/[^/]+\/([^/.]+)/i)?.[1];
    const hotel = slug ? humanizeSlug(slug) : 'Отель на Booking.com';
    return {
      title: hotel,
      publisher: 'Booking.com',
      description: `${hotel} — фотографии, описание и информация о бронировании.`,
      isBooking: true,
    };
  }

  if (host.includes('yandex.') && url.pathname.includes('/maps')) {
    return { title: 'Место на карте', publisher: 'Яндекс Карты', description: 'Адрес, фотографии, отзывы и построение маршрута.', isBooking: false };
  }

  if (host.includes('maps.google.')) {
    return { title: 'Место на карте', publisher: 'Google Maps', description: 'Адрес, фотографии, отзывы и построение маршрута.', isBooking: false };
  }

  const pathName = decodeURIComponent(url.pathname).split('/').filter(Boolean).pop();
  return {
    title: pathName ? humanizeSlug(pathName.replace(/\.[a-z0-9]+$/i, '')) : displayHost,
    publisher: displayHost,
    description: `Открыть страницу на ${displayHost}`,
    isBooking: false,
  };
}

function extractBookingMetadata(html: string, baseUrl: string): ParsedMetadata {
  const title = cleanText(
    extractMeta(html, ['og:title', 'twitter:title'])
    || matchFirst(html, [/\"hotel_name\"\s*:\s*\"([^\"]+)\"/i, /data-hotel-name=\"([^\"]+)\"/i])
  );

  const description = cleanText(
    extractMeta(html, ['og:description', 'twitter:description', 'description'])
    || matchFirst(html, [/\"hotel_description\"\s*:\s*\"([^\"]{40,600})\"/i])
  );

  const publisher = 'Booking.com';
  const imageUrl = extractBookingImage(html, baseUrl);
  return { title, description, publisher, imageUrl };
}

function extractBookingImage(html: string, baseUrl: string): string | null {
  const candidates = [
    ...collectMatches(html, [
      /https?:\/\/(?:cf|q)-?bstatic\.com\/xdata\/images\/hotel\/max\d+x\d+\/[^\"'\s<>)]+/gi,
      /https?:\/\/(?:cf|q)-?bstatic\.com\/xdata\/images\/hotel\/\d+x\d+\/[^\"'\s<>)]+/gi,
      /https?:\/\/(?:cf|q)-?bstatic\.com\/images\/hotel\/max\d+x\d+\/[^\"'\s<>)]+/gi,
      /\"(?:hotel_main_photo_url|main_photo_url|max_photo_url|featured_photo_url)\"\s*:\s*\"([^\"]+)\"/gi,
      /data-atlas-lazy-image\s*=\s*\"([^\"]+)\"/gi,
      /data-thumb-url\s*=\s*\"([^\"]+)\"/gi,
      /srcset\s*=\s*\"([^\"]+)\"/gi,
    ]),
  ];

  for (let candidate of candidates) {
    if (!candidate) continue;
    candidate = decodeEntities(candidate)
      .replace(/\u002F/g, '/')
      .replace(/\\\//g, '/')
      .replace(/\u0026/g, '&')
      .trim();

    if (candidate.includes(',')) {
      for (const part of candidate.split(',')) {
        const url = part.trim().split(/\s+/)[0];
        const absolute = toAbsoluteUrl(url, baseUrl);
        if (absolute && /bstatic\.com/i.test(absolute) && !isWeakBookingImage(absolute)) return upgradeBookingImageUrl(absolute);
      }
      continue;
    }

    const absolute = toAbsoluteUrl(candidate, baseUrl);
    if (absolute && /bstatic\.com/i.test(absolute) && !isWeakBookingImage(absolute)) return upgradeBookingImageUrl(absolute);
  }
  return null;
}

function upgradeBookingImageUrl(url: string): string {
  return url
    .replace(/\/max\d+x\d+\//i, '/max1280x900/')
    .replace(/\/(\d+)x(\d+)\//i, '/max1280x900/');
}

function isWeakBookingImage(url: string | null | undefined): boolean {
  if (!url) return true;
  return /s\.wordpress\.com\/mshots|mshots\/v1|generating[-_ ]preview|placeholder|blank|spacer/i.test(url);
}

function collectMatches(html: string, patterns: RegExp[]): string[] {
  const results: string[] = [];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const value = match[1] || match[0];
      if (value) results.push(value);
    }
  }
  return unique(results);
}

function matchFirst(html: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeEntities(match[1]);
  }
  return null;
}

function screenshotFallbackUrl(url: string): string {
  return `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=1200`;
}

function getAttr(tag: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const quoted = tag.match(new RegExp(`${escaped}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'));
  if (quoted?.[2]) return quoted[2];
  const bare = tag.match(new RegExp(`${escaped}\\s*=\\s*([^\\s>]+)`, 'i'));
  return bare?.[1] || null;
}

function extractYouTubeVideoId(raw: string): string | null {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || null;
    if (host.endsWith('youtube.com')) {
      if (url.pathname === '/watch') return url.searchParams.get('v');
      const parts = url.pathname.split('/').filter(Boolean);
      if (['shorts', 'embed', 'live'].includes(parts[0])) return parts[1] || null;
    }
  } catch {
    return null;
  }
  return null;
}

function isValidPublicHttpUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    const host = url.hostname.toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.local')) return false;
    if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return false;
    if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) return false;
    return true;
  } catch {
    return false;
  }
}

function toAbsoluteUrl(value: string, base: string): string | null {
  try { return new URL(decodeEntities(value), base).toString(); }
  catch { return null; }
}

function humanizeSlug(value: string): string {
  const text = value.replace(/[-_+]+/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Ссылка';
}

function cleanText(value: string | null | undefined): string | null {
  if (!value) return null;
  return decodeEntities(stripTags(value)).replace(/\s+/g, ' ').trim() || null;
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ');
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

async function sha256Short(value: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash)).slice(0, 12).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)));
}
