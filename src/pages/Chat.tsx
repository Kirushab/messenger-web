import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { isOwnerEmail } from '@/lib/admin';
import { toast } from '@/stores/toastStore';
import { haptic } from '@/lib/haptics';
import { compressImage } from '@/lib/compress';
import { encryptMessage, decryptMessage, getChatPassword, setChatPassword, clearChatPassword, decryptFileFromUrl, decryptFilename, revokeDecryptedUrls, isChatRemembered } from '@/lib/crypto';

import { useChatStore } from '@/stores/chatStore';
import { useAudioStore } from '@/stores/audioStore';
import { useVideoStore, getVideoEl } from '@/stores/videoStore';
import { useCallStore, CallProvider } from '@/stores/callStore';
import CallJoinBar from '@/components/CallJoinBar';
import CallMessageCard from '@/components/CallMessageCard';
import { networkManager } from '@/lib/networkManager';
import { encodeMentionRefs, getMentionRefs, parseMentionContent, stripMentionTokens, type MentionRef } from '@/lib/mentions';
import { avatarColor, fmtTime, fmtDate, formatFileSize, isDesktop } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { MessageWithSender, FileAttachment, Reaction, StoryReplySnapshot } from '@/types';
import AdminStatusPanel from '@/components/AdminStatusPanel';
import AuctionCreator from '@/components/AuctionCreator';
import FormSheet from '@/components/FormSheet';
import AuctionCard from '@/components/AuctionCard';
import LocationMessage from '@/components/LocationMessage';
import ReadChecks from '@/components/ReadChecks';
import SwipeReplyRow from '@/components/SwipeReplyRow';
import LinkPreview, { extractUrl } from '@/components/LinkPreview';
import ZoomableImage from '@/components/ZoomableImage';
import { useAuctionStore } from '@/stores/auctionStore';
import TinderBetCard from '@/components/TinderBetCard';
import CreateTinderBetSheet from '@/components/CreateTinderBetSheet';
import EventCard from '@/components/EventCard';
import ChessInviteCard from '@/components/ChessInviteCard';
import EventSharePane from '@/components/EventSharePane';
import TinderWidget from '@/components/TinderWidget';
import EphemeralSlider from '@/components/EphemeralSlider';
import { SkeletonWidgetCard } from '@/components/Skeleton';
import { createLocalMediaPreview, revokeLocalMediaPreview, type LocalMediaPreview } from '@/lib/mediaPreview';


const INLINE_HTTP_URL_RE = /https?:\/\/[^\s<>]+/gi;

function StoryReplyPreview({ snapshot, mine }: { snapshot: StoryReplySnapshot; mine: boolean }) {
  const [mediaFailed, setMediaFailed] = useState(false);
  const displayUrl = snapshot.preview_url || snapshot.media_url;
  const hasMedia = !!displayUrl && !mediaFailed;
  const displayIsImage = !!snapshot.preview_url || snapshot.media_type === 'image';
  return (
    <div className={'chat-story-reply' + (mine ? ' mine' : '')}>
      <div className="chat-story-reply-media">
        {hasMedia ? (
          displayIsImage
            ? <img src={displayUrl!} alt="" loading="lazy" onError={() => setMediaFailed(true)} />
            : <video src={displayUrl!} muted playsInline preload="metadata" onError={() => setMediaFailed(true)} />
        ) : (
          <div className="chat-story-reply-missing" aria-label="История недоступна">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="4"/><path d="m7 15 3-3 2.2 2.2 2.8-3.2 2 2.3"/></svg>
          </div>
        )}
        {hasMedia && snapshot.media_type === 'video' && (
          <span className="chat-story-reply-play"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="m9 7 8 5-8 5V7Z"/></svg></span>
        )}
      </div>
      <div className="chat-story-reply-copy">
        <span className="chat-story-reply-kicker">Комментарий к истории</span>
        <b>{snapshot.author_name || 'История'}</b>
        <small>{snapshot.caption?.trim() || (mediaFailed ? 'История больше недоступна' : 'Ответ на историю')}</small>
      </div>
    </div>
  );
}

function cleanInlineUrl(raw: string): string {
  return raw
    .replace(/[.,!?;:'"»”’]+$/g, '')
    .replace(/[)\]}>]+$/g, '');
}

function compactInlineUrlLabel(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.replace(/^www\./, '');
    let path = decodeURIComponent(parsed.pathname || '/').replace(/\/+$/, '');
    if (!path || path === '/') path = '';
    const visible = `${host}${path}`;
    return visible.length > 68 ? `${visible.slice(0, 65)}…` : visible;
  } catch {
    return rawUrl.length > 68 ? `${rawUrl.slice(0, 65)}…` : rawUrl;
  }
}

function MessageContextPortal({
  messageId,
  mine,
  anchorId,
  className = '',
  children,
}: {
  messageId: string;
  mine: boolean;
  anchorId?: string;
  className?: string;
  children: any;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, ready: false, origin: 'top right' });

  const updatePosition = useCallback(() => {
    const menu = menuRef.current;
    const anchor = document.getElementById(anchorId || `msg-${messageId}`);
    if (!menu || !anchor) return;

    const anchorRect = anchor.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportTop = (viewport?.offsetTop || 0) + 10;
    const viewportLeft = (viewport?.offsetLeft || 0) + 10;
    const viewportBottom = (viewport?.offsetTop || 0) + (viewport?.height || window.innerHeight) - 10;
    const viewportRight = (viewport?.offsetLeft || 0) + (viewport?.width || window.innerWidth) - 10;
    const menuWidth = Math.max(212, menu.offsetWidth || 212);
    const menuHeight = Math.max(1, menu.offsetHeight || 1);
    const gap = 8;

    const aboveTop = anchorRect.top - menuHeight - gap;
    const belowTop = anchorRect.bottom + gap;
    let top: number;
    let origin: string;

    if (aboveTop >= viewportTop) {
      top = aboveTop;
      origin = mine ? 'bottom right' : 'bottom left';
    } else if (belowTop + menuHeight <= viewportBottom) {
      top = belowTop;
      origin = mine ? 'top right' : 'top left';
    } else {
      // У больших виджетов меню может не помещаться ни сверху, ни снизу.
      // В таком случае закрепляем его внутри видимой области, не двигая сообщение.
      top = Math.min(Math.max(anchorRect.top, viewportTop), Math.max(viewportTop, viewportBottom - menuHeight));
      origin = mine ? 'top right' : 'top left';
    }

    const preferredLeft = mine ? anchorRect.right - menuWidth : anchorRect.left;
    const left = Math.min(Math.max(preferredLeft, viewportLeft), Math.max(viewportLeft, viewportRight - menuWidth));

    setPosition({ top, left, ready: true, origin });
  }, [anchorId, messageId, mine]);

  useLayoutEffect(() => {
    updatePosition();
    const raf = requestAnimationFrame(updatePosition);
    const settle = window.setTimeout(updatePosition, 50);
    const viewport = window.visualViewport;
    window.addEventListener('resize', updatePosition);
    window.addEventListener('orientationchange', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    viewport?.addEventListener('resize', updatePosition);
    viewport?.addEventListener('scroll', updatePosition);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(settle);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('orientationchange', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      viewport?.removeEventListener('resize', updatePosition);
      viewport?.removeEventListener('scroll', updatePosition);
    };
  }, [updatePosition]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      ref={menuRef}
      className={`ctx-menu ctx-menu-portal ${className}`.trim()}
      style={{
        top: position.top,
        left: position.left,
        visibility: position.ready ? 'visible' : 'hidden',
        transformOrigin: position.origin,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}

const MAX_FILE = 50*1024*1024;
const EMOJI_PICKER_SET = ['😀','😂','🥰','😍','😎','🤔','😴','😭','🥺','😡','👍','👎','❤️','🔥','💯','🎉','👀','💪','🙏','✨','⭐','💔','😈','🤡','💀','👻','🤖','🎁','🍕','☕','🌙','☀️','🌈','⚡','💫','💕','🤝','👋','🙈','🤯'];
const EMOJIS = ['❤️','👍','😂','😮','😢','🔥'];

// Превью для reply-цитат — красивая подпись вместо raw content (геолокация → 📍, опросы и т.д.)
// SVG icons for media types — used in reply preview (cleaner than emoji)
const IconCamera = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,verticalAlign:'-2px',marginRight:4}}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>;
const IconVideo = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,verticalAlign:'-2px',marginRight:4}}><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>;
const IconMic = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,verticalAlign:'-2px',marginRight:4}}><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>;
const IconPin = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,verticalAlign:'-2px',marginRight:4}}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const IconChart = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,verticalAlign:'-2px',marginRight:4}}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
const IconPaperclip = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,verticalAlign:'-2px',marginRight:4}}><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>;

function msgPreview(m: any, decryptedContent?: string): React.ReactNode {
  if (!m) return '';
  if (m.is_encrypted && decryptedContent) return decryptedContent.substring(0, 60);
  if (m.type === 'location') return <><IconPin />Геолокация</>;
  if (m.type === 'poll') return <><IconChart />Опрос</>;
  if (m.type === 'voice') return <><IconMic />Голосовое сообщение</>;
  if (m.type === 'album') return <><IconCamera />Альбом</>;
  if (m.type === 'call') return 'Звонок';
  if (m.type === 'system') return m.content?.substring(0, 60) || '';
  // По attachments
  const att = m.attachments?.[0];
  if (att) {
    if (att.file_name?.startsWith('videonote_')) return <><IconVideo />Видеосообщение</>;
    if (att.file_name?.startsWith('voice_')) return <><IconMic />Голосовое сообщение</>;
    if (att.mime_type?.startsWith('image/')) return <><IconCamera />Фото</>;
    if (att.mime_type?.startsWith('video/')) return <><IconVideo />Видео</>;
    if (att.mime_type?.startsWith('audio/')) return <><IconMic />Аудио</>;
    return <><IconPaperclip />{att.file_name || 'Файл'}</>;
  }
  return stripMentionTokens(m.content || '').substring(0, 60);
}

// Элемент голосового во вкладке профиля: имя · длительность · дата + зелёный play
function VoiceProfileItem({ url, name, dateStr, msgId }: { url: string; name: string; dateStr: string; msgId: string }) {
  const [dur, setDur] = useState(0);
  useEffect(() => {
    const a = new Audio();
    a.preload = 'metadata';
    const onMeta = () => { if (isFinite(a.duration)) setDur(a.duration); };
    a.addEventListener('loadedmetadata', onMeta);
    a.src = url;
    return () => { a.removeEventListener('loadedmetadata', onMeta); a.src = ''; };
  }, [url]);
  const fmtDur = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  return (
    <div
      onClick={() => { useVideoStore.getState().pause(); useAudioStore.getState().play(url, msgId, name); }}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer' }}
    >
      <div style={{ width: 46, height: 46, borderRadius: 23, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><polygon points="6,4 20,12 6,20" /></svg>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
        <div style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', marginTop: 2 }}>{dur ? fmtDur(dur) + ' · ' : ''}{dateStr}</div>
      </div>
    </div>
  );
}


const voiceDurationCache = new Map<string, number>();

function VoiceMessageAttachment({
  url,
  msgId,
  title,
  mine,
}: {
  url: string;
  msgId: string;
  title: string;
  mine: boolean;
}) {
  const [metadataDuration, setMetadataDuration] = useState(() => voiceDurationCache.get(url) || 0);
  const isCurrent = useAudioStore(s => s.current?.msgId === msgId);
  const isPlaying = useAudioStore(s => s.current?.msgId === msgId ? s.isPlaying : false);
  const progress = useAudioStore(s => s.current?.msgId === msgId ? s.progress : 0);
  const rate = useAudioStore(s => s.current?.msgId === msgId ? s.rate : 1);
  const currentTime = useAudioStore(s => s.current?.msgId === msgId ? s.currentTime : 0);
  const storeDuration = useAudioStore(s => s.current?.msgId === msgId ? s.duration : 0);

  useEffect(() => {
    const cached = voiceDurationCache.get(url);
    if (cached) {
      setMetadataDuration(cached);
      return;
    }

    const audio = new Audio();
    audio.preload = 'metadata';
    const commitDuration = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        voiceDurationCache.set(url, audio.duration);
        setMetadataDuration(audio.duration);
      }
    };
    audio.addEventListener('loadedmetadata', commitDuration);
    audio.addEventListener('durationchange', commitDuration);
    audio.src = url;
    try { audio.load(); } catch { /* browser may load metadata lazily */ }

    return () => {
      audio.removeEventListener('loadedmetadata', commitDuration);
      audio.removeEventListener('durationchange', commitDuration);
      audio.src = '';
    };
  }, [url]);

  const bars = useMemo(
    () => Array.from({ length: 24 }, (_, i) => 4 + ((msgId.charCodeAt(i % msgId.length) + i * 7) % 18)),
    [msgId],
  );
  const playedCount = Math.floor(progress * bars.length);
  const totalDuration = storeDuration || metadataDuration;
  const fmt = (seconds: number) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
  const currentLabel = isCurrent ? fmt(currentTime) : '0:00';
  const totalLabel = totalDuration ? fmt(totalDuration) : '--:--';

  const playVoice = () => {
    useVideoStore.getState().pause();
    useAudioStore.getState().play(url, msgId, title);
  };

  const handleSeek = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const target = e.currentTarget as HTMLDivElement;
    const rect = target.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    if (isCurrent) {
      useAudioStore.getState().seekRatio(ratio);
    } else {
      playVoice();
      window.setTimeout(() => useAudioStore.getState().seekRatio(ratio), 120);
    }
  };

  return (
    <div className={'voice-att' + (mine ? ' mine' : '')}>
      <button
        className="voice-play-btn"
        onClick={(e) => { e.stopPropagation(); playVoice(); }}
        aria-label={isPlaying ? 'Пауза' : 'Играть'}
      >
        {isPlaying
          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="6,4 20,12 6,20"/></svg>}
      </button>
      <div className="voice-mid">
        <div
          className="voice-bars"
          onClick={handleSeek}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={handleSeek}
        >
          {bars.map((height, index) => (
            <div
              key={index}
              className="bar"
              style={{
                height,
                background: index < playedCount
                  ? 'var(--msg-recv-text)'
                  : 'color-mix(in srgb, var(--msg-recv-text) 30%, transparent)',
                transition: 'background 200ms ease',
                pointerEvents: 'none',
              }}
            />
          ))}
        </div>
        <div className="voice-meta">
          <span className="voice-dur">{currentLabel} / {totalLabel}</span>
          <button
            className="voice-speed"
            onClick={(e) => { e.stopPropagation(); useAudioStore.getState().cycleRate(); }}
            aria-label="Скорость воспроизведения"
            aria-hidden={!isCurrent}
            tabIndex={isCurrent ? 0 : -1}
            style={{ visibility: isCurrent ? 'visible' : 'hidden' }}
          >
            {rate === 1 ? '1x' : rate === 1.5 ? '1.5x' : '2x'}
          </button>
        </div>
      </div>
    </div>
  );
}

let mediaRecorder: MediaRecorder|null = null;
let audioChunks: Blob[] = [];
let analyserRef: AnalyserNode|null = null;

// Кэш aspect ratio видео по URL — переживает повторные mount/unmount
const videoAspectCache = new Map<string, number>();
// Кэш aspect ratio изображений по URL — fixes layout-shift при загрузке
const imageAspectCache = new Map<string, number>();

// Единые размеры превью и их плейсхолдеров. Значения используются и в
// загруженном контенте, и в skeleton-блоках, чтобы swap не менял геометрию чата.
const CHAT_MEDIA_METRICS = {
  videoNote: 220,
  imageWidth: 220,
  imageRatio: 4 / 3,
  videoSize: 240,
  albumWidth: 280,
  voiceWidth: 220,
  voiceHeight: 48,
  fileWidth: 240,
  fileHeight: 48,
  pollWidth: 240,
  pollMinHeight: 164,
} as const;


type PendingAttachmentKind = 'videonote' | 'voice' | 'image' | 'video' | 'album' | 'file';

function isVideoNoteFileName(value?: string | null): boolean {
  return /^videonote_[^/]+\.(?:mp4|mov|m4v|webm)$/i.test(String(value || '').trim());
}

function isVoiceFileName(value?: string | null): boolean {
  return /^voice_[^/]+\.(?:webm|ogg|opus|m4a|mp3)$/i.test(String(value || '').trim());
}

function inferPendingAttachment(message: MessageWithSender): PendingAttachmentKind | null {
  if (message.attachments?.length) return null;
  const content = String(message.content || '').trim();
  if (isVideoNoteFileName(content)) return 'videonote';
  if (message.type === 'voice' || isVoiceFileName(content)) return 'voice';
  if (String(message.type) === 'album') return 'album';
  if (message.type === 'image' || /\.(?:jpe?g|png|webp|gif|heic)$/i.test(content)) return 'image';
  if (/\.(?:mp4|mov|m4v|webm)$/i.test(content)) return 'video';
  if (message.type === 'file') return 'file';
  return null;
}

function PendingAttachmentPlaceholder({ kind, albumCount = 2 }: { kind: PendingAttachmentKind; albumCount?: number }) {
  if (kind === 'videonote') {
    return (
      <div className="pending-videonote skeleton-shimmer" aria-label="Видеосообщение загружается">
        <span className="pending-videonote-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polygon points="10,8 17,12 10,16" fill="currentColor" stroke="none"/></svg>
        </span>
      </div>
    );
  }
  if (kind === 'voice') {
    return (
      <div className="pending-voice">
        <div className="pending-voice-play skeleton-shimmer" />
        <div className="pending-voice-wave skeleton-shimmer" />
      </div>
    );
  }
  if (kind === 'image') return <div className="pending-chat-image skeleton-shimmer" aria-label="Фото загружается" />;
  if (kind === 'album') {
    const count = Math.max(2, Math.min(10, albumCount || 2));
    const cols = count <= 5 ? 2 : 3;
    const spanLast = count === 3 || count === 5 || (count >= 7 && count % 3 !== 0);
    return (
      <div className="pending-chat-album" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }} aria-label="Альбом загружается">
        {Array.from({ length: count }).map((_, index) => (
          <span key={index} className="skeleton-shimmer" style={{ gridColumn: spanLast && index === count - 1 ? `span ${cols}` : undefined }} />
        ))}
      </div>
    );
  }
  if (kind === 'video') return <div className="pending-chat-video skeleton-shimmer" aria-label="Видео загружается" />;
  return (
    <div className="pending-file">
      <div className="pending-file-icon skeleton-shimmer" />
      <div className="pending-file-lines"><span className="skeleton-shimmer"/><span className="skeleton-shimmer"/></div>
    </div>
  );
}

// Стабильный <img> для чата: использует aspect-ratio для предотвращения layout-shift
function ChatImage({ src, onClick, onMediaLoad, w, h }: { src: string; onClick: () => void; onMediaLoad?: () => void; w?: number | null; h?: number | null }) {
  const clampImageRatio = (value?: number | null) => {
    if (!value || !Number.isFinite(value)) return CHAT_MEDIA_METRICS.imageRatio;
    return Math.min(1.8, Math.max(0.56, value));
  };
  const [loaded, setLoaded] = useState(false);
  const [ratio, setRatio] = useState(() => clampImageRatio((w && h) ? w / h : imageAspectCache.get(src)));

  useEffect(() => {
    setRatio(clampImageRatio((w && h) ? w / h : imageAspectCache.get(src)));
  }, [src, w, h]);

  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      const nextRatio = img.naturalWidth / img.naturalHeight;
      imageAspectCache.set(src, nextRatio);
      setRatio(clampImageRatio(nextRatio));
    }
    setLoaded(true);
    requestAnimationFrame(() => onMediaLoad?.());
  };

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        position: 'relative',
        width: CHAT_MEDIA_METRICS.imageWidth,
        maxWidth: '70vw',
        aspectRatio: `${ratio}`,
        borderRadius: 14,
        overflow: 'hidden',
        cursor: 'pointer',
        background: 'transparent',
      }}
    >
      {!loaded && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(90deg, rgba(127,127,127,0.04) 0%, rgba(127,127,127,0.12) 50%, rgba(127,127,127,0.04) 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.4s ease-in-out infinite',
        }} />
      )}
      <img
        src={src}
        alt=""
        onLoad={onLoad}
        className="chat-image-fade"
        style={{
          width: '100%', height: '100%',
          objectFit: 'cover',
          display: 'block',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.2s ease',
        }}
      />
    </div>
  );
}

// Adaptive video player — Telegram-style: autoplay muted loop, tap → fullscreen with sound
function VideoPlayer({ src, time, isMine, isRead, inGrid = false, onMediaLoad, w, h }: { src: string; time?: string; isMine?: boolean; isRead?: boolean; inGrid?: boolean; onMediaLoad?: () => void; w?: number | null; h?: number | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const clampVideoRatio = (value?: number | null) => {
    if (!value || !Number.isFinite(value)) return 1;
    return Math.min(1.9, Math.max(0.56, value));
  };
  const [videoRatio, setVideoRatio] = useState(() => clampVideoRatio((w && h) ? w / h : videoAspectCache.get(src)));

  useEffect(() => {
    setVideoRatio(clampVideoRatio((w && h) ? w / h : videoAspectCache.get(src)));
  }, [src, w, h]);

  const onLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.videoWidth && v.videoHeight) {
      const ratio = v.videoWidth / v.videoHeight;
      videoAspectCache.set(src, ratio);
      setVideoRatio(clampVideoRatio(ratio));
    }
    requestAnimationFrame(() => onMediaLoad?.());
    v.play().catch(() => {});
  };

  // Re-trigger play on mount + when src changes
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => {});
  }, [src]);

  const openFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    // Включаем sound и controls, запускаем native fullscreen
    v.muted = false;
    v.controls = true;
    try {
      if ((v as any).webkitEnterFullscreen) {
        (v as any).webkitEnterFullscreen();
      } else if (v.requestFullscreen) {
        v.requestFullscreen().catch(() => {});
      }
      v.play().catch(() => {});
    } catch {}
    // Когда выходит из fullscreen — обратно muted + без controls + продолжаем loop
    const onExit = () => {
      v.controls = false;
      v.muted = true;
      v.play().catch(() => {});
      document.removeEventListener('fullscreenchange', onExit);
      v.removeEventListener('webkitendfullscreen', onExit);
    };
    document.addEventListener('fullscreenchange', onExit);
    v.addEventListener('webkitendfullscreen', onExit);
  };

  // В сетке альбома видео занимает весь cell. Одиночное видео сохраняет
  // реальное соотношение сторон: вертикальное, горизонтальное или квадратное.
  const wrapStyle: React.CSSProperties = inGrid
    ? { width: '100%', height: '100%' }
    : { width: CHAT_MEDIA_METRICS.videoSize, maxWidth: '70vw', aspectRatio: `${videoRatio}` };

  return (
    <div
      onClick={openFullscreen}
      style={{
        ...wrapStyle,
        position: 'relative',
        borderRadius: inGrid ? 0 : 14,
        overflow: 'hidden',
        cursor: 'pointer',
        background: '#000',
      }}
    >
      <div className="video-skeleton" style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(90deg, #222 0%, #333 50%, #222 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s ease-in-out infinite',
        zIndex: 0,
      }} />
      <video
        ref={videoRef}
        src={src}
        playsInline
        muted
        autoPlay
        loop
        preload="auto"
        onLoadedMetadata={onLoadedMetadata}
        style={inGrid
          ? { width: '100%', height: '100%', objectFit: 'cover', display: 'block', position: 'relative', zIndex: 1 }
          : { width: '100%', height: '100%', objectFit: 'cover', display: 'block', position: 'relative', zIndex: 1 }
        }
      />
      {/* Время полупрозрачно в правом нижнем углу */}
      {time && !inGrid && (
        <div style={{
          position: 'absolute', right: 8, bottom: 6,
          background: 'rgba(0,0,0,0.45)',
          color: '#fff', fontSize: 'var(--fs-micro)',
          padding: '2px 7px', borderRadius: 10,
          display: 'flex', alignItems: 'center', gap: 4,
          pointerEvents: 'none',
        }}>
          {time}
          {isMine && <ReadChecks read={!!isRead} size={11} readColor="#4FC3F7" />}
        </div>
      )}
    </div>
  );
}

// Авто-подписи вложений — их не показываем как пользовательскую подпись
function isMediaAutoLabel(c: string): boolean {
  const value = String(c || '').trim();
  return /^(?:📷 )?Фото$/.test(value) || /^(?:🎤 )?Голосовое(?: сообщение)?$/.test(value) || /^🎤 /.test(value) || /^📎 /.test(value) || /^📸 \d+ (фото|видео|медиа)$/.test(value) || isVideoNoteFileName(value) || isVoiceFileName(value);
}

// «Только эмодзи» (1-3 штуки) → рисуем крупно, как в Telegram
function emojiOnlyCount(text: string): number {
  const t = (text || '').trim();
  if (!t) return 0;
  const onlyEmoji = /^[\p{Extended_Pictographic}\u200D\uFE0F\u{1F3FB}-\u{1F3FF}\s]+$/u.test(t);
  if (!onlyEmoji) return 0;
  try {
    if (typeof (Intl as any).Segmenter === 'function') {
      const seg = new (Intl as any).Segmenter('ru', { granularity: 'grapheme' });
      let n = 0;
      for (const s of seg.segment(t)) if (/\p{Extended_Pictographic}/u.test(s.segment)) n++;
      return n;
    }
  } catch { /* noop */ }
  return (t.match(/\p{Extended_Pictographic}/gu) || []).length;
}


const PROFILE_TABS = ['media', 'voice', 'files', 'links'] as const;
type ProfileTab = typeof PROFILE_TABS[number];

// Telegram-style round video — три состояния + PiP:
//  muted    — беззвучный автоплей превью (свой <video>) пока в зоне видимости;
//  sound    — тап: звук + увеличение + кольцо/тайминги (играет ГЛОБАЛЬНЫЙ <video>);
//  controls — ещё тап: круговая перемотка + кнопка паузы.
//  PiP: активный (sound/controls) при уходе с экрана отцепляется в плавающий угол
//       (тот же глобальный <video> переносится), при возврате — прицепляется обратно.
function VideoNote({ src, msgId, title = '', mine = false }: { src: string; msgId: string; title?: string; mine?: boolean }) {
  const ownRef = useRef<HTMLVideoElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [previewDur, setPreviewDur] = useState(0);
  const [activeVideoReady, setActiveVideoReady] = useState(false);
  const seekingRef = useRef(false);

  const current = useVideoStore(s => s.current);
  const isActive = current?.msgId === msgId;
  const isPlaying = useVideoStore(s => s.isPlaying);
  const progress = useVideoStore(s => s.progress);
  const currentTime = useVideoStore(s => s.currentTime);
  const duration = useVideoStore(s => s.duration);
  const inlineVisible = useVideoStore(s => s.inlineVisible);
  const enlarged = isActive && inlineVisible;

  const fmtT = (value: number) => {
    const safe = Number.isFinite(value) && value > 0 ? value : 0;
    return `${Math.floor(safe / 60)}:${Math.floor(safe % 60).toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const checkVisibility = () => {
      const rect = root.getBoundingClientRect();
      const visible = rect.bottom > 24 && rect.top < window.innerHeight - 24 && rect.right > 24 && rect.left < window.innerWidth - 24;
      setInView(visible);
      if (useVideoStore.getState().current?.msgId === msgId) {
        useVideoStore.getState().setInlineVisible(visible);
      }
    };
    const observer = new IntersectionObserver(checkVisibility, { threshold: [0, 0.01, 0.25, 0.75] });
    observer.observe(root);
    window.addEventListener('scroll', checkVisibility, true);
    window.addEventListener('resize', checkVisibility);
    checkVisibility();
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', checkVisibility, true);
      window.removeEventListener('resize', checkVisibility);
    };
  }, [msgId]);

  useEffect(() => {
    const preview = ownRef.current;
    if (!preview) return;
    preview.muted = true;
    preview.loop = true;
    if (inView && !isActive) preview.play().catch(() => {});
    else preview.pause();
  }, [inView, isActive]);

  useEffect(() => {
    if (!enlarged || !mountRef.current) return;
    const video = getVideoEl();
    video.className = 'vnote-inline-video';
    setActiveVideoReady(video.readyState >= 2);
    const onReady = () => setActiveVideoReady(true);
    video.addEventListener('loadeddata', onReady, { once: true });
    video.addEventListener('canplay', onReady, { once: true });
    if (video.parentElement !== mountRef.current) mountRef.current.appendChild(video);
    if (useVideoStore.getState().isPlaying && video.paused) video.play().catch(() => {});
    return () => {
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('canplay', onReady);
    };
  }, [enlarged]);

  useEffect(() => () => {
    if (useVideoStore.getState().current?.msgId === msgId) {
      useVideoStore.getState().setInlineVisible(false);
    }
  }, [msgId]);

  useEffect(() => {
    if (!isActive) { setShowControls(false); setActiveVideoReady(false); }
  }, [isActive]);

  const BASE = CHAT_MEDIA_METRICS.videoNote;
  const LARGE = Math.min(window.innerWidth * 0.64, 260);
  const SIZE = enlarged ? LARGE : BASE;
  const C = 2 * Math.PI * 106;
  const theta = progress * 2 * Math.PI;
  const handleX = 110 + 106 * Math.sin(theta);
  const handleY = 110 - 106 * Math.cos(theta);

  const activate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isActive) {
      useAudioStore.getState().stop();
      useVideoStore.getState().play(src, msgId, title);
      useVideoStore.getState().setInlineVisible(true);
      setShowControls(false);
      return;
    }
    setShowControls(value => !value);
  };

  const seekFromPoint = (clientX: number, clientY: number) => {
    const element = rootRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    if (Math.hypot(dx, dy) < rect.width * 0.3) return;
    let ratio = Math.atan2(dx, -dy) / (2 * Math.PI);
    if (ratio < 0) ratio += 1;
    useVideoStore.getState().seekRatio(ratio);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!showControls || !enlarged) return;
    seekingRef.current = true;
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* noop */ }
    seekFromPoint(e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (seekingRef.current && showControls && enlarged) seekFromPoint(e.clientX, e.clientY);
  };
  const onPointerUp = () => { seekingRef.current = false; };
  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    useVideoStore.getState().toggle();
  };

  return (
    <div
      ref={rootRef}
      className={'vnote-inline' + (enlarged ? ' expanded' : '') + (mine ? ' mine' : ' other')}
      onClick={activate}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        transformOrigin: mine ? 'right center' : 'left center',
        touchAction: showControls && enlarged ? 'none' : 'pan-y',
      }}
    >
      <video
        ref={ownRef}
        src={src}
        playsInline
        muted
        preload="metadata"
        onLoadedMetadata={e => setPreviewDur((e.target as HTMLVideoElement).duration || 0)}
        className="vnote-inline-preview"
        style={{ opacity: isActive && activeVideoReady ? 0 : 1 }}
      />
      <div ref={mountRef} className="vnote-inline-mount" style={{ opacity: enlarged && activeVideoReady ? 1 : 0 }} />

      {!isActive && (
        <>
          <div className="vnote-preview-sound" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4z" /><path d="m22 9-6 6M16 9l6 6" /></svg>
          </div>
          {previewDur > 0 && <div className="vnote-preview-duration">{fmtT(previewDur)}</div>}
        </>
      )}

      {enlarged && (
        <>
          <svg viewBox="0 0 220 220" className="vnote-inline-ring" aria-hidden="true">
            <circle cx="110" cy="110" r="106" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
            <circle cx="110" cy="110" r="106" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - progress)} transform="rotate(-90 110 110)" />
            {showControls && <circle cx={handleX} cy={handleY} r="9" fill="#fff" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />}
          </svg>
          {showControls && (
            <button className="vnote-inline-play" onClick={togglePlay} aria-label={isPlaying ? 'Пауза' : 'Играть'}>
              {isPlaying
                ? <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                : <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff"><polygon points="7,4 20,12 7,20" /></svg>}
            </button>
          )}
          <div className="vnote-inline-time left">{fmtT(currentTime)}</div>
          <div className="vnote-inline-time right">{fmtT(duration)}</div>
        </>
      )}
    </div>
  );
}

// Album grid — Telegram-style media composition. Поддерживает 2-10 элементов.
// Layout: 2 → 2col, 3 → 2col (последний на всю ширину), 4 → 2x2, 5 → 2+3, 6+ → 3col
function MediaGrid({
  items,
  onImageClick,
}: {
  items: Array<{ id: string; file_url: string; mime_type: string; file_name: string }>;
  onImageClick: (url: string) => void;
}) {
  const n = items.length;
  // Telegram-подобный layout
  const layout: { cols: number; spanLast: boolean } = (() => {
    if (n === 2) return { cols: 2, spanLast: false };
    if (n === 3) return { cols: 2, spanLast: true };
    if (n === 4) return { cols: 2, spanLast: false };
    if (n === 5) return { cols: 2, spanLast: true };
    if (n === 6) return { cols: 3, spanLast: false };
    return { cols: 3, spanLast: n % 3 !== 0 }; // 7,8,10
  })();

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
      gap: 2,
      width: CHAT_MEDIA_METRICS.albumWidth,
      maxWidth: '70vw',
      borderRadius: 14,
      overflow: 'hidden',
      lineHeight: 0,
    }}>
      {items.map((a, i) => {
        const isLast = i === n - 1;
        const span = layout.spanLast && isLast;
        const cellStyle: React.CSSProperties = {
          position: 'relative',
          aspectRatio: '1 / 1',
          overflow: 'hidden',
          background: '#000',
          gridColumn: span ? `span ${layout.cols}` : undefined,
        };
        const isVideo = a.mime_type?.startsWith('video/') || /\.(mp4|mov|webm|m4v|avi)$/i.test(a.file_name || '');
        if (isVideo) {
          return (
            <div key={a.id} style={cellStyle}>
              <VideoPlayer src={a.file_url} inGrid />
            </div>
          );
        }
        // Image
        return (
          <img
            key={a.id}
            src={a.file_url}
            alt=""
            onClick={e => { e.stopPropagation(); onImageClick(a.file_url); }}
            style={{ ...cellStyle, width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer', display: 'block' }}
          />
        );
      })}
    </div>
  );
}


export default function Chat() {
  const { id } = useParams<{id:string}>();
  const nav = useNavigate();
  const { user } = useAuthStore();
  const {
    currentMessages, loadingMessages, uploadProgress, typingUsers, memberReadTimes,
    fetchMessages, sendMessage, sendWidgetMessage, retrySend, sendFileMessage, sendAlbumMessage, deleteMessage,
    subscribeToMessages, subscribeToTyping, sendTyping, fetchReadReceipts,
    conversations, addGroupMember, removeGroupMember, leaveGroup, deleteGroup, renameGroup,
    searchUsers, fetchConversations, toggleReaction, fetchReactions, pinMessage,
    pinnedIds, fetchPinned, togglePinMessage,
    blockedIds, fetchBlocked, blockUser, unblockUser,
    loadOlderMessages, hasMoreOlder, loadingOlder,
    sendLocation, fetchMediaGallery, createPoll, votePoll, fetchPoll, updateLastSeen,
  } = useChatStore();
  const { startCall, startGroupCall, peerReady, hmsReady, setProvider } = useCallStore();

  // Conversation must be resolved before any hook dependencies or render logic use it.
  // Keeping this declaration below the attachment effects caused a real TDZ crash in
  // production (minified as "Cannot access 'l' before initialization") when opening a chat.
  const conv = conversations.find(c => c.id === id);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showCallPicker, setShowCallPicker] = useState<'audio'|'video'|null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingStarting, setRecordingStarting] = useState(false);
  const [recDur, setRecDur] = useState(0);
  const [recBars, setRecBars] = useState<number[]>([]);
  const [recLevel, setRecLevel] = useState(0);
  // Голосовые играют через глобальный audioStore (фон: не прерывается при скролле/смене чата)
  const [preview, setPreview] = useState<string|null>(null);
  const [lbDir, setLbDir] = useState<0|1|-1>(0); // направление листания лайтбокса (для анимации)
  // Список всех URL фото в чате — для свайпа prev/next в просмотрщике.
  // Вычисляется memo-ом от currentMessages.
  const photoUrls = useMemo(() => {
    const urls: string[] = [];
    for (const m of currentMessages) {
      if (!m.attachments?.length) continue;
      for (const a of m.attachments as any[]) {
        if (a.mime_type?.startsWith('image/') && a.file_url) urls.push(a.file_url);
      }
    }
    return urls;
  }, [currentMessages]);
  const currentPhotoIdx = preview ? photoUrls.indexOf(preview) : -1;
  const gotoPhoto = (delta: number) => {
    if (currentPhotoIdx < 0) return;
    const next = currentPhotoIdx + delta;
    if (next >= 0 && next < photoUrls.length) { setLbDir(delta > 0 ? 1 : -1); setPreview(photoUrls[next]); }
  };
  const [replyTo, setReplyTo] = useState<MessageWithSender|null>(null);
  const [contextMsg, setContextMsg] = useState<string|null>(null);
  const [forwardMsgs, setForwardMsgs] = useState<MessageWithSender[]|null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [memberMenu, setMemberMenu] = useState<string|null>(null);
  const [addMemberQuery, setAddMemberQuery] = useState('');
  const [addMemberResults, setAddMemberResults] = useState<any[]>([]);
  const [editingName, setEditingName] = useState(false);
  const [groupTab, setGroupTab] = useState<'media'|'files'|'links'>('media');
  const [newGroupName, setNewGroupName] = useState('');
  const [showEmojiFor, setShowEmojiFor] = useState<string|null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<string|null>(null);
  const [reactionDetailsFor, setReactionDetailsFor] = useState<string|null>(null);
  const [readByFor, setReadByFor] = useState<string|null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [searchIdx, setSearchIdx] = useState(0);
  const [pinnedActiveIdx, setPinnedActiveIdx] = useState(0);
  const [reactions, setReactions] = useState<Record<string,Reaction[]>>({});
  const reactionsRef = useRef<Record<string, Reaction[]>>({});
  const reactionQueueRef = useRef<Record<string, Promise<void>>>({});
  const reactionVersionRef = useRef<Record<string, number>>({});
  const [reactionMotionVersions, setReactionMotionVersions] = useState<Record<string, number>>({});
  const [showGallery, setShowGallery] = useState(false);
  const [gallery, setGallery] = useState<FileAttachment[]>([]);
  const [profileFileMenu, setProfileFileMenu] = useState<FileAttachment | null>(null);
  const [showPollCreate, setShowPollCreate] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [attachClosing, setAttachClosing] = useState(false);
  const closeAttach = () => {
    setAttachClosing(true);
    setAttachDragging(false);
    setTimeout(() => {
      setShowAttachMenu(false);
      setAttachClosing(false);
      setAttachDragY(0);
      attachDragYRef.current = 0;
      attachDragRef.current = false;
    }, 320);
  };
  // Черновик вложений: превью с подписью перед отправкой (как в Telegram)
  const [attachDraft, setAttachDraft] = useState<{ files: File[]; kind: 'media'|'file'; hd: boolean } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string|null>(null);
  const [selectedMentions, setSelectedMentions] = useState<MentionRef[]>([]);
  const [mentionActiveIdx, setMentionActiveIdx] = useState(0);
  const [attachCaption, setAttachCaption] = useState('');
  const [draftPreviews, setDraftPreviews] = useState<Array<LocalMediaPreview & { name: string; size: number }>>([]);
  const attachCaptionInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    setMentionQuery(null);
    setSelectedMentions([]);
    setMentionActiveIdx(0);
  }, [id]);
  useEffect(() => {
    let cancelled = false;
    const prev = draftPreviews;
    if (!attachDraft) {
      setDraftPreviews([]);
      prev.forEach(revokeLocalMediaPreview);
      return;
    }
    (async () => {
      const next = await Promise.all(attachDraft.files.map(async file => {
        const preview = await createLocalMediaPreview(file);
        return { ...preview, name: file.name, size: file.size };
      }));
      if (cancelled) {
        next.forEach(revokeLocalMediaPreview);
        return;
      }
      setDraftPreviews(current => { current.forEach(revokeLocalMediaPreview); return next; });
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachDraft]);
  useEffect(() => () => { draftPreviews.forEach(revokeLocalMediaPreview); }, [draftPreviews]);
  useEffect(() => {
    if (!attachDraft || conv?.is_encrypted) return;
    const t1 = window.setTimeout(() => attachCaptionInputRef.current?.focus(), 40);
    const t2 = window.setTimeout(() => attachCaptionInputRef.current?.focus(), 220);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [attachDraft, conv?.is_encrypted]);
  // Режим следующего сообщения: «исчезающее через X секунд» или «скрытое (spoiler)»
  // Один раз применяется к ближайшему отправленному и сбрасывается.
  type PendingMode =
    | { type: 'ephemeral'; seconds: number; label: string }
    | { type: 'spoiler' }
    | null;
  const [pendingMode, setPendingMode] = useState<PendingMode>(null);
  // Spoiler-сообщения локально раскрываются по тапу
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(new Set());

  // Spoilers are intentionally temporary: once a revealed message fully leaves the
  // chat viewport it is hidden again. This keeps the behavior private and predictable
  // when the user scrolls through history.
  useEffect(() => {
    if (revealedSpoilers.size === 0) return;
    const root = messagesContainerRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver((entries) => {
      const hiddenIds: string[] = [];
      for (const entry of entries) {
        if (entry.isIntersecting) continue;
        const id = (entry.target as HTMLElement).dataset.messageId;
        if (id) hiddenIds.push(id);
      }
      if (!hiddenIds.length) return;
      setRevealedSpoilers(current => {
        let changed = false;
        const next = new Set(current);
        for (const id of hiddenIds) {
          if (next.delete(id)) changed = true;
        }
        return changed ? next : current;
      });
    }, { root, threshold: 0.01 });

    for (const id of revealedSpoilers) {
      const node = document.getElementById(`msg-${id}`);
      if (node) {
        node.dataset.messageId = id;
        observer.observe(node);
      }
    }
    return () => observer.disconnect();
  }, [revealedSpoilers]);
  // Тик каждые 10с чтобы клиент автоматически скрывал истёкшие сообщения
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 10000);
    return () => clearInterval(t);
  }, []);
  const [attachTab, setAttachTab] = useState<'home'|'gallery'|'file'|'geo'|'poll'|'auction'|'tinder'|'event'|'game'|'ephemeral'|'spoiler'>('home');
  const [attachDir, setAttachDir] = useState<'fwd'|'back'>('fwd');
  const goAttachTab = (t: typeof attachTab) => { setAttachDir(t === 'home' ? 'back' : 'fwd'); setAttachTab(t); };
  const onAttachDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    attachDragRef.current = true;
    attachStartYRef.current = e.clientY;
    attachDragYRef.current = 0;
    setAttachDragY(0);
    setAttachDragging(true);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };
  const onAttachMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!attachDragRef.current) return;
    const raw = Math.max(0, e.clientY - attachStartYRef.current);
    const dy = raw > 420 ? 420 + (raw - 420) * 0.24 : raw;
    attachDragYRef.current = dy;
    setAttachDragY(dy);
  };
  const onAttachUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!attachDragRef.current) return;
    attachDragRef.current = false;
    setAttachDragging(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    const dy = attachDragYRef.current;
    if (dy > 82) closeAttach();
    else { attachDragYRef.current = 0; setAttachDragY(0); }
  };
  const [showTinderBetSheet, setShowTinderBetSheet] = useState(false);
  const [showTinderWidget, setShowTinderWidget] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [profileTab, setProfileTab] = useState<ProfileTab>('media');
  const profileSwipeRef = useRef<{ startX: number; lastX: number; active: boolean } | null>(null);
  const [pollQ, setPollQ] = useState('');
  const [pollOpts, setPollOpts] = useState(['','']);
  const [pollSending, setPollSending] = useState(false);
  const [attachDragY, setAttachDragY] = useState(0);
  const [attachDragging, setAttachDragging] = useState(false);
  const attachDragRef = useRef(false);
  const attachStartYRef = useRef(0);
  const attachDragYRef = useRef(0);
  const [polls, setPolls] = useState<Record<string,any>>({});
  const pollVoteSeqRef = useRef<Record<string, number>>({});
  const [otherOnline, setOtherOnline] = useState(false);
  // фон чата удалён как фича
  const [showAuctionCreator, setShowAuctionCreator] = useState(false);
  const auctionsMap = useAuctionStore(s => s.auctions);
  const { loadAuctionsForConversation, finalizeExpiredAuctions, subscribeRealtime: subAuc, unsubscribeRealtime: unsubAuc, loadAllBids: loadAuctionAllBids } = useAuctionStore();
  const [otherLastSeen, setOtherLastSeen] = useState('');
  const msgEnd = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastMarkedReadRef = useRef<string>('');
  const [reconnectKey, setReconnectKey] = useState(0);
  const [editingMsg, setEditingMsg] = useState<string|null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAdminStatus, setShowAdminStatus] = useState(false);
  const [askPassword, setAskPassword] = useState(false);
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwShow, setPwShow] = useState(false);
  const [pwRemember, setPwRemember] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [pwUnlocking, setPwUnlocking] = useState(false);
  const [decryptedMap, setDecryptedMap] = useState<Record<string,string>>({});
  const [decryptedFiles, setDecryptedFiles] = useState<Record<string,{url:string;name:string}>>({});
  const [videoMode, setVideoMode] = useState(false);
  const [recordingVideo, setRecordingVideo] = useState(false);
  const [videoStarting, setVideoStarting] = useState(false);

  useEffect(() => {
    if (!recordingVideo) return;
    document.documentElement.classList.add('vnote-open');
    document.body.classList.add('vnote-open');
    const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previousThemeColor = themeMeta?.content || '';
    themeMeta?.setAttribute('content', '#000000');
    return () => {
      document.documentElement.classList.remove('vnote-open');
      document.body.classList.remove('vnote-open');
      if (themeMeta) themeMeta.setAttribute('content', previousThemeColor || (document.documentElement.getAttribute('data-theme') === 'dark' ? '#000000' : '#FFFFFF'));
    };
  }, [recordingVideo]);
  const [videoDur, setVideoDur] = useState(0);
  const [videoFacing, setVideoFacing] = useState<'user'|'environment'>('user');
  const [videoFlipping, setVideoFlipping] = useState(false);
  const videoTimerRef = useRef<any>(null);
  // Камерный stream используется только как источник превью. MediaRecorder пишет
  // отдельный стабильный canvas-stream, поэтому замена камеры больше не завершает запись.
  const videoStreamRef = useRef<MediaStream|null>(null);
  const videoRecordStreamRef = useRef<MediaStream|null>(null);
  const videoRecRef = useRef<MediaRecorder|null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement|null>(null);
  const videoCanvasRef = useRef<HTMLCanvasElement|null>(null);
  const videoCanvasRafRef = useRef<number|null>(null);
  const videoUsesCanvasRef = useRef(false);
  const videoChunksRef = useRef<Blob[]>([]);
  const videoFlippingRef = useRef<boolean>(false);
  const videoStartSeqRef = useRef(0);
  const audioStartSeqRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const userScrollingRef = useRef(false);
  const userScrollTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    videoStartSeqRef.current += 1;
    audioStartSeqRef.current += 1;
    if (userScrollTimerRef.current != null) clearTimeout(userScrollTimerRef.current);
    if (videoTimerRef.current) clearInterval(videoTimerRef.current);
    const rec = videoRecRef.current;
    if (rec) {
      rec.onstop = null;
      try { if (rec.state !== 'inactive') rec.stop(); } catch { /* noop */ }
    }
    if (videoCanvasRafRef.current != null) cancelAnimationFrame(videoCanvasRafRef.current);
    videoCanvasRafRef.current = null;
    videoRecordStreamRef.current?.getTracks().forEach(track => track.stop());
    videoRecordStreamRef.current = null;
    videoStreamRef.current?.getTracks().forEach(track => track.stop());
    videoStreamRef.current = null;
    videoCanvasRef.current = null;
    videoRecRef.current = null;
    videoChunksRef.current = [];
    try { audioCtxRef.current?.close(); } catch {}
    audioCtxRef.current = null;
  }, []);
  const timerRef = useRef<any>(null);
  const animRef = useRef<any>(null);
  const lastTapRef = useRef<{ id: string; time: number }>({ id: '', time: 0 });
  const singleTapTimerRef = useRef<number | null>(null);
  const [reactionSheetY, setReactionSheetY] = useState(0);
  const [reactionSheetDragging, setReactionSheetDragging] = useState(false);
  const reactionSheetDragRef = useRef<{ startY: number; dy: number } | null>(null);
  const [reactionSlideEmoji, setReactionSlideEmoji] = useState<string | null>(null);
  const reactionSlideRef = useRef<{ pointerId: number; emoji: string | null } | null>(null);
  const reactionGridRef = useRef<HTMLDivElement | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => networkManager.subscribe(setIsOnline), []);

  const isSavedChat = !!conv?.is_saved && conv.saved_owner_id === user?.id;
  const other = isSavedChat ? undefined : conv?.members.find(m => m.user_id !== user?.id);
  const otherUser = (other as any)?.user;
  const chatName = isSavedChat ? 'Избранное' : (conv?.type === 'group' ? conv.name || 'Группа' : otherUser?.display_name || 'Чат');
  const pinnedMsgs = pinnedIds.map(pid => currentMessages.find(m => m.id === pid)).filter(Boolean) as MessageWithSender[];
  const pinnedActive = pinnedMsgs.length ? pinnedMsgs[Math.min(pinnedActiveIdx, pinnedMsgs.length - 1)] : null;
  const isBlocked = !!(otherUser && blockedIds.includes(otherUser.id));
  const encryptedMessageCount = currentMessages.reduce((n, m) => n + ((m as any).is_encrypted ? 1 : 0), 0);
  const isNewEncryptedChat = !!conv?.is_encrypted && !(conv as any)?.enc_check && !loadingMessages && encryptedMessageCount === 0;
  const reportUser = async () => {
    if (!user || !otherUser || !id) return;
    if (!confirm('Отправить жалобу на этот чат модератору?')) return;
    const lastMessage = [...currentMessages].reverse().find(m => m.sender_id === otherUser.id && !(m as any).deleted_at);
    const { error } = await supabase.from('content_reports').insert({
      reporter_id: user.id,
      reported_user_id: otherUser.id,
      conversation_id: id,
      message_id: lastMessage?.id || null,
      reason: 'chat_profile',
      details: 'Жалоба отправлена из профиля собеседника в чате',
    });
    if (error) toast.error('Не удалось отправить жалобу: ' + error.message);
    else toast.success('Жалоба отправлена');
  };
  // #И4 — последнее своё сообщение, прочитанное собеседником (для read-аватарки, личные чаты)
  const lastReadOwnId = (() => {
    if (conv?.type !== 'direct' || isSavedChat) return null;
    let rid: string | null = null;
    for (const m of currentMessages) {
      if (m.sender_id === user?.id && !(m as any).deleted_at) {
        if (Object.values(memberReadTimes).some(t => t && t >= m.created_at)) rid = m.id;
      }
    }
    return rid;
  })();

  // Init
  useEffect(() => {
    if (!id || !user) return;
    if (conv?.is_encrypted && !getChatPassword(id)) setAskPassword(true);
    fetchMessages(id);
    updateLastSeen(user.id);
    const loadTimeout = setTimeout(() => { if (useChatStore.getState().loadingMessages) fetchMessages(id!); }, 5000);
    const u1 = subscribeToMessages(id);
    const u2 = subscribeToTyping(id, user.id);
    fetchReadReceipts(id, user.id);
    const lsIv = setInterval(() => updateLastSeen(user.id), 30000);
    return () => { u1(); u2(); clearInterval(lsIv); clearTimeout(loadTimeout); if (id) revokeDecryptedUrls(id); };
  }, [id, user?.id, reconnectKey]);

  // Аукционы: загружаем при входе, подписываемся, финализируем просроченные
  useEffect(() => {
    if (!id || !user) return;
    loadAuctionsForConversation(id, user.id).then(() => {
      // финализируем все просроченные активные
      finalizeExpiredAuctions(id);
    });
    subAuc(id, user.id);
    return () => { unsubAuc(); };
  }, [id, user?.id]);

  // Когда добавляется новое сообщение типа [AUCTION:id] — подгружаем аукционы заново
  // (мы автоматически получаем апдейт через realtime auctions, но нужен fallback)

  useEffect(() => {
    if (showUserProfile && id) {
      fetchMediaGallery(id).then(setGallery).catch(e => console.error('fetchMediaGallery:', e));
    }
  }, [showUserProfile, id]);

  // Прыжок в конец чата: на первом наборе сообщений делаем СИНХРОННО через layoutEffect
  // и прямой scrollTop — это происходит до paint, поэтому пользователь не видит
  // момента когда сообщения уже в DOM, а скролл ещё наверху. Последующие апдейты
  // (новые входящие, decrypt, read receipts) — плавно, smooth.
  const firstScrollDoneRef = useRef(false);
  // Прилип ли пользователь к низу (для анти-скачка при подгрузке медиа)
  const stuckToBottomRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  // #21 — подгрузка старых: сохранение позиции скролла при добавлении сверху
  const olderAnchorRef = useRef<{
    element: HTMLElement;
    messageId: string;
    top: number;
    scrollTop: number;
    scrollHeight: number;
    messageCount: number;
    oldestMessageId: string | null;
    observer: ResizeObserver | null;
    settleTimer: number | null;
    settleRaf: number | null;
  } | null>(null);
  const historyScrollAdjustingRef = useRef(false);
  const [historyPrepending, setHistoryPrepending] = useState(false);
  const viewportAnchorRef = useRef<{ element: HTMLElement; top: number } | null>(null);
  const skipNewCountRef = useRef(false);
  const messageLayoutKey = useMemo(() => currentMessages.map(message => {
    // Локальное сообщение и его серверная версия должны иметь один layout-key.
    // Идентификаторы attachment и статус доставки не влияют на геометрию и не
    // должны запускать повторную коррекцию scrollTop (clock -> check).
    const stableId = String((message as any).client_id || message.id);
    const attachments = (message.attachments || []).map(att => {
      const name = String(att.file_name || '').toLowerCase();
      const kind = name.startsWith('videonote_') ? 'videonote'
        : name.startsWith('voice_') || String(att.mime_type || '').startsWith('audio/') ? 'voice'
        : String(att.mime_type || '').startsWith('image/') ? 'image'
        : String(att.mime_type || '').startsWith('video/') ? 'video'
        : 'file';
      return kind;
    }).join(',');
    return `${stableId}:${message.type}:${attachments}`;
  }).join('|'), [currentMessages]);
  // #17 — плавающая дата (Telegram-style): текст текущего дня + видимость во время прокрутки
  const [floatingDate, setFloatingDate] = useState<string | null>(null);
  const [datePillShown, setDatePillShown] = useState(false);
  const datePillTimerRef = useRef<number | null>(null);
  const dateRafRef = useRef<number | null>(null);
  const msgsForDateRef = useRef(currentMessages);
  msgsForDateRef.current = currentMessages;
  useEffect(() => () => {
    if (datePillTimerRef.current) clearTimeout(datePillTimerRef.current);
    if (dateRafRef.current != null) cancelAnimationFrame(dateRafRef.current);
  }, []);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [composerHidden, setComposerHidden] = useState(false);
  const [initialMessagesReady, setInitialMessagesReady] = useState(false);
  const scrollHideRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => {
    if (singleTapTimerRef.current != null) window.clearTimeout(singleTapTimerRef.current);
  }, []);
  const [unreadBoundary, setUnreadBoundary] = useState<string | null | undefined>(undefined);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const prevMsgLenRef = useRef(0);
  const catchUpArmedRef = useRef(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const composerShouldStayOpenRef = useRef(false);

  // Если юзер у низа — мгновенно держим ленту в конце (медиа подгрузилось и выросло)
  const pinToBottomIfStuck = useCallback(() => {
    const c = messagesContainerRef.current;
    if (!c || userScrollingRef.current) return;
    if (stuckToBottomRef.current) c.scrollTop = c.scrollHeight;
  }, []);

  // Высота медиа заранее зарезервирована. Не используем ResizeObserver для принудительного
  // scrollTop: на iOS он конфликтовал с жестом прокрутки и создавал дребезжание.
  const captureViewportAnchor = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container || stuckToBottomRef.current) { viewportAnchorRef.current = null; return; }
    const containerTop = container.getBoundingClientRect().top;
    const candidates = Array.from(container.querySelectorAll('.msg-appear')) as HTMLElement[];
    const anchor = candidates.find(element => element.getBoundingClientRect().bottom >= containerTop + 6);
    viewportAnchorRef.current = anchor ? { element: anchor, top: anchor.getBoundingClientRect().top } : null;
  }, []);

  const finishHistoryPrepend = useCallback(() => {
    const anchor = olderAnchorRef.current;
    if (anchor?.observer) anchor.observer.disconnect();
    if (anchor?.settleTimer != null) window.clearTimeout(anchor.settleTimer);
    if (anchor?.settleRaf != null) cancelAnimationFrame(anchor.settleRaf);
    olderAnchorRef.current = null;
    historyScrollAdjustingRef.current = false;
    setHistoryPrepending(false);
    captureViewportAnchor();
  }, [captureViewportAnchor]);

  const restoreHistoryAnchor = useCallback(() => {
    const container = messagesContainerRef.current;
    const anchor = olderAnchorRef.current;
    if (!container || !anchor) return false;
    const element = anchor.element?.isConnected
      ? anchor.element
      : document.getElementById('msg-' + anchor.messageId) as HTMLElement | null;
    if (!element) return false;

    const delta = element.getBoundingClientRect().top - anchor.top;
    if (Math.abs(delta) <= 0.25) return true;

    historyScrollAdjustingRef.current = true;
    container.scrollTop += delta;
    lastScrollTopRef.current = container.scrollTop;
    requestAnimationFrame(() => { historyScrollAdjustingRef.current = false; });
    return true;
  }, []);

  useEffect(() => () => {
    const anchor = olderAnchorRef.current;
    if (anchor?.observer) anchor.observer.disconnect();
    if (anchor?.settleTimer != null) window.clearTimeout(anchor.settleTimer);
    if (anchor?.settleRaf != null) cancelAnimationFrame(anchor.settleRaf);
  }, []);

  const onMessagesScroll = useCallback(() => {
    const c = messagesContainerRef.current;
    if (!c) return;

    // Пока подгружается история, пользователь всё ещё может продолжать свайп.
    // Сохраняем новое положение якоря, чтобы последующие изменения высоты
    // старых сообщений не возвращали ленту к устаревшей координате.
    const historyAnchor = olderAnchorRef.current;
    if (historyAnchor && !historyScrollAdjustingRef.current && historyAnchor.element?.isConnected) {
      historyAnchor.top = historyAnchor.element.getBoundingClientRect().top;
      historyAnchor.scrollTop = c.scrollTop;
      historyAnchor.scrollHeight = c.scrollHeight;
    }

    const dist = c.scrollHeight - c.scrollTop - c.clientHeight;
    userScrollingRef.current = true;
    if (userScrollTimerRef.current != null) clearTimeout(userScrollTimerRef.current);
    userScrollTimerRef.current = window.setTimeout(() => { userScrollingRef.current = false; }, 140);
    const goingDown = c.scrollTop > lastScrollTopRef.current + 2;
    const goingUp = c.scrollTop < lastScrollTopRef.current - 2;
    lastScrollTopRef.current = c.scrollTop;
    stuckToBottomRef.current = dist < 80;
    captureViewportAnchor();
    if (dist < 80) setShowScrollDown(false);
    else if (goingDown && dist > 300) setShowScrollDown(true);
    else if (goingUp) setShowScrollDown(false);
    // Панель остаётся в потоке и двигается только transform-анимацией — сообщения не меняют позицию.
    if (scrollHideRef.current) clearTimeout(scrollHideRef.current);
    if (dist < 80 || goingDown) {
      setComposerHidden(false);
    } else if (goingUp && dist > 120) {
      scrollHideRef.current = window.setTimeout(() => setComposerHidden(true), 55);
    }
    if (dist < 80) setNewMsgCount(0);
    // #21 — у верха: подгружаем старые, запоминая высоту для сохранения позиции
    if (c.scrollTop < 120 && hasMoreOlder && !loadingOlder && !olderAnchorRef.current && id) {
      const containerTop = c.getBoundingClientRect().top;
      const candidates = Array.from(c.querySelectorAll('.msg-appear')) as HTMLElement[];
      const visibleAnchor = candidates.find(el => el.getBoundingClientRect().bottom >= containerTop + 4);
      const messageId = visibleAnchor?.id?.startsWith('msg-') ? visibleAnchor.id.slice(4) : '';
      if (visibleAnchor && messageId) {
        olderAnchorRef.current = {
          element: visibleAnchor,
          messageId,
          top: visibleAnchor.getBoundingClientRect().top,
          scrollTop: c.scrollTop,
          scrollHeight: c.scrollHeight,
          messageCount: currentMessages.length,
          oldestMessageId: currentMessages[0]?.id || null,
          observer: null,
          settleTimer: null,
          settleRaf: null,
        };
        setHistoryPrepending(true);
        skipNewCountRef.current = true;
        void loadOlderMessages(id).finally(() => {
          // Если сервер не вернул новых сообщений, layout-effect не запустится.
          // В таком случае снимаем блокировку после завершения запроса.
          const active = olderAnchorRef.current;
          if (active && useChatStore.getState().currentMessages.length === active.messageCount) {
            finishHistoryPrepend();
          }
        });
      }
    }
    // #17 — плавающая дата: видна во время прокрутки, прячется в покое
    setDatePillShown(true);
    if (datePillTimerRef.current) clearTimeout(datePillTimerRef.current);
    datePillTimerRef.current = window.setTimeout(() => setDatePillShown(false), 1400);
    if (dateRafRef.current == null) {
      dateRafRef.current = requestAnimationFrame(() => {
        dateRafRef.current = null;
        const cont = messagesContainerRef.current;
        if (!cont) return;
        const topY = cont.getBoundingClientRect().top;
        const msgs = msgsForDateRef.current;
        for (let k = 0; k < msgs.length; k++) {
          const el = document.getElementById('msg-' + msgs[k].id);
          if (!el) continue;
          const r = el.getBoundingClientRect();
          if (r.bottom >= topY + 8) { setFloatingDate(fmtDate(msgs[k].created_at)); break; }
        }
      });
    }
  }, [hasMoreOlder, loadingOlder, id, loadOlderMessages, captureViewportAnchor, currentMessages.length, finishHistoryPrepend]);

  useLayoutEffect(() => {
    if (!currentMessages.length || unreadBoundary === undefined) return;
    if (firstScrollDoneRef.current) return;
    const c = messagesContainerRef.current;
    if (!c) return;
    // Если есть непрочитанные — встаём на разделитель «Непрочитанные», иначе сразу в конец
    const divider = c.querySelector('[data-unread-divider]') as HTMLElement | null;
    if (divider) {
      divider.scrollIntoView({ block: 'center' });
      stuckToBottomRef.current = false;
      setShowScrollDown(true);
    } else {
      c.scrollTop = c.scrollHeight;
    }
    firstScrollDoneRef.current = true;
    setInitialMessagesReady(true);
    requestAnimationFrame(captureViewportAnchor);
  }, [currentMessages.length, unreadBoundary, captureViewportAnchor]);

  // #21 — сохраняем позицию при добавлении старых сообщений сверху
  useLayoutEffect(() => {
    const c = messagesContainerRef.current;
    const anchor = olderAnchorRef.current;
    if (!c || !anchor) return;

    // Новое входящее сообщение могло прийти, пока страница истории загружалась.
    // Восстанавливаем позицию только когда действительно изменилось самое старое
    // сообщение, то есть новые элементы были добавлены именно сверху.
    if ((currentMessages[0]?.id || null) === anchor.oldestMessageId) return;

    historyScrollAdjustingRef.current = true;
    const heightDelta = c.scrollHeight - anchor.scrollHeight;
    c.scrollTop = Math.max(0, anchor.scrollTop + heightDelta);
    lastScrollTopRef.current = c.scrollTop;
    requestAnimationFrame(() => { historyScrollAdjustingRef.current = false; });
    restoreHistoryAnchor();

    // У старых сообщений могут позже уточниться высота опроса, превью или медиа.
    // Временно наблюдаем только добавленные сверху элементы и удерживаем на месте
    // то сообщение, которое пользователь видел до подгрузки. Это не постоянный
    // observer и поэтому не конфликтует с обычным свайпом в iOS WebKit.
    anchor.observer?.disconnect();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        const active = olderAnchorRef.current;
        if (!active) return;
        if (active.settleRaf != null) cancelAnimationFrame(active.settleRaf);
        active.settleRaf = requestAnimationFrame(() => {
          active.settleRaf = null;
          restoreHistoryAnchor();
          if (active.settleTimer != null) window.clearTimeout(active.settleTimer);
          active.settleTimer = window.setTimeout(finishHistoryPrepend, 420);
        });
      });
      anchor.observer = observer;
      const children = Array.from(c.children) as HTMLElement[];
      const anchorIndex = children.indexOf(anchor.element);
      if (anchorIndex > 0) children.slice(0, anchorIndex).forEach(element => observer.observe(element));
    }

    if (anchor.settleRaf != null) cancelAnimationFrame(anchor.settleRaf);
    anchor.settleRaf = requestAnimationFrame(() => {
      anchor.settleRaf = requestAnimationFrame(() => {
        anchor.settleRaf = null;
        restoreHistoryAnchor();
        if (anchor.settleTimer != null) window.clearTimeout(anchor.settleTimer);
        anchor.settleTimer = window.setTimeout(finishHistoryPrepend, 520);
      });
    });
  }, [currentMessages.length, currentMessages, restoreHistoryAnchor, finishHistoryPrepend]);

  useLayoutEffect(() => {
    if (!currentMessages.length || !firstScrollDoneRef.current) return;
    if (!catchUpArmedRef.current) { catchUpArmedRef.current = true; captureViewportAnchor(); return; }
    const container = messagesContainerRef.current;
    if (!container || olderAnchorRef.current) return;
    const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if ((stuckToBottomRef.current || distFromBottom < 80) && !userScrollingRef.current) {
      container.scrollTop = container.scrollHeight;
      viewportAnchorRef.current = null;
      return;
    }
    const anchor = viewportAnchorRef.current;
    if (anchor?.element?.isConnected) {
      const delta = anchor.element.getBoundingClientRect().top - anchor.top;
      if (Math.abs(delta) > 0.5) container.scrollTop += delta;
    }
    captureViewportAnchor();
  }, [messageLayoutKey, captureViewportAnchor, currentMessages.length]);

  // #15 — считаем новые сообщения, пришедшие пока юзер листает историю (не у низа)
  useEffect(() => {
    const prev = prevMsgLenRef.current;
    const cur = currentMessages.length;
    if (skipNewCountRef.current) { skipNewCountRef.current = false; prevMsgLenRef.current = cur; return; }
    if (cur > prev && prev > 0 && !stuckToBottomRef.current) {
      setNewMsgCount(n => n + (cur - prev));
    }
    prevMsgLenRef.current = cur;
  }, [currentMessages.length]);

  // #22 — прыжок к сообщению с короткой подсветкой
  const flashMessage = useCallback((id: string) => {
    const el = document.getElementById('msg-' + id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('msg-flash');
    void el.offsetWidth; // reflow — перезапуск анимации
    el.classList.add('msg-flash');
    window.setTimeout(() => el.classList.remove('msg-flash'), 1300);
  }, []);


  const resolveMessageForAttachment = useCallback(async (attachment: FileAttachment): Promise<MessageWithSender | null> => {
    const messageId = (attachment as any).message_id as string | undefined;
    if (!messageId) return null;
    const inMemory = useChatStore.getState().currentMessages.find(m => m.id === messageId);
    if (inMemory) return inMemory;
    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:users(*), attachments:file_attachments(*)')
      .eq('id', messageId)
      .maybeSingle();
    if (error || !data) return null;
    return { ...data, reply_to: null, attachments: data.attachments || [] } as MessageWithSender;
  }, []);

  const showProfileFileInChat = useCallback(async (attachment: FileAttachment) => {
    const messageId = (attachment as any).message_id as string | undefined;
    if (!messageId || !id) return;
    haptic.tap();
    setProfileFileMenu(null);
    setShowUserProfile(false);
    setShowGroupInfo(false);

    await new Promise(resolve => window.setTimeout(resolve, 180));
    if (document.getElementById('msg-' + messageId)) {
      flashMessage(messageId);
      return;
    }

    // Older files may point to messages outside the currently loaded page.
    // Load history page-by-page until the source message is present.
    for (let page = 0; page < 24; page++) {
      const state = useChatStore.getState();
      if (state.currentMessages.some(m => m.id === messageId)) break;
      if (!state.hasMoreOlder) break;
      await state.loadOlderMessages(id);
    }
    window.setTimeout(() => {
      if (document.getElementById('msg-' + messageId)) flashMessage(messageId);
      else toast.error('Сообщение с этим файлом не найдено в загруженной истории');
    }, 80);
  }, [flashMessage, id]);

  const forwardProfileFile = useCallback(async (attachment: FileAttachment) => {
    haptic.tap();
    const message = await resolveMessageForAttachment(attachment);
    if (!message) { toast.error('Не удалось найти исходное сообщение'); return; }
    setProfileFileMenu(null);
    setShowUserProfile(false);
    setShowGroupInfo(false);
    setForwardMsgs([message]);
  }, [resolveMessageForAttachment]);

  const downloadProfileFile = useCallback(async (attachment: FileAttachment) => {
    haptic.tap();
    const url = attachment.file_url;
    const name = attachment.file_name || 'file';
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('download failed');
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setProfileFileMenu(null);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
      setProfileFileMenu(null);
    }
  }, []);

  // #30 — авто-рост поля ввода (textarea): подгоняем высоту под содержимое, кап ~5 строк
  useEffect(() => {
    const el = composerRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }
    if (!text) setMentionQuery(null);
  }, [text]);

  // #33 — черновик текста на чат: при входе подставляем сохранённый, на изменение сохраняем
  useEffect(() => {
    if (!id) return;
    try { setText(localStorage.getItem('draft:' + id) || ''); } catch { setText(''); }
  }, [id]);
  // #9 — загрузка закреплённых при входе в чат
  useEffect(() => { if (id) fetchPinned(id); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  // #П2 — загрузка списка заблокированных (раз на пользователя)
  useEffect(() => { if (user) fetchBlocked(user.id); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!id || editingMsg) return;
    try {
      if (text.trim()) localStorage.setItem('draft:' + id, text);
      else localStorage.removeItem('draft:' + id);
    } catch { /* no-op */ }
  }, [text, id, editingMsg]);

  // #34 — вставка из буфера / drag-drop файлов
  const stageFiles = (files: File[]) => {
    if (!files.length) return;
    const picked = files.slice(0, 10);
    if (files.length > 10) toast.info('Можно отправить до 10 файлов за раз');
    const oversized = picked.find(file => file.size > MAX_FILE);
    if (oversized) { toast.warning(`Макс. 50 МБ на файл: ${oversized.name}`); return; }
    const allMedia = picked.every(file => file.type.startsWith('image/') || file.type.startsWith('video/'));
    setAttachCaption('');
    setAttachDraft({ files: picked, kind: allMedia ? 'media' : 'file', hd: false });
  };
  const onComposerPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === 'file') { const f = it.getAsFile(); if (f) files.push(f); }
    }
    if (files.length) { e.preventDefault(); stageFiles(files); }
  };
  const onChatDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length) stageFiles(files);
  };

  // #23 — упоминания @ в группах
  const onComposerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    handleTyping(v);
    setSelectedMentions(previous => previous.filter(ref => v.includes(`@${ref.name}`)));
    if (conv?.type === 'group') {
      const pos = e.target.selectionStart ?? v.length;
      const before = v.slice(0, pos);
      const m = before.match(/(^|\s)@([^\s@]*)$/);
      setMentionQuery(m ? m[2] : null);
      setMentionActiveIdx(0);
    } else {
      setMentionQuery(null);
    }
  };
  const insertMention = (member: any) => {
    const name = String(member?.user?.display_name || '').trim();
    const userId = String(member?.user_id || member?.user?.id || '');
    if (!name || !userId) return;
    const el = composerRef.current;
    const pos = el?.selectionStart ?? text.length;
    const before = text.slice(0, pos);
    const after = text.slice(pos);
    const newBefore = before.replace(/@([^\s@]*)$/, '@' + name + ' ');
    const newText = newBefore + after;
    handleTyping(newText);
    setSelectedMentions(previous => [...previous, { userId, name }]);
    setMentionQuery(null);
    setMentionActiveIdx(0);
    setTimeout(() => { if (el) { el.focus(); const np = newBefore.length; el.setSelectionRange(np, np); } }, 0);
  };
  const mentionMatches = (mentionQuery !== null && conv?.type === 'group')
    ? (conv.members || [])
        .filter((mm: any) => mm.user_id !== user?.id)
        .filter((mm: any) => {
          const query = (mentionQuery || '').toLowerCase();
          const name = String(mm.user?.display_name || '').toLowerCase();
          const email = String(mm.user?.email || '').toLowerCase();
          return !query || name.includes(query) || email.includes(query);
        })
        .slice(0, 8)
    : [];

  const onComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && mentionMatches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionActiveIdx(index => (index + 1) % mentionMatches.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionActiveIdx(index => (index - 1 + mentionMatches.length) % mentionMatches.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(mentionMatches[mentionActiveIdx] || mentionMatches[0]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  // #2 — поиск внутри чата (по загруженным сообщениям; для шифрованных — по расшифрованному тексту)
  const runSearch = (q: string) => {
    const query = q.trim().toLowerCase();
    if (!query) { setSearchResults([]); setSearchIdx(0); return; }
    const ids = currentMessages.filter(m => {
      if ((m as any).deleted_at) return false;
      const rawText = (m as any).is_encrypted ? (decryptedMap[m.id] || '') : (m.content || '');
      const txt = typeof rawText === 'string' ? stripMentionTokens(rawText) : rawText;
      return typeof txt === 'string' && txt.toLowerCase().includes(query);
    }).map(m => m.id);
    setSearchResults(ids);
    if (ids.length) { const last = ids.length - 1; setSearchIdx(last); flashMessage(ids[last]); }
    else setSearchIdx(0);
  };
  const onSearchChange = (v: string) => { setSearchQuery(v); runSearch(v); };
  const searchStep = (dir: number) => {
    if (!searchResults.length) return;
    let ni = searchIdx + dir;
    if (ni < 0) ni = searchResults.length - 1;
    if (ni >= searchResults.length) ni = 0;
    setSearchIdx(ni);
    flashMessage(searchResults[ni]);
  };
  const closeSearch = () => { setSearchOpen(false); setSearchQuery(''); setSearchResults([]); setSearchIdx(0); };
  // #И1 — подсветка совпадений поиска в тексте
  const highlightSearch = (text: any): any => {
    const q = searchOpen ? searchQuery.trim() : '';
    if (!q || typeof text !== 'string' || !text) return text;
    const lower = text.toLowerCase();
    const ql = q.toLowerCase();
    if (!lower.includes(ql)) return text;
    const parts: any[] = [];
    let i = 0; let idx: number;
    while ((idx = lower.indexOf(ql, i)) !== -1) {
      if (idx > i) parts.push(text.slice(i, idx));
      parts.push(<mark key={idx} className="search-hl">{text.slice(idx, idx + q.length)}</mark>);
      i = idx + q.length;
    }
    if (i < text.length) parts.push(text.slice(i));
    return parts;
  };


  const renderLinkifiedPlainText = (value: string, keyPrefix = 'plain'): any => {
    if (!value) return value;
    const nodes: any[] = [];
    let cursor = 0;
    INLINE_HTTP_URL_RE.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = INLINE_HTTP_URL_RE.exec(value)) !== null) {
      const raw = match[0];
      const clean = cleanInlineUrl(raw);
      const suffix = raw.slice(clean.length);
      const start = match.index;

      if (start > cursor) nodes.push(<span key={`${keyPrefix}-txt-${cursor}`}>{highlightSearch(value.slice(cursor, start))}</span>);

      nodes.push(
        <a
          key={`${keyPrefix}-url-${start}`}
          href={clean}
          target="_blank"
          rel="noopener noreferrer"
          className="message-inline-link"
          onClick={(event) => event.stopPropagation()}
          title={clean}
        >
          {highlightSearch(compactInlineUrlLabel(clean))}
        </a>,
      );

      if (suffix) nodes.push(<span key={`${keyPrefix}-suffix-${start}`}>{suffix}</span>);
      cursor = start + raw.length;
    }

    if (cursor < value.length) nodes.push(<span key={`${keyPrefix}-txt-${cursor}`}>{highlightSearch(value.slice(cursor))}</span>);
    return nodes.length ? nodes : highlightSearch(value);
  };

  const renderLinkifiedText = (value: string): any => {
    if (!value) return value;
    const segments = parseMentionContent(value);
    if (!segments.some(segment => segment.type === 'mention')) return renderLinkifiedPlainText(value);

    return segments.map((segment, index) => {
      if (segment.type === 'text') {
        return <span key={`mention-text-${index}`}>{renderLinkifiedPlainText(segment.value, `mention-${index}`)}</span>;
      }
      return (
        <button
          type="button"
          key={`mention-${segment.userId}-${index}`}
          className="message-mention"
          onClick={(event) => {
            event.stopPropagation();
            haptic.select();
            nav(`/u/${segment.userId}`);
          }}
          title={`Открыть профиль ${segment.name}`}
        >
          @{highlightSearch(segment.name)}
        </button>
      );
    });
  };

  // #27 — мультивыбор сообщений
  const toggleSelect = useCallback((mid: string) => {
    haptic.select();
    setSelectedIds(ids => ids.includes(mid) ? ids.filter(x => x !== mid) : [...ids, mid]);
  }, []);
  const exitSelect = useCallback(() => { setSelectMode(false); setSelectedIds([]); }, []);
  const selectProfileTab = useCallback((next: ProfileTab) => {
    if (next === profileTab) return;
    setProfileTab(next);
    if (next !== 'links' && id) fetchMediaGallery(id).then(setGallery).catch(() => {});
  }, [id, profileTab]);

  const selectProfileTabAtX = useCallback((element: HTMLElement, clientX: number) => {
    const rect = element.getBoundingClientRect();
    if (!rect.width) return;
    const index = Math.max(0, Math.min(PROFILE_TABS.length - 1, Math.floor(((clientX - rect.left) / rect.width) * PROFILE_TABS.length)));
    selectProfileTab(PROFILE_TABS[index]);
  }, [selectProfileTab]);

  const onProfileTabsPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    profileSwipeRef.current = { startX: e.clientX, lastX: e.clientX, active: true };
    selectProfileTabAtX(e.currentTarget, e.clientX);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
  };
  const onProfileTabsPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!profileSwipeRef.current?.active) return;
    selectProfileTabAtX(e.currentTarget, e.clientX);
  };
  const onProfileSwipeDown = (e: React.PointerEvent) => {
    profileSwipeRef.current = { startX: e.clientX, lastX: e.clientX, active: true };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* noop */ }
  };
  const onProfileSwipeMove = (e: React.PointerEvent) => {
    const drag = profileSwipeRef.current;
    if (!drag?.active) return;
    const dx = e.clientX - drag.lastX;
    if (Math.abs(dx) < 38) return;
    const index = PROFILE_TABS.indexOf(profileTab);
    const nextIndex = Math.max(0, Math.min(PROFILE_TABS.length - 1, index + (dx < 0 ? 1 : -1)));
    if (nextIndex !== index) {
      selectProfileTab(PROFILE_TABS[nextIndex]);
      drag.lastX = e.clientX;
      drag.startX = e.clientX;
    }
  };
  const onProfileSwipeUp = () => { profileSwipeRef.current = null; };

  const handleMessageTap = useCallback((messageId: string) => {
    const now = Date.now();
    const last = lastTapRef.current;
    if (last.id === messageId && now - last.time < 330) {
      if (singleTapTimerRef.current != null) window.clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
      setShowEmojiFor(null);
      setContextMsg(messageId);
      lastTapRef.current = { id: '', time: 0 };
      haptic.tap();
      return;
    }
    lastTapRef.current = { id: messageId, time: now };
    if (singleTapTimerRef.current != null) window.clearTimeout(singleTapTimerRef.current);
    singleTapTimerRef.current = window.setTimeout(() => {
      setContextMsg(null);
      setReactionSheetY(0);
      setShowEmojiFor(current => current === messageId ? null : messageId);
      singleTapTimerRef.current = null;
    }, 245);
  }, []);

  const closeReactionPicker = useCallback(() => {
    setReactionSheetY(180);
    window.setTimeout(() => {
      setReactionPickerFor(null);
      setReactionSheetY(0);
    }, 190);
  }, []);
  const onReactionSheetDown = (e: React.PointerEvent) => {
    reactionSheetDragRef.current = { startY: e.clientY, dy: 0 };
    setReactionSheetDragging(true);
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* noop */ }
  };
  const onReactionSheetMove = (e: React.PointerEvent) => {
    const drag = reactionSheetDragRef.current;
    if (!drag) return;
    const dy = Math.max(0, e.clientY - drag.startY);
    drag.dy = dy;
    setReactionSheetY(Math.min(190, dy));
  };
  const onReactionSheetUp = () => {
    const drag = reactionSheetDragRef.current;
    reactionSheetDragRef.current = null;
    setReactionSheetDragging(false);
    if (drag && drag.dy > 68) closeReactionPicker();
    else setReactionSheetY(0);
  };

  const reactionEmojiAtPoint = (x: number, y: number) => {
    // Pointer capture keeps :active on the first button on iOS/Safari, so relying on
    // event.target makes the visual selection look stuck. Resolve the emoji by the
    // real button rectangles under the finger instead.
    const grid = reactionGridRef.current;
    if (!grid) return null;
    const buttons = Array.from(grid.querySelectorAll<HTMLButtonElement>('[data-reaction-emoji]'));
    for (const button of buttons) {
      const r = button.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return button.dataset.reactionEmoji || null;
      }
    }
    return null;
  };

  const toggleReactionInstant = useCallback((messageId: string, emoji: string) => {
    if (!user) return;

    const userId = user.id;
    const currentRows = reactionsRef.current[messageId] || [];
    const alreadyActive = currentRows.some(row => row.user_id === userId && row.emoji === emoji);
    const shouldBeActive = !alreadyActive;
    const optimisticRows = shouldBeActive
      ? [
          ...currentRows,
          {
            id: `optimistic_${messageId}_${userId}_${emoji}_${Date.now()}`,
            message_id: messageId,
            user_id: userId,
            emoji,
          } as Reaction,
        ]
      : currentRows.filter(row => !(row.user_id === userId && row.emoji === emoji));

    const optimisticMap = { ...reactionsRef.current, [messageId]: optimisticRows };
    reactionsRef.current = optimisticMap;
    setReactions(optimisticMap);
    const motionKey = `${messageId}|${emoji}`;
    setReactionMotionVersions(previous => ({
      ...previous,
      [motionKey]: (previous[motionKey] || 0) + 1,
    }));

    const operationKey = `${messageId}|${userId}|${emoji}`;
    const version = (reactionVersionRef.current[operationKey] || 0) + 1;
    reactionVersionRef.current[operationKey] = version;

    const queued = (reactionQueueRef.current[operationKey] || Promise.resolve())
      .catch(() => undefined)
      .then(async () => {
        await toggleReaction(messageId, userId, emoji, shouldBeActive);
        if (reactionVersionRef.current[operationKey] !== version) return;
        const latest = await fetchReactions([messageId]);
        const serverRows = latest[messageId] || [];
        setReactions(previous => {
          const next = { ...previous, [messageId]: serverRows };
          reactionsRef.current = next;
          return next;
        });
      })
      .catch(async (error) => {
        console.error('toggleReaction:', error);
        if (reactionVersionRef.current[operationKey] !== version) return;
        try {
          const latest = await fetchReactions([messageId]);
          const serverRows = latest[messageId] || [];
          setReactions(previous => {
            const next = { ...previous, [messageId]: serverRows };
            reactionsRef.current = next;
            return next;
          });
        } catch {
          const rollbackMap = { ...reactionsRef.current, [messageId]: currentRows };
          reactionsRef.current = rollbackMap;
          setReactions(rollbackMap);
        }
      })
      .finally(() => {
        if (reactionQueueRef.current[operationKey] === queued) {
          delete reactionQueueRef.current[operationKey];
        }
      });

    reactionQueueRef.current[operationKey] = queued;
  }, [user?.id, toggleReaction, fetchReactions]);
  const commitReactionSlide = (emoji: string | null) => {
    if (!emoji || !reactionPickerFor) return;
    haptic.select();
    toggleReactionInstant(reactionPickerFor, emoji);
    closeReactionPicker();
  };
  const onReactionGridPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const emoji = reactionEmojiAtPoint(e.clientX, e.clientY);
    if (!emoji) return;
    e.preventDefault();
    reactionSlideRef.current = { pointerId: e.pointerId, emoji };
    setReactionSlideEmoji(emoji);
    haptic.tap();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
  };
  const onReactionGridPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = reactionSlideRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    e.preventDefault();
    const emoji = reactionEmojiAtPoint(e.clientX, e.clientY);
    if (emoji && emoji !== drag.emoji) {
      drag.emoji = emoji;
      setReactionSlideEmoji(emoji);
      haptic.select();
    }
  };
  const onReactionGridPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = reactionSlideRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    e.preventDefault();
    const emoji = reactionEmojiAtPoint(e.clientX, e.clientY) || drag.emoji;
    reactionSlideRef.current = null;
    setReactionSlideEmoji(null);
    commitReactionSlide(emoji);
  };
  const onReactionGridPointerCancel = () => {
    reactionSlideRef.current = null;
    setReactionSlideEmoji(null);
  };

  const enterSelect = useCallback((mid: string) => { setContextMsg(null); setShowEmojiFor(null); setSelectMode(true); setSelectedIds([mid]); }, []);
  const forwardSelected = () => {
    const msgs = currentMessages.filter(m => selectedIds.includes(m.id));
    if (!msgs.length) return;
    setForwardMsgs(msgs);
    exitSelect();
  };
  const deleteSelected = async () => {
    if (!user) return;
    const mineMsgs = currentMessages.filter(m => selectedIds.includes(m.id) && m.sender_id === user.id && !m.deleted_at);
    if (!mineMsgs.length) { toast.error('Можно удалять только свои сообщения'); return; }
    if (!confirm(`Удалить ${mineMsgs.length} ${mineMsgs.length === 1 ? 'сообщение' : 'сообщений'}?`)) return;
    try {
      for (const m of mineMsgs) { await deleteMessage(m.id); }
      await fetchConversations(user.id);
    } catch (e: any) { toast.error('Не удалось удалить: ' + (e?.message || 'ошибка')); }
    exitSelect();
  };

  // Сбрасываем флаг скролла при смене чата
  useEffect(() => {
    firstScrollDoneRef.current = false;
    catchUpArmedRef.current = false;
    stuckToBottomRef.current = true;
    setNewMsgCount(0);
    setShowScrollDown(false);
    prevMsgLenRef.current = 0;
    setUnreadBoundary(undefined);
    setInitialMessagesReady(false);
    setSelectMode(false);
    setSelectedIds([]);
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchIdx(0);
    setPinnedActiveIdx(0);
    setFloatingDate(null);
    setDatePillShown(false);
    setComposerHidden(false);
    // Existing chat content renders immediately without replaying mount animations.
  }, [id]);

  // Decrypt encrypted messages and files
  useEffect(() => {
    if (!conv?.is_encrypted || !id) return;
    const pw = getChatPassword(id);
    if (!pw) return;
    let cancelled = false;

    (async () => {
      // Collect all decryption tasks in parallel
      const txtTasks: Promise<[string, string]>[] = [];
      const fileTasks: Promise<[string, { url: string; name: string }]>[] = [];

      for (const m of currentMessages) {
        const ma = m as any;
        if (ma.is_encrypted && ma.encrypted_iv && !decryptedMap[m.id]) {
          txtTasks.push(
            (async () => {
              try {
                const plain = await decryptMessage(m.content, ma.encrypted_iv, pw, id);
                return [m.id, plain] as [string, string];
              } catch (e) {
                console.error('decrypt msg failed', m.id, e);
                return [m.id, '__DECRYPT_ERROR__'] as [string, string];
              }
            })()
          );
        }
        if (ma.attachments?.length) {
          for (const att of ma.attachments) {
            if (att.is_encrypted && att.encrypted_iv && !decryptedFiles[att.id]) {
              fileTasks.push(
                (async () => {
                  try {
                    const url = await decryptFileFromUrl(att.file_url, att.encrypted_iv, pw, id, att.mime_type);
                    let name: string;
                    try {
                      name = await decryptFilename(att.file_name, pw, id);
                    } catch {
                      name = 'файл';
                    }
                    return [att.id, { url, name }] as [string, { url: string; name: string }];
                  } catch (e) {
                    console.error('decrypt file failed', att.id, e);
                    return [att.id, { url: '', name: '__DECRYPT_ERROR__' }] as [string, { url: string; name: string }];
                  }
                })()
              );
            }
          }
        }
      }

      const hasWork = txtTasks.length + fileTasks.length > 0;
      setDecrypting(hasWork);
      const txtResults = await Promise.all(txtTasks);
      const fileResults = await Promise.all(fileTasks);
      if (cancelled) return;

      // Check if ALL decryptions failed — means wrong password
      const allFailed = [...txtResults, ...fileResults].length > 0 &&
        [...txtResults, ...fileResults].every(r => (Array.isArray(r) ? r[1] : (r as any)[1])?.name === '__DECRYPT_ERROR__' || (r as any)[1] === '__DECRYPT_ERROR__');
      if (allFailed) {
        // Wrong password — clear and re-prompt
        clearChatPassword(id);
        setAskPassword(true);
        setPwError('Неверный пароль. Попробуй ещё раз.');
        setDecrypting(false);
        return;
      }

      const txtMap = Object.fromEntries(txtResults);
      const fileMap = Object.fromEntries(fileResults);
      if (Object.keys(txtMap).length > 0) setDecryptedMap(prev => ({ ...prev, ...txtMap }));
      if (Object.keys(fileMap).length > 0) setDecryptedFiles(prev => ({ ...prev, ...fileMap }));
      setDecrypting(false);
    })();

    return () => { cancelled = true; };
  }, [currentMessages, conv?.is_encrypted, id]);

  // Prefill «запомнить» из сохранённого состояния при открытии экрана пароля
  useEffect(() => { if (askPassword && id) setPwRemember(isChatRemembered(id)); }, [askPassword, id]);

  // Отправка пароля с анимацией «разблокировки» (если неверный — эффект расшифровки снова откроет экран с ошибкой)
  const submitPw = async () => {
    if (!pwInput || !id) return;
    if (isNewEncryptedChat && pwInput.trim().length < 4) { setPwError('Минимум 4 символа для нового пароля.'); return; }
    const cid = id, pw = pwInput, rem = pwRemember;
    setPwUnlocking(true);
    // Проверка пароля по verifier (enc_check). Если его ещё нет (старый/пустой чат) —
    // первый успешный вход записывает его, дальше неверный пароль не пустит.
    const check = (conv as any)?.enc_check as string | null | undefined;
    if (check) {
      try {
        const parsed = JSON.parse(check);
        const plain = await decryptMessage(parsed.c, parsed.iv, pw, cid);
        if (plain !== 'sigmas-check-v1') throw new Error('mismatch');
      } catch {
        setPwUnlocking(false);
        setPwError('Неверный пароль. Попробуй ещё раз.');
        haptic.select();
        return;
      }
    }
    haptic.success();
    setTimeout(async () => {
      setChatPassword(cid, pw, rem);
      setAskPassword(false);
      setPwUnlocking(false);
      setPwInput('');
      setPwError('');
      setDecryptedMap({});
      setDecryptedFiles({});
      if (!check) {
        try {
          const enc = await encryptMessage('sigmas-check-v1', pw, cid);
          await supabase.from('conversations').update({ enc_check: JSON.stringify({ c: enc.ciphertext, iv: enc.iv }) }).eq('id', cid);
        } catch { /* колонка может отсутствовать до миграции — не блокируем вход */ }
      }
    }, 450);
  };

  // Refetch + resubscribe when tab becomes visible
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState === 'visible' && id && user) {
        // Force full realtime reconnect - fixes stuck loading after tab restore
        try {
          supabase.realtime.disconnect();
          supabase.realtime.connect();
        } catch (e) { console.error('realtime reconnect:', e); }
        setReconnectKey(k => k + 1);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [id, user?.id]);

  useEffect(() => {
    reactionsRef.current = reactions;
  }, [reactions]);

  useEffect(() => {
    reactionQueueRef.current = {};
    reactionVersionRef.current = {};
    setReactionMotionVersions({});
  }, [id]);

  // Fetch reactions for visible messages
  useEffect(() => {
    if (!currentMessages.length) return;
    const ids = currentMessages.map(m => m.id);
    fetchReactions(ids).then(rows => {
      setReactions(previous => {
        const next = { ...rows };
        const pendingMessageIds = new Set(
          Object.keys(reactionQueueRef.current).map(key => key.split('|')[0]),
        );
        pendingMessageIds.forEach(messageId => {
          if (previous[messageId]) next[messageId] = previous[messageId];
        });
        reactionsRef.current = next;
        return next;
      });
    }).catch(e => console.error('fetchReactions:', e));
  }, [currentMessages.length]);

  // Reactions that arrived together with messages are applied in layout phase,
  // so reaction chips do not appear a frame later and move the chat.
  useLayoutEffect(() => {
    const embedded: Record<string, Reaction[]> = {};
    for (const message of currentMessages) {
      if (Array.isArray((message as any).reactions)) embedded[message.id] = (message as any).reactions;
    }
    if (Object.keys(embedded).length) {
      setReactions(previous => {
        let changed = false;
        const next = { ...previous };
        for (const [messageId, rows] of Object.entries(embedded)) {
          if (!(messageId in previous)) { next[messageId] = rows; changed = true; }
        }
        return changed ? next : previous;
      });
    }
  }, [currentMessages]);

  // Fetch polls
  useEffect(() => {
    const pollMsgs = currentMessages.filter(m => m.type === 'poll' && m.content);
    pollMsgs.forEach(m => {
      if (!polls[m.content]) fetchPoll(m.content).then(p => { if (p) setPolls(prev => ({...prev, [m.content]: p})); }).catch(e => console.error('fetchPoll:', e));
    });
  }, [currentMessages]);

  // Check other user online status
  useEffect(() => {
    if (!otherUser) return;
    const check = async () => {
      const { data } = await supabase.from('users').select('last_seen, status').eq('id', otherUser.id).single();
      if (data) {
        const diff = Date.now() - new Date(data.last_seen).getTime();
        setOtherOnline(diff < 120000);
        setOtherLastSeen(data.last_seen);
      }
    };
    check();
    const iv = setInterval(check, 15000);
    return () => clearInterval(iv);
  }, [otherUser?.id]);

  useEffect(() => { return () => {
    if (mediaRecorder) try { mediaRecorder.stream?.getTracks().forEach(t=>t.stop()); mediaRecorder.stop(); } catch{}
    if (timerRef.current) clearInterval(timerRef.current);
    if (animRef.current) cancelAnimationFrame(animRef.current);
  }; }, []);

  useEffect(() => {
    if (!id || !user) return;
    const iv = setInterval(() => fetchReadReceipts(id, user.id), 5000);
    return () => clearInterval(iv);
  }, [id, user?.id]);

  useEffect(() => {
    if (!contextMsg && !showEmojiFor) return;
    let added = false;
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('.ctx-menu') && !t.closest('.emoji-bar') && !t.closest('.bubble')) {
        setContextMsg(null); setShowEmojiFor(null);
      }
    };
    const timeoutId = setTimeout(() => { document.addEventListener('click', close); added = true; }, 10);
    return () => {
      clearTimeout(timeoutId);
      if (added) document.removeEventListener('click', close);
    };
  }, [contextMsg, showEmojiFor]);

  const handleSendLocation = async () => {
    if (!user || !id) return;
    if (!navigator.geolocation) { toast.error('Геолокация не поддерживается'); return; }
    setSending(true);
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude, longitude } = pos.coords;
      const content = JSON.stringify({ lat: latitude, lng: longitude });
      if (conv?.is_encrypted) {
        const pw = getChatPassword(id);
        if (!pw) { setAskPassword(true); setSending(false); return; }
        const enc = await encryptMessage(content, pw, id);
        await supabase.from('messages').insert({ conversation_id: id, sender_id: user.id, content: enc.ciphertext, encrypted_iv: enc.iv, is_encrypted: true, type: 'location' });
      } else {
        await sendLocation(id, user.id, latitude, longitude);
      }
      setSending(false);
    }, err => { toast.error('Ошибка геолокации: ' + err.message); setSending(false); });
  };

  const keepComposerFocused = () => {
    const focus = () => {
      const el = composerRef.current;
      if (!el) return;
      try { el.focus({ preventScroll: true }); } catch { el.focus(); }
    };
    focus();
    requestAnimationFrame(focus);
    window.setTimeout(focus, 70);
  };

  const handleSend = async () => {
    const preserveComposerFocus = composerShouldStayOpenRef.current || document.activeElement === composerRef.current;
    if (text.trim()) haptic.tap();
    if (conv?.is_encrypted && id && text.trim() && user) {
      const pw = getChatPassword(id);
      if (!pw) { setAskPassword(true); return; }
      const encoded = encodeMentionRefs(text.trim(), selectedMentions);
      const mentionBackup = selectedMentions;
      const enc = await encryptMessage(encoded, pw, id);
      const t = text; setText(''); setSelectedMentions([]); setMentionQuery(null); if (preserveComposerFocus) keepComposerFocused();
      const { error: encErr } = await supabase.from('messages').insert({
        conversation_id: id, sender_id: user.id,
        content: enc.ciphertext, encrypted_iv: enc.iv,
        is_encrypted: true, type: 'text'
      });
      if (encErr) { toast.error('Не отправлено: ' + encErr.message); setText(t); setSelectedMentions(mentionBackup); return; }
      await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', id);
      return;
    }
    if (editingMsg && text.trim() && id) {
      const editedContent = encodeMentionRefs(text.trim(), selectedMentions);
      await supabase.from('messages').update({ content: editedContent, edited_at: new Date().toISOString() }).eq('id', editingMsg);
      setEditingMsg(null); setText(''); setSelectedMentions([]); setMentionQuery(null); if (preserveComposerFocus) keepComposerFocused(); fetchMessages(id); return;
    }
    if (!text.trim() || !user || !id || sending) return;
    const t = text.trim();
    const outgoingText = encodeMentionRefs(t, selectedMentions);
    // Command detection
    if (t === 'геолокация+' || t === 'geo+') { setText(''); setSelectedMentions([]); setMentionQuery(null); handleShareLocation(); return; }
    if (t === 'опрос+' || t === 'poll+') { setText(''); setSelectedMentions([]); setMentionQuery(null); if (conv?.is_encrypted) { toast.error('Опросы недоступны в защищённом чате'); return; } setShowAttachMenu(true); goAttachTab('poll'); return; }
    if (t === 'медиа+' || t === 'media+') {
      setText('');
      setSelectedMentions([]);
      setMentionQuery(null);
      setShowGallery(true);
      fetchMediaGallery(id).then(setGallery).catch(e => console.error('fetchMediaGallery:', e));
      return;
    }
    setText('');
    setSelectedMentions([]);
    setMentionQuery(null);
    if (preserveComposerFocus) keepComposerFocused();

    // Если активен режим (исчезающее / скрытое) — отправляем напрямую с нужными флагами,
    // не через sendMessage (он не умеет передавать expires_at / is_spoiler).
    if (pendingMode) {
      const payload: any = {
        conversation_id: id,
        sender_id: user.id,
        content: outgoingText,
        type: 'text',
      };
      if (pendingMode.type === 'ephemeral') {
        payload.expires_at = new Date(Date.now() + pendingMode.seconds * 1000).toISOString();
      }
      if (pendingMode.type === 'spoiler') {
        payload.is_spoiler = true;
      }
      if (replyTo?.id) payload.reply_to_id = replyTo.id;
      await supabase.from('messages').insert(payload);
      await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', id);
      setPendingMode(null);
      setReplyTo(null); setSending(false);
      return;
    }

    const replyId = replyTo?.id;
    setReplyTo(null);
    stuckToBottomRef.current = true;
    requestAnimationFrame(() => {
      const c = messagesContainerRef.current;
      if (c) c.scrollTop = c.scrollHeight;
    });
    void sendMessage(id, user.id, outgoingText, replyId).then(res => {
      if (res?.error) toast.error('Не отправлено: ' + res.error);
    });
  };
  const handleTyping = (v: string) => {
    // Admin trigger: +статус888 opens admin panel
    if (v.trim().toLowerCase() === '+статус888' && isOwnerEmail(user?.email)) {
      setText('');
      setShowAdminStatus(true);
      return;
    }
    setText(v);
    if (user && id && v.trim()) sendTyping(id, user.id, user.display_name);
  };

  // Выбор фото/видео → открываем превью с подписью (не отправляем сразу)
  const pickGallery = (hd = false) => {
    const input = document.createElement('input'); input.type='file'; input.accept='image/*,video/*'; input.multiple = true;
    input.onchange = () => {
      const files = Array.from(input.files || []);
      if (!files.length || !user || !id) return;
      const picked = files.slice(0, 10);
      if (files.length > 10) toast.info('Можно отправить до 10 файлов за раз');
      const oversized = picked.find(f => f.size > MAX_FILE);
      if (oversized) { toast.warning(`Макс. 50 МБ на файл: ${oversized.name}`); return; }
      if (conv?.is_encrypted && !getChatPassword(id)) { setAskPassword(true); return; }
      setShowAttachMenu(false);
      setAttachCaption('');
      setAttachDraft({ files: picked, kind: 'media', hd });
    }; input.click();
  };

  const pickVideo = () => {
    const input = document.createElement('input'); input.type='file'; input.accept='video/*'; input.multiple = true;
    input.onchange = () => {
      const files = Array.from(input.files || []);
      if (!files.length || !user || !id) return;
      const picked = files.slice(0, 10);
      if (files.length > 10) toast.info('Можно отправить до 10 файлов за раз');
      const oversized = picked.find(f => f.size > MAX_FILE);
      if (oversized) { toast.warning(`Макс. 50 МБ на файл: ${oversized.name}`); return; }
      if (conv?.is_encrypted && !getChatPassword(id)) { setAskPassword(true); return; }
      setShowAttachMenu(false);
      setAttachCaption('');
      setAttachDraft({ files: picked, kind: 'media', hd: false });
    }; input.click();
  };

  // Выбор файлов → превью с подписью
  const pickFile = () => {
    const input = document.createElement('input'); input.type='file'; input.accept='*/*'; input.multiple = true;
    input.onchange = () => {
      const files = Array.from(input.files || []); if (!files.length || !user || !id) return;
      const picked = files.slice(0, 10);
      if (files.length > 10) toast.info('Можно отправить до 10 файлов за раз');
      const oversized = picked.find(f => f.size > MAX_FILE);
      if (oversized) { toast.warning(`Макс. 50 МБ на файл: ${oversized.name}`); return; }
      if (conv?.is_encrypted && !getChatPassword(id)) { setAskPassword(true); return; }
      setShowAttachMenu(false);
      setAttachCaption('');
      setAttachDraft({ files: picked, kind: 'file', hd: false });
    }; input.click();
  };

  // Отправка выбранных вложений с подписью
  const confirmSendDraft = async () => {
    if (!attachDraft || !user || !id) return;
    const { files, kind, hd } = attachDraft;
    const caption = attachCaption.trim();
    const isEnc = conv?.is_encrypted;
    const encPwd = isEnc ? getChatPassword(id) : null;
    if (isEnc && !encPwd) { setAskPassword(true); return; }
    setAttachDraft(null);
    setSending(true);
    const extras: { is_spoiler?: boolean; expires_at?: string; caption?: string } = {};
    if (pendingMode?.type === 'spoiler') extras.is_spoiler = true;
    if (pendingMode?.type === 'ephemeral') extras.expires_at = new Date(Date.now() + pendingMode.seconds * 1000).toISOString();
    if (caption && !isEnc) extras.caption = caption; // подпись не шифруем
    const processed = kind === 'media' && !hd
      ? await Promise.all(files.map(f => f.type.startsWith('image/') ? compressImage(f) : Promise.resolve(f)))
      : files;
    try {
      if (processed.length === 1) {
        const encOpts = isEnc ? { password: encPwd as string } : undefined;
        await sendFileMessage(id, user.id, processed[0], encOpts, extras);
      } else if (isEnc) {
        for (const f of processed) await sendFileMessage(id, user.id, f, { password: encPwd as string }, extras);
      } else {
        const grouped = await sendAlbumMessage(id, user.id, processed, undefined, extras);
        if (grouped.error) throw new Error(grouped.error);
      }
    } catch (e: any) {
      console.error('confirmSendDraft error:', e);
      toast.error('Ошибка отправки: ' + (e?.message || e));
    } finally {
      setSending(false);
      setAttachCaption('');
      if (pendingMode) setPendingMode(null);
    }
  };

  // Круглое видео-сообщение
  const stopVideoCanvasLoop = () => {
    if (videoCanvasRafRef.current != null) cancelAnimationFrame(videoCanvasRafRef.current);
    videoCanvasRafRef.current = null;
    videoCanvasRef.current = null;
  };

  const buildVideoRecordStream = (source: MediaStream): MediaStream => {
    stopVideoCanvasLoop();
    videoUsesCanvasRef.current = false;

    const preview = videoPreviewRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 480;
    const capture = (canvas as HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream }).captureStream;
    const ctx = canvas.getContext('2d', { alpha: false });

    if (capture && ctx && preview) {
      try {
        const canvasStream = capture.call(canvas, 30);
        const canvasTrack = canvasStream.getVideoTracks()[0];
        const audioTrack = source.getAudioTracks()[0]?.clone();
        if (canvasTrack && audioTrack) {
          videoCanvasRef.current = canvas;
          videoUsesCanvasRef.current = true;
          const draw = () => {
            const v = videoPreviewRef.current;
            if (v && v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0) {
              const side = Math.min(v.videoWidth, v.videoHeight);
              const sx = Math.max(0, (v.videoWidth - side) / 2);
              const sy = Math.max(0, (v.videoHeight - side) / 2);
              try { ctx.drawImage(v, sx, sy, side, side, 0, 0, 480, 480); } catch { /* следующий кадр */ }
            }
            videoCanvasRafRef.current = requestAnimationFrame(draw);
          };
          videoCanvasRafRef.current = requestAnimationFrame(draw);
          return new MediaStream([canvasTrack, audioTrack]);
        }
      } catch (e) {
        console.warn('video note canvas capture unavailable:', e);
      }
    }

    // Старые браузеры: пишем исходный stream. В таком режиме смена камеры
    // выполняется только через applyConstraints, чтобы не трогать MediaRecorder tracks.
    return source;
  };

  const createVideoNoteRecorder = (recordStream: MediaStream, sourceStream: MediaStream) => {
    const candidates = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    let chosenMime = '';
    for (const m of candidates) {
      if (MediaRecorder.isTypeSupported(m)) { chosenMime = m; break; }
    }

    const rec = chosenMime
      ? new MediaRecorder(recordStream, { mimeType: chosenMime })
      : new MediaRecorder(recordStream);

    rec.ondataavailable = e => { if (e.data.size > 0) videoChunksRef.current.push(e.data); };
    rec.onstop = async () => {
      // Только актуальный recorder имеет право завершить/отправить запись.
      if (videoRecRef.current !== rec) return;
      videoRecRef.current = null;
      if (videoTimerRef.current) { clearInterval(videoTimerRef.current); videoTimerRef.current = null; }
      if (videoCanvasRafRef.current != null) cancelAnimationFrame(videoCanvasRafRef.current);
      videoCanvasRafRef.current = null;

      const actualMime = rec.mimeType || chosenMime || 'video/webm';
      const isMp4 = actualMime.toLowerCase().includes('mp4');
      const ext = isMp4 ? 'mp4' : 'webm';
      const blobMime = isMp4 ? 'video/mp4' : 'video/webm';
      const blob = new Blob(videoChunksRef.current, { type: blobMime });
      videoChunksRef.current = [];

      videoRecordStreamRef.current?.getTracks().forEach(t => t.stop());
      videoRecordStreamRef.current = null;
      sourceStream.getTracks().forEach(t => t.stop());
      if (videoStreamRef.current === sourceStream) videoStreamRef.current = null;
      videoCanvasRef.current = null;
      videoUsesCanvasRef.current = false;
      setRecordingVideo(false);
      setVideoStarting(false);
      setVideoFlipping(false);
      setVideoDur(0);

      if (blob.size < 1000) return;
      const file = new File([blob], `videonote_${Date.now()}.${ext}`, { type: blobMime });
      if (user && id) {
        setSending(true);
        const encOpts = conv?.is_encrypted ? { password: getChatPassword(id) || '' } : undefined;
        if (encOpts && !encOpts.password) { setSending(false); setAskPassword(true); return; }
        await sendFileMessage(id, user.id, file, encOpts);
        setSending(false);
      }
    };
    return rec;
  };

  const startVideoNote = async () => {
    if (recordingVideo || videoStarting) return;
    const startSeq = ++videoStartSeqRef.current;
    haptic.select();
    setVideoDur(0);
    setVideoStarting(true);
    setRecordingVideo(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: videoFacing, width: { ideal: 480 }, height: { ideal: 480 } },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } as MediaTrackConstraints,
      });

      if (startSeq !== videoStartSeqRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      if (stream.getAudioTracks().length === 0) {
        stream.getTracks().forEach(t => t.stop());
        toast.error('Микрофон недоступен. Проверьте разрешения для приложения.');
        setVideoStarting(false);
        setRecordingVideo(false);
        return;
      }

      videoStreamRef.current = stream;

      const attachPreview = () => {
        if (startSeq !== videoStartSeqRef.current) return;
        const preview = videoPreviewRef.current;
        if (!preview) { requestAnimationFrame(attachPreview); return; }
        preview.srcObject = stream;
        preview.play().catch(() => {});
        const recordStream = buildVideoRecordStream(stream);
        videoRecordStreamRef.current = recordStream;
        videoChunksRef.current = [];
        const rec = createVideoNoteRecorder(recordStream, stream);
        videoRecRef.current = rec;
        rec.start(200);
        setVideoStarting(false);

        videoTimerRef.current = setInterval(() => setVideoDur(d => {
          const next = d + 1;
          if (next >= 60) { try { if (rec.state !== 'inactive') rec.stop(); } catch {} }
          return next;
        }), 1000);
      };
      requestAnimationFrame(attachPreview);
    } catch (e: any) {
      if (startSeq !== videoStartSeqRef.current) return;
      console.error('startVideoNote:', e);
      videoRecordStreamRef.current?.getTracks().forEach(t => t.stop());
      videoRecordStreamRef.current = null;
      videoStreamRef.current?.getTracks().forEach(t => t.stop());
      videoStreamRef.current = null;
      videoRecRef.current = null;
      stopVideoCanvasLoop();
      toast.error('Нужен доступ к камере и микрофону');
      setVideoStarting(false);
      setRecordingVideo(false);
    }
  };

  const stopVideoNote = () => {
    if (videoStarting || videoFlipping || !videoRecRef.current) return;
    haptic.success();
    try { if (videoRecRef.current.state !== 'inactive') videoRecRef.current.stop(); } catch {}
  };

  const cancelVideoNote = () => {
    haptic.tap();
    videoStartSeqRef.current += 1;
    videoFlippingRef.current = false;
    setVideoFlipping(false);
    setVideoStarting(false);
    if (videoTimerRef.current) { clearInterval(videoTimerRef.current); videoTimerRef.current = null; }
    try {
      if (videoRecRef.current) videoRecRef.current.onstop = null;
      if (videoRecRef.current?.state !== 'inactive') videoRecRef.current?.stop();
    } catch {}
    videoRecordStreamRef.current?.getTracks().forEach(t => t.stop());
    videoRecordStreamRef.current = null;
    videoStreamRef.current?.getTracks().forEach(t => t.stop());
    videoStreamRef.current = null;
    videoRecRef.current = null;
    videoChunksRef.current = [];
    videoUsesCanvasRef.current = false;
    stopVideoCanvasLoop();
    setRecordingVideo(false);
    setVideoDur(0);
  };

  const flipVideoCamera = async () => {
    if (!recordingVideo || videoStarting || videoFlipping) return;
    haptic.tap();
    videoFlippingRef.current = true;
    setVideoFlipping(true);
    const newFacing: 'user' | 'environment' = videoFacing === 'user' ? 'environment' : 'user';

    try {
      const source = videoStreamRef.current;
      const oldTrack = source?.getVideoTracks()[0];
      if (!source || !oldTrack) return;

      // В fallback-режиме recorder пишет camera stream напрямую. Здесь нельзя
      // удалять/добавлять track: Safari завершит MediaRecorder. Меняем constraints
      // на том же MediaStreamTrack — запись при этом не прерывается.
      if (!videoUsesCanvasRef.current) {
        try {
          await oldTrack.applyConstraints({
            facingMode: { exact: newFacing },
            width: { ideal: 480 },
            height: { ideal: 480 },
          });
          setVideoFacing(newFacing);
          return;
        } catch {
          try {
            await oldTrack.applyConstraints({ facingMode: { ideal: newFacing } });
            setVideoFacing(newFacing);
            return;
          } catch {
            toast.error('Не удалось переключить камеру во время записи');
            return;
          }
        }
      }

      let videoConstraints: MediaTrackConstraints = {
        facingMode: { ideal: newFacing },
        width: { ideal: 480 },
        height: { ideal: 480 },
      };
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter(d => d.kind === 'videoinput');
        if (cams.length > 1) {
          const wantBack = newFacing === 'environment';
          const back = cams.find(d => /back|rear|environment/i.test(d.label));
          const front = cams.find(d => /front|user|face/i.test(d.label));
          const target = wantBack ? (back || cams[1]) : (front || cams[0]);
          if (target?.deviceId) videoConstraints = { width: { ideal: 480 }, height: { ideal: 480 }, deviceId: { exact: target.deviceId } };
        }
      } catch { /* facingMode fallback ниже */ }

      let camStream: MediaStream;
      try {
        camStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: videoConstraints });
      } catch {
        camStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: newFacing, width: { ideal: 480 }, height: { ideal: 480 } } });
      }
      const newTrack = camStream.getVideoTracks()[0];
      if (!newTrack) {
        camStream.getTracks().forEach(t => t.stop());
        return;
      }

      // Прогреваем новую камеру ДО того, как убираем старую: в записи будет максимум
      // один слегка замерший кадр, а не чёрный провал и не остановка MediaRecorder.
      const warm = document.createElement('video');
      warm.muted = true;
      warm.playsInline = true;
      warm.srcObject = camStream;
      try { await warm.play(); } catch { /* muted preview usually auto-plays */ }
      await new Promise<void>(resolve => {
        if (warm.readyState >= 2) { resolve(); return; }
        const done = () => resolve();
        warm.addEventListener('loadeddata', done, { once: true });
        window.setTimeout(done, 500);
      });

      try { source.removeTrack(oldTrack); } catch {}
      source.addTrack(newTrack);

      const preview = videoPreviewRef.current;
      if (preview) {
        preview.srcObject = source;
        try { await preview.play(); } catch {}
      }
      setVideoFacing(newFacing);

      // Старый track выключаем только после того, как новый уже находится в preview.
      requestAnimationFrame(() => requestAnimationFrame(() => { try { oldTrack.stop(); } catch {} }));
    } catch (e: any) {
      console.error('flip camera error:', e);
      toast.error('Не удалось переключить камеру');
    } finally {
      videoFlippingRef.current = false;
      window.setTimeout(() => setVideoFlipping(false), 160);
    }
  };

  const startRec = async () => {
    if (recording || recordingStarting) return;
    const startSeq = ++audioStartSeqRef.current;
    haptic.select();
    setRecording(true);
    setRecordingStarting(true);
    setRecDur(0);
    setRecBars([]);
    setRecLevel(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (startSeq !== audioStartSeqRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      audioChunks = [];
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      src.connect(analyser);
      analyserRef = analyser;

      const mt = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/mp4';
      mediaRecorder = new MediaRecorder(stream, { mimeType: mt });
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
      mediaRecorder.start(200);
      setRecordingStarting(false);
      timerRef.current = setInterval(() => setRecDur(d => d + 1), 1000);

      const updateBars = () => {
        if (!analyserRef) return;
        const freqData = new Uint8Array(analyserRef.frequencyBinCount);
        analyserRef.getByteFrequencyData(freqData);
        const timeData = new Uint8Array(analyserRef.fftSize);
        analyserRef.getByteTimeDomainData(timeData);

        let rms = 0;
        for (let i = 0; i < timeData.length; i += 1) {
          const sample = (timeData[i] - 128) / 128;
          rms += sample * sample;
        }
        rms = Math.sqrt(rms / Math.max(1, timeData.length));
        const level = Math.max(0, Math.min(1, rms * 4.6));

        const bars = Array.from({ length: 20 }, (_, i) => {
          const base = Math.max(3, freqData[(i * 1.5) | 0] / 8);
          return Math.min(28, base + level * 12);
        });

        setRecBars(bars);
        setRecLevel(prev => prev * 0.42 + level * 0.58);
        animRef.current = requestAnimationFrame(updateBars);
      };
      updateBars();
    } catch {
      if (startSeq === audioStartSeqRef.current) {
        setRecordingStarting(false);
        setRecording(false);
        setRecDur(0);
        setRecBars([]);
        setRecLevel(0);
        toast.error('Нужен доступ к микрофону');
      }
    }
  };

  const stopRec = async () => {
    if (recordingStarting || !mediaRecorder) return;
    if (timerRef.current) clearInterval(timerRef.current);
    if (animRef.current) cancelAnimationFrame(animRef.current);
    analyserRef = null; setRecordingStarting(false); setRecording(false); setRecDur(0); setRecBars([]); setRecLevel(0);
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
    return new Promise<void>(r => {
      mediaRecorder!.onstop = async () => {
        // На iOS Safari mediaRecorder.mimeType может вернуть 'video/mp4' даже когда мы пишем только аудио
        // (потому что QuickTime/MP4 — это видео-контейнер). Принудительно ставим audio/* mime — без этого
        // файл попадает в чат как видео-сообщение (черный квадрат).
        const recMime = mediaRecorder!.mimeType || '';
        const isMp4 = recMime.includes('mp4') || recMime.includes('m4a');
        const blobMime = isMp4 ? 'audio/mp4' : 'audio/webm';
        const ext = isMp4 ? '.m4a' : '.webm';
        const blob = new Blob(audioChunks, { type: blobMime });
        const file = new File([blob], 'voice_' + Date.now() + ext, { type: blobMime });
        mediaRecorder?.stream?.getTracks().forEach(t => t.stop());
        try { audioCtxRef.current?.close(); } catch {}
        audioCtxRef.current = null;
        mediaRecorder = null; audioChunks = [];
        if (user && id) {
          const encOpts3 = conv?.is_encrypted ? { password: getChatPassword(id) || '' } : undefined;
          setSending(true);
          await sendFileMessage(id, user.id, file, encOpts3);
          setSending(false);
        }
        r();
      };
      mediaRecorder!.stop();
    });
  };
  const cancelRec = () => {
    audioStartSeqRef.current += 1;
    setRecordingStarting(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (animRef.current) cancelAnimationFrame(animRef.current);
    analyserRef=null;
    if (mediaRecorder) { mediaRecorder.stream?.getTracks().forEach(t=>t.stop()); try{mediaRecorder.stop();}catch{} }
    try { audioCtxRef.current?.close(); } catch {}
    audioCtxRef.current = null;
    mediaRecorder=null; audioChunks=[]; setRecording(false); setRecDur(0); setRecBars([]); setRecLevel(0);
  };

  const doCall = (p: CallProvider) => { if (!otherUser||!showCallPicker) return; setProvider(p); startCall(otherUser, showCallPicker, id); setShowCallPicker(null); };
  const fmtRec = (s: number) => Math.floor(s/60)+':'+(s%60).toString().padStart(2,'0');
  const isMine = (m: MessageWithSender) => m.sender_id === user?.id;
  const isRead = (m: MessageWithSender) => !isMine(m) ? false : Object.values(memberReadTimes).some(t => t && t >= m.created_at);

  const fmtLastSeen = (d: string) => {
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (diff < 1) return 'в сети';
    if (diff < 60) return `был(а) ${diff} мин назад`;
    if (diff < 1440) return `был(а) ${Math.floor(diff/60)} ч назад`;
    return `был(а) ${new Date(d).toLocaleDateString()}`;
  };

  const handleShareLocation = async () => {
    setContextMsg(null);
    if (!navigator.geolocation) { toast.error('Геолокация недоступна в этом браузере'); return; }
    if (!confirm('Отправить свою геолокацию?')) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (user && id) {
          try {
            await sendLocation(id, user.id, pos.coords.latitude, pos.coords.longitude);
          } catch (e: any) { toast.error('Ошибка отправки: ' + e.message); }
        }
      },
      (err) => { toast.error('Геолокация: ' + (err.code === 1 ? 'Нет разрешения. Открой настройки браузера и разреши геолокацию для этого сайта.' : err.code === 2 ? 'Невозможно определить' : 'Таймаут. Попробуй снова.')); },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
    );
  };

  const handleCreatePoll = async () => {
    const opts = pollOpts.filter(o => o.trim());
    if (!pollQ.trim() || opts.length < 2 || !user || !id || pollSending) return;
    setPollSending(true);
    try {
      await createPoll(id, user.id, pollQ, opts);
      haptic.success();
      closeAttach();
      setTimeout(() => { setAttachTab('home'); setAttachDir('back'); setPollQ(''); setPollOpts(['','']); }, 240);
    } catch(e: any) {
      toast.error('Опрос: ' + (e.message || 'Неизвестная ошибка') + '. Проверь что таблицы polls, poll_options, poll_votes созданы в Supabase.');
    } finally {
      setPollSending(false);
    }
  };

  const renderAtt = (a: FileAttachment, mine: boolean, msgId: string, msgTime?: string, msgRead?: boolean) => {
    // Use decrypted url/name if encrypted attachment was decrypted
    const dec = (a as any).is_encrypted ? decryptedFiles[a.id] : null;
    const fileUrl = dec?.url || a.file_url;
    const fileName = dec?.name || a.file_name;
    const isEncrypted = (a as any).is_encrypted;
    const isLoading = isEncrypted && !dec;
    const isDecryptError = dec?.name === '__DECRYPT_ERROR__' || (dec?.name && /\[не удалось расшифровать\]/.test(dec.name));

    // Loading state — encrypted file being decrypted
    if (isLoading) {
      return <div className="file-att" style={{opacity:0.6}}>
        <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round'><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <div><div style={{fontSize: 'var(--fs-caption)',fontWeight:500}}>Расшифровка...</div><div style={{fontSize: 'var(--fs-micro)',color:'var(--muted)'}}>{formatFileSize(a.file_size)}</div></div>
      </div>;
    }

    // Decryption error state — simple "Зашифрованное сообщение"
    if (isDecryptError) {
      return <div className="file-att" style={{opacity:0.6}}>
        <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round'><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <div>
          <div style={{fontSize: 'var(--fs-caption)',fontWeight:500}}>Зашифрованное сообщение</div>
          <div style={{fontSize: 'var(--fs-micro)',color:'var(--muted)'}}>{formatFileSize(a.file_size)}</div>
        </div>
      </div>;
    }

    // Круглое видео-сообщение (videonote) — без controls, как в Telegram
    if (fileName?.startsWith('videonote_') || (a.mime_type?.startsWith('video/') && fileName?.match(/videonote/i))) {
      return <VideoNote src={fileUrl} msgId={msgId} title={chatName} mine={mine} />;
    }
    // Войсы ВПЕРЕДИ видео — иначе .webm с любым mime попадает в VideoPlayer и отображается чёрным квадратом
    const isVoice =
      a.mime_type?.startsWith('audio/') ||
      fileName?.startsWith('voice_') ||
      fileName?.match(/\.(m4a|ogg|mp3|opus)$/i) ||
      (fileName?.match(/\.webm$/i) && !a.mime_type?.startsWith('video/'));
    if (isVoice) {
      return <VoiceMessageAttachment url={fileUrl} msgId={msgId} title={chatName} mine={mine} />;
    }
    // Обычное видео — встроенный плеер (без .webm в регексе, потому что воисы тоже .webm)
    if (a.mime_type?.startsWith('video/') || fileName?.match(/\.(mp4|mov|m4v|avi)$/i)) {
      return <VideoPlayer src={fileUrl} time={msgTime} isMine={mine} isRead={msgRead} onMediaLoad={pinToBottomIfStuck} w={a.width} h={a.height} />;
    }
    if (a.mime_type?.startsWith('image/')) return <ChatImage src={fileUrl} onClick={() => setPreview(fileUrl)} onMediaLoad={pinToBottomIfStuck} w={a.width} h={a.height} />;
    return <div className="file-att" onClick={()=>window.open(fileUrl,'_blank')}>
      <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.5'><path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/><path d='M14 2v6h6'/></svg>
      <div><div style={{fontSize: 'var(--fs-caption)',fontWeight:500}}>{fileName}</div><div style={{fontSize: 'var(--fs-micro)',color:'var(--muted)'}}>{formatFileSize(a.file_size)}</div></div>
    </div>;
  };

  const renderReactions = (msgId: string) => {
    const msgReactions = reactions[msgId] || [];
    const grouped: Record<string, string[]> = {};
    msgReactions.forEach(r => { if (!grouped[r.emoji]) grouped[r.emoji]=[]; grouped[r.emoji].push(r.user_id); });
    const entries = Object.entries(grouped);
    const membersMap: Record<string, any> = {};
    (conv?.members || []).forEach((m: any) => {
      if (m.user) membersMap[m.user_id] = m.user;
    });
    return <div className={'msg-reactions-shell' + (entries.length ? ' has-reactions' : '')}>
      <div className="msg-reactions-clip">
        <div className='msg-reactions' onContextMenu={e=>{e.preventDefault(); e.stopPropagation(); setReactionDetailsFor(msgId);}}>
          {entries.map(([emoji, users]) => {
            const iReacted = user ? users.includes(user.id) : false;
            const avatarsToShow = users.slice(0, 3);
            return (
              <span
                key={`${emoji}-${reactionMotionVersions[`${msgId}|${emoji}`] || 0}`}
                className={'msg-reaction-chip' + (iReacted ? ' mine' : '') + (reactionMotionVersions[`${msgId}|${emoji}`] ? ' reaction-live-pop' : '')}
                onClick={e=>{e.stopPropagation(); haptic.select(); toggleReactionInstant(msgId, emoji);}}
              >
                <span className="msg-reaction-emoji">{emoji}</span>
                <span className="msg-reaction-avatars">
                  {avatarsToShow.map((uid, i) => {
                    const u = membersMap[uid];
                    if (u?.avatar_url) {
                      return <img key={uid} src={u.avatar_url} alt="" className="msg-reaction-av" style={{ marginLeft: i === 0 ? 0 : -5, zIndex: 3 - i }} />;
                    }
                    return <span key={uid} className="msg-reaction-av" style={{ marginLeft: i === 0 ? 0 : -5, zIndex: 3 - i, background:avatarColor(uid), color:'#fff', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:700 }}>{u?.display_name?.[0]?.toUpperCase() || '•'}</span>;
                  })}
                  {users.length > 3 && <span className="msg-reaction-more">+{users.length - 3}</span>}
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </div>;
  };

  const handlePollVote = async (pollId: string, optionId: string) => {
    if (!user) return;
    const before = polls[pollId];
    if (!before) return;

    const seq = (pollVoteSeqRef.current[pollId] || 0) + 1;
    pollVoteSeqRef.current[pollId] = seq;
    const previousVotes = Array.isArray(before.votes) ? before.votes : [];
    const selectedAgain = previousVotes.some((vote: any) => vote.user_id === user.id && vote.option_id === optionId);
    const optimisticVotes = previousVotes.filter((vote: any) => vote.user_id !== user.id);
    if (!selectedAgain) {
      optimisticVotes.push({
        id: `temp_vote_${Date.now()}`,
        poll_id: pollId,
        option_id: optionId,
        user_id: user.id,
      });
    }

    setPolls(previous => ({
      ...previous,
      [pollId]: { ...before, votes: optimisticVotes },
    }));

    try {
      await votePoll(pollId, optionId, user.id);
      const fresh = await fetchPoll(pollId);
      if (fresh && pollVoteSeqRef.current[pollId] === seq) {
        setPolls(previous => ({ ...previous, [pollId]: fresh }));
      }
    } catch (error) {
      console.error('votePoll:', error);
      if (pollVoteSeqRef.current[pollId] === seq) {
        setPolls(previous => ({ ...previous, [pollId]: before }));
        toast.error('Не удалось сохранить голос');
      }
    }
  };

  const renderPoll = (pollId: string) => {
    const poll = polls[pollId];
    if (!poll) return <div className="poll-loading-placeholder" aria-label="Опрос загружается"><span className="skeleton-shimmer"/><span className="skeleton-shimmer"/><span className="skeleton-shimmer"/></div>;
    const totalVotes = poll.votes?.length || 0;
    const myVote = poll.votes?.find((v:any)=>v.user_id===user?.id);
    return <div className="poll-widget-stable" style={{width:CHAT_MEDIA_METRICS.pollWidth,minHeight:CHAT_MEDIA_METRICS.pollMinHeight,boxSizing:'border-box'}} onClick={e=>e.stopPropagation()}>
      <div style={{fontWeight:600,fontSize: 'var(--fs-body)',marginBottom:10,letterSpacing:0.1}}>{poll.question}</div>
      {poll.options?.map((opt: any) => {
        const optVotes = poll.votes?.filter((v:any)=>v.option_id===opt.id).length || 0;
        const pct = totalVotes ? Math.round(optVotes/totalVotes*100) : 0;
        const voted = myVote?.option_id === opt.id;
        return <div key={opt.id} onClick={() => { void handlePollVote(poll.id, opt.id); }}
          style={{
            padding:'10px 12px',margin:'6px 0',borderRadius:10,cursor:'pointer',
            position:'relative',overflow:'hidden',
            border: voted ? '1.5px solid var(--accent)' : '1px solid var(--border)',
            background: 'var(--surface-light)',
            transition: 'border-color 0.3s ease',
          }}>
          {/* Анимированная заполняющая полоса */}
          <div style={{
            position:'absolute',left:0,top:0,bottom:0,
            width:pct+'%',
            background: voted
              ? 'rgba(127,127,127,0.28)'
              : 'rgba(127,127,127,0.12)',
            transition:'width 600ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            borderRadius: 8,
          }} />
          <div style={{position:'relative',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize: 'var(--fs-snap14)',gap:8}}>
            <span style={{display:'flex',alignItems:'center',gap:6,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {voted && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
              {opt.text}
            </span>
            <span style={{color: voted ? 'var(--accent)' : 'var(--muted)',fontWeight: voted ? 700 : 500,fontVariantNumeric:'tabular-nums',flexShrink:0}}>{pct}%</span>
          </div>
        </div>;
      })}
      <div style={{fontSize: 'var(--fs-micro)',color:'var(--muted)',marginTop:6,letterSpacing:0.2}}>
        {totalVotes} {totalVotes === 1 ? 'голос' : totalVotes < 5 ? 'голоса' : 'голосов'}
      </div>
    </div>;
  };

  const typingNames = Object.values(typingUsers).map(t=>t.name);

  // Фон чата: 1) my membership.chat_background 2) user.default_chat_background 3) null
  const myMember = conv?.members?.find((m: any) => m.user_id === user?.id) as any;
  const chatBgVal = myMember?.chat_background || (user as any)?.default_chat_background || null;
  // Обои временно отключены — давало проблемы с прозрачностью header/input на iOS PWA.
  // Picker остался в UI, но эффекта не имеет до возврата фичи через Capacitor.
  const bgCss = null as string | null;
  void chatBgVal; // suppress unused warning

  // body[data-chat-has-bg] — нужен глобальному tab-bar (он вне chat-screen) чтобы
  // тоже стать полупрозрачным. useLayoutEffect ставит атрибут ДО paint, чтобы
  // tab-bar не мигал от непрозрачного к прозрачному при открытии чата.
  // Cleanup в return снимает атрибут при выходе из чата.
  useLayoutEffect(() => {
    if (bgCss) document.body.dataset.chatHasBg = 'true';
    else delete document.body.dataset.chatHasBg;
    return () => { delete document.body.dataset.chatHasBg; };
  }, [bgCss]);

  // #19/#20 — захватываем границу непрочитанного (мой last_read_at ДО отметки прочитанным).
  // conv приходит из списка и не обновляется, пока мы в чате, поэтому держит старое значение.
  useEffect(() => {
    if (unreadBoundary !== undefined) return;
    if (!conv || !user) return;
    const m = (conv.members || []).find((x: any) => x.user_id === user.id) as any;
    setUnreadBoundary(m?.last_read_at ?? null);
  }, [conv?.id, user?.id, unreadBoundary]);

  // Первое непрочитанное (чужое сообщение после границы) среди видимых
  const firstUnreadId = (() => {
    if (unreadBoundary === undefined || !user) return null;
    const bt = unreadBoundary ? new Date(unreadBoundary).getTime() : 0;
    for (const m of currentMessages) {
      if (m.deleted_at) continue;
      const exp = (m as any).expires_at;
      if (exp && new Date(exp).getTime() <= nowTick) continue;
      if (m.sender_id !== user.id && new Date(m.created_at).getTime() > bt) return m.id;
    }
    return null;
  })();

  // Моментальная синхронизация прочтения: если чат открыт и пользователь
  // видит последние входящие сообщения, сбрасываем бейджи в списке без ожидания
  // полного refetch/realtime. Это убирает ситуацию «я уже прочитал, а список ещё считает».
  useEffect(() => {
    if (!id || !user || !currentMessages.length || loadingMessages) return;
    const lastIncoming = [...currentMessages].reverse().find(m => m.sender_id !== user.id && !(m as any).deleted_at);
    if (!lastIncoming) return;
    const c = messagesContainerRef.current;
    const dist = c ? c.scrollHeight - c.scrollTop - c.clientHeight : 0;
    if (dist > 240 && firstUnreadId) return;
    const key = `${id}:${lastIncoming.id}`;
    if (lastMarkedReadRef.current === key) return;
    lastMarkedReadRef.current = key;
    const readAt = new Date().toISOString();
    supabase
      .from('conversation_members')
      .update({ last_read_at: readAt })
      .eq('conversation_id', id)
      .eq('user_id', user.id)
      .then(() => {
        useChatStore.setState(s => {
          const conversations = s.conversations.map(cn => cn.id === id ? {
            ...cn,
            unread_count: 0,
            members: cn.members.map((m: any) => m.user_id === user.id ? { ...m, last_read_at: readAt } : m),
          } : cn);
          return { conversations, totalUnread: conversations.reduce((sum: number, cn: any) => sum + (cn.unread_count || 0), 0) };
        });
      });
  }, [id, user?.id, currentMessages.length, loadingMessages, firstUnreadId]);

  return (
    <div className={'chat-screen' + (composerHidden ? ' composer-is-hidden' : '') + (contextMsg ? ' context-open' : '') + (pendingMode ? ' pending-mode-active' : '') + (replyTo ? ' reply-active' : '')} data-has-bg={bgCss ? 'true' : undefined}
      onDragOver={(e)=>{ if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={(e)=>{ if (e.currentTarget === e.target) setDragOver(false); }}
      onDrop={onChatDrop}
    >
      {dragOver && (
        <div className="drop-overlay" onDragLeave={()=>setDragOver(false)}>
          <div className="drop-overlay-box">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <div style={{ fontSize:'var(--fs-heading)', fontWeight:600, color:'var(--text)' }}>Отпустите, чтобы прикрепить</div>
          </div>
        </div>
      )}
      {bgCss && <div className="chat-bg-layer" style={{ background: bgCss }} aria-hidden="true" />}
      {!isOnline && (
        <div style={{
          background: '#E74C3C', color: '#fff', padding: '5px 12px',
          textAlign: 'center', fontSize: 'var(--fs-micro)', fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          flexShrink: 0,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39"/></svg>
          Оффлайн
        </div>
      )}
      <div className="chat-hdr">
        <button className="back-btn dt-hide" onClick={()=>nav('/chats')}><svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'><path d='M15 18l-6-6 6-6'/></svg></button>
        {!conv && !otherUser && (
          <>
            <div className="skeleton-shimmer" style={{width:40,height:40,borderRadius:20,flexShrink:0}} />
            <div className="skeleton-shimmer" style={{width:120,height:14,borderRadius:7,flexShrink:0}} />
          </>
        )}
        {isSavedChat && (
          <div className="av av-40" style={{background:'var(--text)',color:'var(--bg)',flexShrink:0}} aria-hidden="true">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 4.8A2.8 2.8 0 0 1 8.8 2h6.4A2.8 2.8 0 0 1 18 4.8V22l-6-3.8L6 22V4.8Z"/>
            </svg>
          </div>
        )}
        {conv?.type === 'group' && (
          <button
            type="button"
            className="chat-header-avatar-btn"
            onClick={() => setShowGroupInfo(true)}
            aria-label="Открыть информацию о группе"
          >
            {conv.avatar_url
              ? <img src={conv.avatar_url} alt="" className="chat-header-avatar" />
              : <span className="av av-40" style={{background:avatarColor(conv.id)}}>{(chatName[0] || 'Г').toUpperCase()}</span>}
          </button>
        )}
        {conv?.type === 'direct' && otherUser && <div style={{cursor:'pointer'}} onClick={()=>setShowUserProfile(true)}>{otherUser.avatar_url
          ? <div style={{position:'relative'}}><img src={otherUser.avatar_url} alt="" style={{width:40,height:40,borderRadius:20,objectFit:'cover'}} />{otherOnline&&<div className="online-dot-pulse" style={{position:'absolute',bottom:-1,right:-1,width:11,height:11,borderRadius:6,background:'var(--success)',border:'2px solid var(--bg)'}} />}</div>
          : <div style={{position:'relative'}}><div className="av av-40" style={{background:avatarColor(otherUser.id)}}>{chatName[0]?.toUpperCase()}</div>{otherOnline&&<div className="online-dot-pulse" style={{position:'absolute',bottom:-1,right:-1,width:11,height:11,borderRadius:6,background:'var(--success)',border:'2px solid var(--bg)'}} />}</div>
        }</div>}
        <div style={{flex:1,minWidth:0,cursor:(!isSavedChat && (conv?.type==='group'||conv?.type==='direct'))?'pointer':'default'}} onClick={()=>{
          if (isSavedChat) return;
          if (conv?.type==='group') setShowGroupInfo(true);
          else if (conv?.type==='direct') setShowUserProfile(true);
        }}>
          <div className="h-name">{conv?.is_encrypted && <svg className="h-lock" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}{chatName}{conv?.type==='group'&&<span style={{color:'var(--muted)',fontSize: 'var(--fs-caption)',marginLeft:6}}>{conv.members.length}</span>}{conv?.type==='direct' && otherUser?.custom_status_text && <span style={{color:otherUser.custom_status_color || 'var(--muted)',fontSize: 'var(--fs-micro)',marginLeft:6,fontWeight:600,letterSpacing:0.3}}>{otherUser.custom_status_text}</span>}</div>
          {(() => {
            const statusKey = typingNames.length > 0 ? `typing-${typingNames.join(',')}` : (otherLastSeen ? `lastseen-${otherOnline}` : 'none');
            const content = isSavedChat ? (
              <div style={{fontSize:'var(--fs-micro)',color:'var(--muted)'}}>Личное хранилище</div>
            ) : typingNames.length > 0 ? (
              <div className="typing-indicator" style={{display:'flex',alignItems:'center',gap:4}}>
                <span>{typingNames.join(', ')} печатает</span>
                <span className="typing-dots"><span/><span/><span/></span>
              </div>
            ) : conv?.type==='direct' && otherLastSeen ? (
              <div style={{fontSize: 'var(--fs-micro)',color:otherOnline?'var(--success)':'var(--muted)'}}>{fmtLastSeen(otherLastSeen)}</div>
            ) : null;
            // Резервируем высоту строки статуса для личных чатов: иначе при асинхронной
            // подгрузке «был(а)…»/«печатает» шапка вырастает и имя визуально съезжает.
            return (
              <div style={{ minHeight: (conv?.type === 'direct' || isSavedChat) ? 15 : 0 }}>
                {content ? <div key={statusKey} className="anim-fade-in">{content}</div> : null}
              </div>
            );
          })()}
        </div>
        <div className="hdr-actions">
          <button onClick={()=> searchOpen ? closeSearch() : setSearchOpen(true)} aria-label="Поиск в чате"><svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'><circle cx='11' cy='11' r='8'/><path d='m21 21-4.35-4.35'/></svg></button>
          {!isSavedChat && <>
            <button onClick={()=>{
              if (conv?.type === 'group' && conv?.members) {
                const participants = conv.members.map((m:any) => m.user).filter(Boolean);
                startGroupCall(conv.id, conv.name || 'Групповой звонок', participants, 'audio');
              } else if (otherUser) {
                startCall(otherUser, 'audio', id);
              }
            }}><svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8'><path d='M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z'/></svg></button>
            <button onClick={()=>{
              if (conv?.type === 'group' && conv?.members) {
                const participants = conv.members.map((m:any) => m.user).filter(Boolean);
                startGroupCall(conv.id, conv.name || 'Групповой звонок', participants, 'video');
              } else if (otherUser) {
                startCall(otherUser, 'video', id);
              }
            }}><svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8'><path d='M23 7l-7 5 7 5V7z'/><rect x='1' y='5' width='15' height='14' rx='2' ry='2'/></svg></button>
          </>}
        </div>
      </div>

      {searchOpen && (
        <div className="chat-search-bar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input autoFocus value={searchQuery} onChange={e=>onSearchChange(e.target.value)} placeholder="Поиск в чате" onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); searchStep(-1); } if(e.key==='Escape'){ closeSearch(); } }} />
          {searchQuery.trim() && <span className="csb-count">{searchResults.length ? (searchIdx+1)+'/'+searchResults.length : '0/0'}</span>}
          <button className="csb-nav" disabled={!searchResults.length} onClick={()=>searchStep(-1)} aria-label="Предыдущее"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg></button>
          <button className="csb-nav" disabled={!searchResults.length} onClick={()=>searchStep(1)} aria-label="Следующее"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>
          <button className="csb-nav" onClick={closeSearch} aria-label="Закрыть"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
        </div>
      )}

      {/* Идёт звонок — присоединиться */}
      {!isSavedChat && id && conv && (
        <CallJoinBar conversationId={id} conversationName={conv.name || otherUser?.display_name || 'Звонок'} />
      )}

      {/* Pinned messages — карусель (Telegram-style) */}
      {pinnedActive && (
        <div
          className="pinned-bar pinned-bar-enter"
          onClick={() => { flashMessage(pinnedActive.id); if (pinnedMsgs.length > 1) setPinnedActiveIdx((Math.min(pinnedActiveIdx, pinnedMsgs.length - 1) + 1) % pinnedMsgs.length); }}
        >
          <svg className="pinned-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="17" x2="12" y2="22"/>
            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
          </svg>
          {pinnedMsgs.length > 1
            ? <div className="pinned-bars">{pinnedMsgs.map((_, i) => <div key={i} className={'pinned-tick' + (i === Math.min(pinnedActiveIdx, pinnedMsgs.length - 1) ? ' active' : '')} />)}</div>
            : <div className="pinned-accent" />}
          <div className="pinned-content">
            <div className="pinned-title">{pinnedMsgs.length > 1 ? `Закреплённое ${Math.min(pinnedActiveIdx, pinnedMsgs.length - 1) + 1}/${pinnedMsgs.length}` : 'Закреплённое сообщение'}</div>
            <div className="pinned-text">
              {pinnedActive.is_encrypted ? (decryptedMap[pinnedActive.id] || 'Защищено ···') : msgPreview(pinnedActive, decryptedMap[pinnedActive.id])}
            </div>
          </div>
          <button
            className="pinned-close"
            onClick={e => { e.stopPropagation(); if (user && id) { togglePinMessage(id, pinnedActive.id, user.id); setPinnedActiveIdx(i => Math.min(i, Math.max(0, pinnedMsgs.length - 2))); } }}
            aria-label="Открепить"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {uploadProgress > 0 && uploadProgress < 100 && <div className="progress-bar"><div className="progress-fill" style={{width:uploadProgress+'%'}} /></div>}

      {contextMsg && <div className="message-context-scrim" onClick={() => setContextMsg(null)} aria-hidden="true" />}

      {(() => {
        return (
          <div className={'messages'+(contextMsg?' menu-open':'')+(historyPrepending?' history-prepending':'')} ref={messagesContainerRef} onScroll={onMessagesScroll} style={{ visibility: (!currentMessages.length || loadingMessages || initialMessagesReady) ? 'visible' : 'hidden' }}>
        {conv?.is_encrypted && !loadingMessages && (
          <div className="enc-banner"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Сообщения защищены сквозным шифрованием</div>
        )}
        {loadingMessages && currentMessages.length === 0 && (
          <div className="msg-skeletons">
            {[
              { mine: false, w: 70 },
              { mine: false, w: 50 },
              { mine: true, w: 60 },
              { mine: false, w: 80 },
              { mine: true, w: 45 },
              { mine: false, w: 55 },
              { mine: true, w: 70 },
              { mine: false, w: 40 },
            ].map((sk, i) => (
              <div key={i} className={`msg-skel ${sk.mine ? 'msg-skel-mine' : 'msg-skel-other'}`} style={{ width: `${sk.w}%` }} />
            ))}
            <style>{`
              .msg-skeletons {
                display: flex; flex-direction: column; gap: 6px;
                padding: 12px 14px;
              }
              .msg-skel {
                height: 36px;
                border-radius: 14px;
                background: linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 100%);
                background-size: 200% 100%;
                animation: msgSkelShimmer 1.4s ease-in-out infinite;
              }
              .msg-skel-mine {
                align-self: flex-end;
                border-bottom-right-radius: 4px;
              }
              .msg-skel-other {
                align-self: flex-start;
                border-bottom-left-radius: 4px;
              }
              @keyframes msgSkelShimmer {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
              }
            `}</style>
          </div>
        )}
        {!loadingMessages && currentMessages.length === 0 && (
          <div className="empty">
            {isSavedChat ? (
              <div className="empty-av empty-av-ph" style={{background:'var(--text)',color:'var(--bg)'}}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4.8A2.8 2.8 0 0 1 8.8 2h6.4A2.8 2.8 0 0 1 18 4.8V22l-6-3.8L6 22V4.8Z"/></svg>
              </div>
            ) : conv?.is_encrypted ? (
              <div className="empty-av empty-av-lock">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
            ) : conv?.type === 'direct' && otherUser ? (
              otherUser.avatar_url
                ? <img className="empty-av" src={otherUser.avatar_url} alt="" />
                : <div className="empty-av empty-av-ph">{(otherUser.display_name?.[0] || '?').toUpperCase()}</div>
            ) : (
              <div className="empty-av empty-av-ph">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
            )}
            <span className="e-title">{isSavedChat ? 'Избранное' : (conv?.is_encrypted ? 'Защищённый чат' : (conv?.type === 'direct' && otherUser ? `Напишите ${(otherUser.display_name || '').split(' ')[0]} первым` : 'Начните общение'))}</span>
            <span className="e-sub">{isSavedChat ? 'Сохраняйте здесь сообщения, ссылки, фото, видео и файлы — этот чат виден только вам' : (conv?.is_encrypted ? 'Сообщения зашифрованы сквозным шифрованием — их видите только вы двое' : 'Здесь появятся ваши сообщения')}</span>
          </div>
        )}

        {currentMessages
          .filter(m => {
            // Удалённые сообщения не показываем вообще (раньше был placeholder «Сообщение удалено»)
            if (m.deleted_at) return false;
            // Скрываем истёкшие исчезающие сообщения. nowTick меняется каждые 10с,
            // вызывая ре-рендер — сообщения исчезают почти в реальном времени.
            const exp = (m as any).expires_at;
            if (!exp) return true;
            return new Date(exp).getTime() > nowTick;
          })
          .map((m, i, arr) => {
          const mine=isMine(m); const deleted=!!m.deleted_at; const read=isRead(m);
          const showDate = i===0||new Date(m.created_at).toDateString()!==new Date(arr[i-1].created_at).toDateString();
          const showName = !mine&&(i===0||!arr[i-1]||arr[i-1].sender_id!==m.sender_id);
          const continuation = i>0 && !!arr[i-1] && arr[i-1].sender_id===m.sender_id && !showDate && (arr[i-1] as any).type!=='system' && (m as any).type!=='system';
          const showUnread = m.id === firstUnreadId;
          const unreadDivider = showUnread ? <div data-unread-divider className="unread-divider"><span>Непрочитанные</span></div> : null;
          const hasAtt = m.attachments?.length>0;
          const pendingAttachment = inferPendingAttachment(m);
          // Альбом — несколько медиа-вложений в одном сообщении
          const mediaAtts = hasAtt ? m.attachments.filter((a: any) => a?.mime_type?.startsWith('image/') || a?.mime_type?.startsWith('video/')) : [];
          const isAlbum = String(m.type) === 'album' || pendingAttachment === 'album';
          const isImg = (hasAtt&&!isAlbum&&m.attachments[0]?.mime_type?.startsWith('image/')) || pendingAttachment === 'image';
          const isRoundVid = pendingAttachment === 'videonote' || (hasAtt && !isAlbum && (() => {
            const att0 = m.attachments[0] as any;
            const decName = att0?.is_encrypted ? decryptedFiles[att0.id]?.name : null;
            const name = decName || att0?.file_name || '';
            return name.startsWith('videonote_') || (att0?.mime_type?.startsWith('video/') && name.match(/videonote/i));
          })());
          const isVid = pendingAttachment === 'video' || (hasAtt && !isRoundVid && !isAlbum && (() => {
            const att0 = m.attachments[0] as any;
            const decName = att0?.is_encrypted ? decryptedFiles[att0.id]?.name : null;
            const name = decName || att0?.file_name || '';
            // Аудио (войсы) — НЕ видео, даже если расширение .webm
            if (att0?.mime_type?.startsWith('audio/')) return false;
            if (name.startsWith('voice_')) return false;
            return att0?.mime_type?.startsWith('video/') || /\.(mp4|mov|m4v|avi)$/i.test(name);
          })());

          if (m.type === 'call') {
            return (
              <div key={(m as any).client_id || m.id} id={'msg-'+m.id} className="msg-appear call-message-wrap">
                {showDate && <div className="msg-date"><span>{fmtDate(m.created_at)}</span></div>}
                {unreadDivider}
                <div className={'msg-row' + (mine ? ' mine' : '')}>
                  <CallMessageCard
                    message={m}
                    currentUserId={user?.id || ''}
                    conversationId={id || m.conversation_id}
                    conversationName={conv?.name || otherUser?.display_name || 'Звонок'}
                  />
                </div>
              </div>
            );
          }

          if (m.type === 'system') {
            // Общая обёртка для всех виджет-сообщений — даёт возможность удалить
            // (видимая ⋮ кнопка в углу для своих + double-tap/long-press фолбэк).
            // Раньше виджеты были вне .bubble и не имели контекстного меню.
            const renderWidgetWrap = (child: any) => (
              <div key={(m as any).client_id || m.id}
                id={'msg-'+m.id}
                className={'msg-appear widget-message' + (contextMsg === m.id ? ' menu-active' : '')}
                style={{display:'flex', flexDirection:'column', alignItems: mine ? 'flex-end' : 'flex-start', padding:'8px 12px', position:'relative'}}
                onContextMenu={e => { e.preventDefault(); setContextMsg(m.id); }}
              >
                {showDate && <div className="msg-date" style={{marginBottom:6, width:'100%', textAlign:'center'}}><span>{fmtDate(m.created_at)}</span></div>}
                {unreadDivider}
                <div className={undefined} style={{position:'relative', maxWidth:'100%'}}>
                  {child}
                  {/* Видимая ⋮ кнопка для своих виджетов */}
                  {mine && (
                    <button
                      id={'msg-menu-anchor-'+m.id}
                      onClick={(e) => { e.stopPropagation(); setContextMsg(contextMsg === m.id ? null : m.id); }}
                      aria-label="Меню сообщения"
                      style={{
                        position:'absolute', top:6, right:6, zIndex:3,
                        width:'28px', height:'28px', borderRadius:'50%',
                        aspectRatio:'1 / 1', boxSizing:'border-box', padding:0,
                        background:'rgba(0,0,0,0.45)', border:'none', color:'#fff',
                        cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                        backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)',
                        flexShrink:0,
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
                    </button>
                  )}
                  {contextMsg === m.id && (
                    <MessageContextPortal
                      messageId={m.id}
                      mine={mine}
                      anchorId={mine ? 'msg-menu-anchor-'+m.id : undefined}
                      className="ctx-menu-widget"
                    >
                      <button onClick={()=>{ setContextMsg(null); haptic.tap(); setReplyTo(m); }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                        Ответить
                      </button>
                      <button onClick={()=>{ setContextMsg(null); haptic.tap(); if (id && user) { togglePinMessage(id, m.id, user.id); } }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>
                        {pinnedIds.includes(m.id) ? 'Открепить' : 'Закрепить'}
                      </button>
                      {!(m as any).is_encrypted && (
                        <button onClick={()=>{ setContextMsg(null); haptic.tap(); setForwardMsgs([m]); }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/></svg>
                          Поделиться
                        </button>
                      )}
                      {mine && (
                        <button className="ctx-danger" onClick={async()=>{
                          setContextMsg(null);
                          if (!confirm('Удалить?')) return;
                          try {
                            await deleteMessage(m.id);
                            if (user) await fetchConversations(user.id);
                          } catch (e:any) { toast.error('Не удалось: ' + (e?.message||'ошибка')); }
                        }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                          Удалить
                        </button>
                      )}
                    </MessageContextPortal>
                  )}
                </div>
              </div>
            );

            // Проверяем — это маркер аукциона?
            if (m.content?.startsWith('[AUCTION:')) {
              const auctionId = m.content.slice('[AUCTION:'.length, -1);
              const auc = auctionsMap[auctionId];
              if (auc) {
                return renderWidgetWrap(<AuctionCard auction={auc} />);
              }
              return renderWidgetWrap(<SkeletonWidgetCard variant="auction" />);
            }
            // Tinder ставка
            if (m.content?.startsWith('[TINDER_BET:')) {
              const betId = m.content.slice('[TINDER_BET:'.length, -1);
              return renderWidgetWrap(<TinderBetCard betId={betId} />);
            }
            // Событие
            if (m.content?.startsWith('[EVENT:')) {
              const eventId = m.content.slice('[EVENT:'.length, -1);
              return renderWidgetWrap(<EventCard eventId={eventId} />);
            }
            // Старые статичные тиндер-карточки убраны (реворк на полноценный виджет)
            if (m.content?.startsWith('[TINDER:')) {
              return null;
            }
            if (m.content?.startsWith('[CHESS:')) {
              const gameId = m.content.slice('[CHESS:'.length, -1);
              return renderWidgetWrap(<ChessInviteCard gameId={gameId} />);
            }
            return <div key={(m as any).client_id || m.id}>{showDate&&<div className="msg-date"><span>{fmtDate(m.created_at)}</span></div>}{unreadDivider}<div className="msg-date" style={{margin:'4px 0'}}><span>{m.content}</span></div></div>;
          }

          const optimisticMessage = String(m.id).startsWith('temp_') || ['sending', 'queued'].includes(String((m as any).status || ''));
          return <div key={(m as any).client_id || m.id} id={'msg-'+m.id} className={'msg-appear'+(contextMsg===m.id?' menu-active':'')+(continuation?' cont':'')+(mine&&optimisticMessage?' msg-send-flight':'')}>
            {showDate && <div className="msg-date"><span>{fmtDate(m.created_at)}</span></div>}
            {unreadDivider}
            <SwipeReplyRow
              side={mine ? 'left' : 'right'}
              disabled={deleted || selectMode}
              onReply={() => setReplyTo(m)}
            >
            <div className={'msg-row'+(mine?' mine':'')+(selectMode?' select-mode':'')+(selectedIds.includes(m.id)?' selected':'')+(contextMsg===m.id?' menu-active-row':'')} onContextMenu={e=>{e.preventDefault(); if(!selectMode) setContextMsg(m.id);}} onClickCapture={(e)=>{ if(selectMode){ e.stopPropagation(); e.preventDefault(); toggleSelect(m.id); } }}>
              {selectMode && <div className="select-check">{selectedIds.includes(m.id) ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> : null}</div>}
              <div className={'bubble '+(mine?'sent':'recv')+(isRoundVid?' bubble-vnote':'')+((isImg||isVid||isAlbum)&&!m.content&&!m.reply_to?' bubble-img':'')+(isAlbum?' bubble-album':'')+(m.type==='location'&&!m.reply_to?' bubble-location':'')} onClick={()=>handleMessageTap(m.id)}>
                {showName&&m.sender&&<div className="b-sender">{m.sender.display_name}</div>}
                {m.reply_to && !deleted && (
                  <div
                    className="reply-quote"
                    onClick={(e) => {
                      e.stopPropagation();
                      flashMessage((m.reply_to as any).id);
                    }}
                  >
                    <div className="reply-quote-content">
                      <div className="rq-name">{(m.reply_to as any)?.sender?.display_name || ''}</div>
                      <div className="rq-text">{(m.reply_to as any)?.is_encrypted ? (decryptedMap[(m.reply_to as any).id] || 'Защищено ···') : msgPreview(m.reply_to)}</div>
                    </div>
                  </div>
                )}
                {!deleted && (m as any).story_reply_snapshot && (
                  <StoryReplyPreview snapshot={(m as any).story_reply_snapshot as StoryReplySnapshot} mine={mine} />
                )}
                {!deleted && (m as any).forwarded_from_name && (
                  <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:3, fontSize: 'var(--fs-caption)', fontWeight:600, color: mine ? 'rgba(255,255,255,0.85)' : 'var(--accent)' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/></svg>
                    Переслано от {(m as any).forwarded_from_name}
                  </div>
                )}
                {deleted ? <div className="deleted-msg">Сообщение удалено</div> : <>
                  {m.type==='location'&&renderLocation(m.id, m.content, mine, fmtTime(m.created_at), read)}
                  {m.type==='poll'&&renderPoll(m.content)}
                  {!hasAtt && pendingAttachment && <PendingAttachmentPlaceholder kind={pendingAttachment} albumCount={pendingAttachment === 'album' ? Number(String(m.content || '').match(/\d+/)?.[0] || 2) : undefined} />}
                  {hasAtt && (() => {
                    const isSpoiler = (m as any).is_spoiler;
                    const revealed = revealedSpoilers.has(m.id);
                    const inner = (
                      <>
                        {isAlbum && <MediaGrid items={mediaAtts as any} onImageClick={(url)=>setPreview(url)} />}
                        {!isAlbum && m.attachments.length > 1 && (
                          <div className="attachment-group-list" aria-label={`Вложения: ${m.attachments.length}`}>
                            {m.attachments.map((a:any,idx:number)=>(
                              <div className="attachment-group-row" key={a.id||idx}>{renderAtt(a,mine,m.id,idx===m.attachments.length-1?fmtTime(m.created_at):undefined,read)}</div>
                            ))}
                          </div>
                        )}
                        {!isAlbum && m.attachments.length <= 1 && renderAtt(m.attachments[0],mine,m.id,fmtTime(m.created_at),read)}
                      </>
                    );
                    if (isSpoiler) {
                      return (
                        <div
                          className={`spoiler-media${revealed ? ' is-revealed' : ''}`}
                          onClick={(e)=>{
                            if (revealed) return;
                            e.stopPropagation();
                            setRevealedSpoilers(s=>new Set([...s,m.id]));
                          }}
                          title={revealed ? undefined : 'Тап чтобы открыть'}
                        >
                          <div className="spoiler-media-content">{inner}</div>
                          <div className="spoiler-media-cover" aria-hidden={revealed}>
                            <span className="spoiler-eye-orb">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                            </span>
                            <span>Нажми, чтобы открыть</span>
                          </div>
                        </div>
                      );
                    }
                    return inner;
                  })()}
                  {hasAtt && m.content && !(m as any).is_encrypted && !isMediaAutoLabel(m.content) && !m.attachments.some((attachment: any) => String(attachment?.file_name || '') === String(m.content || '')) && (
                    <div style={{marginTop:6, fontSize: 'var(--fs-body)', lineHeight:1.35, wordBreak:'break-word', overflowWrap:'anywhere'}}>{renderLinkifiedText(m.content)}</div>
                  )}
                  {!pendingAttachment&&m.type!=='location'&&m.type!=='poll'&&m.type!=='file'&&(!isImg||!hasAtt)&&!isRoundVid&&!isVid&&!isAlbum&&m.type!=='voice'&&m.content&&(() => {
                    const isSpoiler = (m as any).is_spoiler;
                    const revealed = revealedSpoilers.has(m.id);
                    const renderContent = () => {
                      const isEnc = (m as any).is_encrypted;
                      if (!isEnc) return renderLinkifiedText(m.content);
                      const dec = decryptedMap[m.id];
                      if (dec === '__DECRYPT_ERROR__' || (dec && /\[не удалось расшифровать\]/.test(dec))) {
                        return <span className="dec-err" onClick={(e)=>{e.stopPropagation(); if(id){clearChatPassword(id);} setDecryptedMap({}); setDecryptedFiles({}); setAskPassword(true); setPwError('Введите пароль ещё раз');}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Не удалось расшифровать — нажмите, чтобы ввести пароль</span>;
                      }
                      if (dec) return renderLinkifiedText(dec);
                      return <em style={{color:'var(--muted)',opacity:0.5}}>Расшифровка...</em>;
                    };
                    const ejN = !(m as any).is_encrypted ? emojiOnlyCount(m.content || '') : 0;
                    const jumbo = ejN > 0 && ejN <= 3 ? (ejN === 1 ? 56 : ejN === 2 ? 46 : 38) : 0;
                    if (isSpoiler) {
                      return (
                        <span
                          className={`spoiler-text${revealed ? ' is-revealed' : ''}`}
                          onClick={(e)=>{
                            if (revealed) return;
                            e.stopPropagation();
                            setRevealedSpoilers(s=>new Set([...s,m.id]));
                          }}
                          title={revealed ? undefined : 'Тап чтобы открыть'}
                          style={jumbo ? { fontSize: jumbo, lineHeight: 1.1 } : undefined}
                        >
                          {renderContent()}
                        </span>
                      );
                    }
                    return <span style={{wordBreak:'break-word',overflowWrap:'anywhere', ...(jumbo ? { fontSize: jumbo, lineHeight: 1.1, display: 'inline-block' } : {})}}>{renderContent()} </span>;
                  })()}
                  {/* Превью ссылки если есть URL в тексте */}
                  {!deleted && m.type !== 'location' && m.type !== 'poll' && m.type !== 'voice' && !(m as any).is_encrypted && (() => {
                    const url = (m as any).is_encrypted ? null : extractUrl(m.content || '');
                    return url ? <LinkPreview url={url} isMine={mine} onLayoutChange={pinToBottomIfStuck} /> : null;
                  })()}
                </>}
                {renderReactions(m.id)}
                {!(m.type==='location' || isVid) && <span className="b-time">{fmtTime(m.created_at)}{(m as any).edited_at && !deleted && <span style={{marginLeft:4,opacity:0.6,fontStyle:'italic'}}>изм.</span>}{(m as any).expires_at&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{marginLeft:4,opacity:0.6}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}{(m as any).is_spoiler&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{marginLeft:4,opacity:0.6}}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>}{(m as any).is_encrypted&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{marginLeft:4,opacity:0.6}}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}{mine&&!deleted&&((m as any).status==='sending'||(m as any).status==='queued'?<svg className="msg-pend" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{marginLeft:4,opacity:0.55}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>:(m as any).status==='failed'?<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{marginLeft:4}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>:<span className="checks"><ReadChecks read={read} size={12} /></span>)}</span>}{mine&&!deleted&&(m as any).status==='failed'&&<button className="send-retry" onClick={(e)=>{e.stopPropagation();retrySend(m);}}>Не отправлено · Повторить</button>}
              </div>

              {contextMsg===m.id&&<MessageContextPortal messageId={m.id} mine={mine}>
                {!deleted && <button onClick={()=>{ setContextMsg(null); setReplyTo(m); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                  Ответить
                </button>}
                {m.type==='text' && !!m.content && <button onClick={()=>{ setContextMsg(null); try { navigator.clipboard?.writeText(stripMentionTokens(m.content || '')); toast.success('Скопировано'); } catch { /* no-op */ } }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  Копировать
                </button>}
                <button onClick={()=>{ enterSelect(m.id); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                  Выбрать
                </button>
                {mine && conv?.type==='group' && !deleted && <button onClick={()=>{ setContextMsg(null); setReadByFor(m.id); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  Прочитали
                </button>}
                <button onClick={()=>{setContextMsg(null);if(id&&user){togglePinMessage(id,m.id,user.id);}}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>
                  {pinnedIds.includes(m.id) ? 'Открепить' : 'Закрепить'}
                </button>
                {!deleted && !(m as any).is_encrypted && <button onClick={()=>{ setContextMsg(null); setForwardMsgs([m]); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/></svg>
                  Переслать
                </button>}
                {mine&&m.type==='text'&&<button onClick={()=>{setContextMsg(null);setEditingMsg(m.id);setText(stripMentionTokens(m.content));setSelectedMentions(getMentionRefs(m.content));setMentionQuery(null)}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  Редактировать
                </button>}
                {mine&&!deleted&&<button className="ctx-danger" onClick={async()=>{
                  setContextMsg(null);
                  if(!confirm('Удалить сообщение?'))return;
                  try{
                    await deleteMessage(m.id);
                    if(user)await fetchConversations(user.id);
                  }catch(e:any){toast.error('Не удалось удалить: '+(e?.message||'ошибка'))}
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
                  Удалить
                </button>}
              </MessageContextPortal>}

              {showEmojiFor===m.id&&<div className="emoji-bar">{EMOJIS.map(e=><span key={e} className="reaction-emoji-pop" onClick={()=>{haptic.select();toggleReactionInstant(m.id,e);setShowEmojiFor(null)}} style={{fontSize: 'var(--fs-title)',cursor:'pointer',padding:4}}>{e}</span>)}<span className="reaction-emoji-pop" onClick={(e)=>{e.stopPropagation(); setShowEmojiFor(null); setReactionSheetY(0); setReactionPickerFor(m.id);}} style={{cursor:'pointer',padding:4,display:'inline-flex',alignItems:'center'}} aria-label="Ещё эмодзи"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg></span></div>}
            </div>
            </SwipeReplyRow>
            {m.id === lastReadOwnId && conv?.type==='direct' && otherUser && (
              <div className="read-avatar-row">
                {otherUser.avatar_url
                  ? <img src={otherUser.avatar_url} className="read-avatar" alt="" />
                  : <div className="read-avatar read-avatar-ph" style={{background:avatarColor(otherUser.id)}}>{chatName[0]?.toUpperCase()}</div>}
              </div>
            )}
          </div>;
        })}
        <div ref={msgEnd} className="messages-end-anchor" />
      </div>
        );
      })()}

      {contextMsg && <div className="message-context-overlay" onClick={()=>setContextMsg(null)} aria-hidden="true" />}

      {showScrollDown && (
        <button className="scroll-down-btn" onClick={() => { stuckToBottomRef.current = true; setNewMsgCount(0); setShowScrollDown(false); msgEnd.current?.scrollIntoView({ behavior: 'smooth' }); }} aria-label="Вниз">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          {newMsgCount > 0 && <span className="scroll-down-badge">{newMsgCount > 99 ? '99+' : newMsgCount}</span>}
        </button>
      )}

      {selectMode && (
        <div className="select-toolbar">
          <button className="st-icon" onClick={exitSelect} aria-label="Отмена">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
          <span className="st-count">{selectedIds.length}</span>
          <div style={{ flex:1 }} />
          <button className="st-action" onClick={forwardSelected} disabled={!selectedIds.length}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/></svg>
            Переслать
          </button>
          <button className="st-action st-danger" onClick={deleteSelected} disabled={!selectedIds.length}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            Удалить
          </button>
        </div>
      )}

      {replyTo && (
        <div className="reply-bar reply-bar-enter">
          <svg className="reply-bar-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 17 4 12 9 7" />
            <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
          </svg>
          <div className="reply-bar-accent" />
          <div className="reply-bar-content">
            <div className="reply-bar-name">В ответ {replyTo.sender?.display_name || ''}</div>
            <div className="reply-bar-text">{msgPreview(replyTo, decryptedMap[replyTo.id])}</div>
          </div>
          <button
            className="reply-bar-close"
            onClick={() => setReplyTo(null)}
            aria-label="Отменить ответ"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Чип режима «следующее сообщение исчезающее / скрытое» */}
      {pendingMode && (
        <div className="pending-mode-chip" style={{
          display: 'flex', alignItems: 'center', gap: 11,
          padding: '9px 14px',
          background: 'var(--surface-light)',
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
          fontSize: 'var(--fs-label)', color: 'var(--text)',
        }}>
          <span style={{ width: 30, height: 30, borderRadius: 15, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--text)' }}>
            {pendingMode.type === 'ephemeral' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-8-10-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            )}
          </span>
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
            <span style={{ fontWeight: 700 }}>
              {pendingMode.type === 'ephemeral' ? 'Исчезающее сообщение' : 'Скрытое сообщение'}
            </span>
            <span style={{ fontSize: 'var(--fs-micro)', color: 'var(--text2)' }}>
              {pendingMode.type === 'ephemeral'
                ? `Исчезнет через ${pendingMode.label}`
                : 'Откроется по тапу'}
            </span>
          </span>
          <button
            onClick={() => setPendingMode(null)}
            style={{
              width: 28, height: 28, borderRadius: 14,
              background: 'var(--surface-2)', border: 'none',
              color: 'var(--text2)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
            aria-label="Отменить режим"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {mentionMatches.length > 0 && (
        <div className="mention-list" role="listbox" aria-label="Упомянуть участника">
          <div className="mention-list-title">Упомянуть участника</div>
          {mentionMatches.map((mm: any, index: number) => (
            <button
              key={mm.user_id}
              type="button"
              role="option"
              aria-selected={index === mentionActiveIdx}
              className={'mention-item' + (index === mentionActiveIdx ? ' active' : '')}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => insertMention(mm)}
            >
              <div className="mention-av" style={!mm.user?.avatar_url ? { background: avatarColor(mm.user_id) } : undefined}>
                {mm.user?.avatar_url ? <img src={mm.user.avatar_url} alt="" /> : (mm.user?.display_name?.[0] || '?').toUpperCase()}
              </div>
              <span className="mention-item-copy">
                <span className="mention-item-name">{mm.user?.display_name}</span>
                <span className="mention-item-meta">{mm.role === 'admin' ? 'Администратор' : (mm.user?.email || 'Участник')}</span>
              </span>
              <span className="mention-at">@</span>
            </button>
          ))}
        </div>
      )}

      {isBlocked ? (
        <div className="blocked-bar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
          <span>Вы заблокировали пользователя</span>
          <button onClick={()=>{ if(user && otherUser) unblockUser(user.id, otherUser.id); }}>Разблокировать</button>
        </div>
      ) : recording ? <div className={'record-bar record-bar-enter' + (recordingStarting ? ' record-starting' : '')}>
        <button className="rec-btn" onClick={cancelRec}><svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='var(--danger)' strokeWidth='2'><path d='M18 6L6 18M6 6l12 12'/></svg></button>
        <div
          className="record-visual"
          style={{
            boxShadow: recordingStarting ? undefined : `0 0 ${10 + recLevel * 22}px color-mix(in srgb, var(--danger) ${Math.round(10 + recLevel * 22)}%, transparent)`,
            borderColor: recordingStarting ? undefined : `color-mix(in srgb, var(--danger) ${Math.round(18 + recLevel * 28)}%, var(--border))`,
          }}
        >
          <div className="rec-orb" style={recordingStarting ? undefined : { transform: `scale(${1 + recLevel * 0.24})` }}>
            <span style={recordingStarting ? undefined : { transform: `scale(${1 + recLevel * 0.62})`, boxShadow: `0 0 ${10 + recLevel * 18}px color-mix(in srgb, var(--danger) 74%, transparent)` }} />
          </div>
          <div className="rec-bars-live" style={recordingStarting ? undefined : { opacity: 0.74 + recLevel * 0.26 }}>
            {recBars.length > 0
              ? recBars.map((h,i)=><div key={i} className="rec-bar-segment" style={{height:h}} />)
              : Array.from({length:20},(_,i)=><div key={i} className="rec-bar-segment idle" />)}
          </div>
          <span className="rec-time">{recordingStarting ? 'Подготовка…' : fmtRec(recDur)}</span>
        </div>
        <button className="rec-btn" onClick={stopRec} disabled={recordingStarting}><svg width='20' height='20' viewBox='0 0 24 24' fill='var(--text)'><path d='M2.01 21L23 12 2.01 3 2 10l15 2-15 2z'/></svg></button>
      </div> : <div className={'input-bar ib-soft chat-composer-motion' + (composerHidden ? ' composer-hidden' : '')} style={showAttachMenu ? { display: 'none' } : undefined}>
        {isDesktop()&&<button className="ib-btn muted" onClick={()=>setShowEmoji(!showEmoji)} title="Эмодзи"><svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.9' strokeLinecap='round' strokeLinejoin='round'><circle cx='12' cy='12' r='9'/><path d='M8 14s1.5 2 4 2 4-2 4-2'/><line x1='9' y1='9' x2='9.01' y2='9'/><line x1='15' y1='9' x2='15.01' y2='9'/></svg></button>}
          <button className="ib-btn muted" onClick={()=>{setAttachTab('home');setShowAttachMenu(true);}} title="Вложения"><svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><path d='M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48'/></svg></button>
        <textarea ref={composerRef} placeholder={pendingMode?.type === 'spoiler' ? 'Скрытое сообщение...' : pendingMode?.type === 'ephemeral' ? `Исчезнет через ${pendingMode.label}...` : 'Сообщение...'} value={text} rows={1} onPaste={onComposerPaste} onChange={onComposerChange} onFocus={()=>{ composerShouldStayOpenRef.current = true; }} onBlur={()=>{ composerShouldStayOpenRef.current = false; }} onKeyDown={onComposerKeyDown} />
        {text.trim() ? <button type="button" className="ib-btn send" onPointerDown={(e)=>{ e.preventDefault(); composerShouldStayOpenRef.current = document.activeElement === composerRef.current; void handleSend(); }} onClick={(e)=>e.preventDefault()} onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); void handleSend(); } }} disabled={sending}><svg width='19' height='19' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.25' strokeLinecap='round' strokeLinejoin='round'><path d='M12 19V5'/><path d='m5 12 7-7 7 7'/></svg></button>
          : <button className="ib-btn muted record-trigger audio-record-trigger" onPointerDown={(e)=>{ e.preventDefault(); void startRec(); }} onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); void startRec(); } }} title="Голосовое"><svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.9' strokeLinecap='round' strokeLinejoin='round'><path d='M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z'/><path d='M19 10v2a7 7 0 0 1-14 0v-2'/><line x1='12' y1='19' x2='12' y2='23'/></svg></button>}
        {!text.trim() && <button className="ib-btn muted vnote-trigger record-trigger video-record-trigger" onPointerDown={(e)=>{ e.preventDefault(); void startVideoNote(); }} onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); void startVideoNote(); } }} title="Записать видеокружок" aria-label="Записать видеокружок"><svg width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.9' strokeLinecap='round' strokeLinejoin='round'><circle cx='12' cy='12' r='9'/><path d='M9.4 8.3 16 12l-6.6 3.7V8.3Z'/></svg></button>}
      </div>}

      {showCallPicker&&null}

      <div className={'decrypt-bar' + (decrypting && !askPassword ? ' show' : '')}><span className="btn-spin-sm" />Расшифровка…</div>
      {askPassword && <div className={'sgate' + (pwUnlocking ? ' unlocking' : '')}>
        <div className="sgate-top">
          <button className="sgate-back dt-hide" onClick={()=>{setAskPassword(false);setPwInput('');setPwError('');nav('/chats');}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Назад
          </button>
        </div>
        <div className="sgate-mid">
          <div className="sgate-who">
            <div style={{position:'relative'}}>
              {otherUser?.avatar_url
                ? <img className="sgate-av" src={otherUser.avatar_url} alt="" />
                : <div className="sgate-av sgate-av-fb" style={{background: otherUser ? avatarColor(otherUser.id) : 'var(--surface-light)'}}>{chatName[0]?.toUpperCase()}</div>}
              <div className="sgate-lockbadge">{pwUnlocking
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}</div>
            </div>
            <div className="sgate-name">{chatName}</div>
          </div>
          <h2 className="sgate-title">{isNewEncryptedChat ? 'Новый секретный чат' : 'Секретный чат'}</h2>
          <div className="sgate-sub">{isNewEncryptedChat
            ? 'Придумайте новый пароль для этого чата. Старые удалённые секретные чаты с этим человеком не используются.'
            : 'Введите пароль, о котором вы договорились. Он не хранится на сервере — если забыть, переписку не восстановить.'}</div>
          <div className={'sgate-field' + (pwError ? ' err' : '')}>
            <input
              type={pwShow ? 'text' : 'password'}
              value={pwInput}
              onChange={e=>{setPwInput(e.target.value);setPwError('');}}
              placeholder={isNewEncryptedChat ? 'Новый пароль' : 'Пароль'}
              autoFocus
              onKeyDown={e=>{if(e.key==='Enter')submitPw();}}
            />
            <button className="sgate-eye" onClick={()=>setPwShow(v=>!v)} aria-label={pwShow ? 'Скрыть пароль' : 'Показать пароль'} type="button">
              {pwShow
                ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19M6.61 6.61A18.5 18.5 0 0 0 2 12s3 8 10 8a9.12 9.12 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
                : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z"/><circle cx="12" cy="12" r="3"/></svg>}
            </button>
          </div>
          {pwError && <div className="sgate-err">{pwError}</div>}
          <label className="sgate-remember">
            <input type="checkbox" checked={pwRemember} onChange={e=>setPwRemember(e.target.checked)} />
            <span>Запомнить на этом устройстве</span>
          </label>
          <button className="sgate-submit" disabled={!pwInput} onClick={submitPw}>{isNewEncryptedChat ? 'Создать пароль' : 'Войти'}</button>
        </div>
      </div>}
      {showAdminStatus && <AdminStatusPanel onClose={()=>setShowAdminStatus(false)} />}
      {showEmoji&&<div style={{position:'fixed',bottom:70,left:0,right:0,background:'var(--surface)',borderTop:'1px solid var(--border)',padding:12,display:'flex',flexWrap:'wrap',gap:8,zIndex:50,maxHeight:200,overflowY:'auto'}}>{EMOJI_PICKER_SET.map(e=><button key={e} onClick={()=>{setText(t=>t+e);setShowEmoji(false)}} style={{background:'none',border:'none',fontSize: 'var(--fs-display)',cursor:'pointer',padding:4}}>{e}</button>)}</div>}


      {reactionPickerFor && (
        <div className="reaction-full-overlay" onClick={closeReactionPicker}>
          <div
            className={'reaction-full-sheet' + (reactionSheetDragging ? ' dragging' : '')}
            onClick={e=>e.stopPropagation()}
            style={{ transform: `translate3d(0, ${reactionSheetY}px, 0)` }}
          >
            <div className="reaction-full-title">Реакция</div>
            <div
              ref={reactionGridRef}
              className={'reaction-full-grid' + (reactionSlideRef.current ? ' is-sliding' : '')}
              onPointerDown={onReactionGridPointerDown}
              onPointerMove={onReactionGridPointerMove}
              onPointerUp={onReactionGridPointerUp}
              onPointerCancel={onReactionGridPointerCancel}
            >
              {EMOJI_PICKER_SET.map(e=>(
                <button
                  type="button"
                  key={e}
                  data-reaction-emoji={e}
                  className={reactionSlideEmoji === e ? 'slide-active' : ''}
                  aria-label={`Реакция ${e}`}
                >{e}</button>
              ))}
            </div>
          </div>
        </div>
      )}
      {reactionDetailsFor && (() => {
        const rs = reactions[reactionDetailsFor] || [];
        const grouped: Record<string,string[]> = {};
        rs.forEach(r => { (grouped[r.emoji] = grouped[r.emoji] || []).push(r.user_id); });
        const mm: Record<string,any> = {};
        (conv?.members||[]).forEach((mb:any)=>{ if(mb.user) mm[mb.user_id]=mb.user; });
        return (
          <div onClick={()=>setReactionDetailsFor(null)} style={{ position:'fixed', inset:0, zIndex:400, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
            <div onClick={e=>e.stopPropagation()} style={{ width:'100%', maxWidth:500, background:'var(--surface)', borderRadius:'16px 16px 0 0', borderTop:'1px solid var(--border)', padding:'12px 16px max(16px, env(safe-area-inset-bottom, 16px))', maxHeight:'70vh', overflowY:'auto', animation:'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}>
              <div style={{ display:'flex', justifyContent:'center', marginBottom:10 }}><div style={{ width:36, height:4, borderRadius:2, background:'var(--border)' }} /></div>
              <div style={{ fontSize:'var(--fs-heading)', fontWeight:700, marginBottom:12 }}>Реакции</div>
              {Object.keys(grouped).length === 0 && <div style={{ color:'var(--muted)', padding:'12px 0' }}>Нет реакций</div>}
              {Object.entries(grouped).map(([emoji, uids]) => (
                <div key={emoji} style={{ marginBottom:14 }}>
                  <div style={{ fontWeight:600, marginBottom:6, display:'flex', alignItems:'center', gap:6 }}><span style={{ fontSize:'var(--fs-title)' }}>{emoji}</span><span style={{ color:'var(--muted)', fontSize:'var(--fs-caption)' }}>{uids.length}</span></div>
                  {uids.map(uid => {
                    const u = mm[uid];
                    const name = u?.display_name || (uid === user?.id ? 'Вы' : 'Пользователь');
                    return (
                      <div key={uid} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0' }}>
                        {u?.avatar_url
                          ? <img src={u.avatar_url} alt="" style={{ width:32, height:32, borderRadius:16, objectFit:'cover', flexShrink:0 }} />
                          : <div style={{ width:32, height:32, borderRadius:16, background:avatarColor(uid), display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:600, flexShrink:0, fontSize:'var(--fs-label)' }}>{name[0]?.toUpperCase()}</div>}
                        <span>{name}{uid === user?.id ? ' (вы)' : ''}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {readByFor && (() => {
        const msg = currentMessages.find(m => m.id === readByFor);
        if (!msg) return null;
        const others = (conv?.members || []).filter((mb:any) => mb.user_id !== user?.id);
        const hasRead = (mb:any) => { const t = memberReadTimes[mb.user_id]; return !!(t && t >= msg.created_at); };
        const readers = others.filter(hasRead);
        const unread = others.filter((mb:any) => !hasRead(mb));
        const row = (mb:any) => {
          const u = mb.user; const name = u?.display_name || 'Пользователь';
          return (
            <div key={mb.user_id} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0' }}>
              {u?.avatar_url
                ? <img src={u.avatar_url} alt="" style={{ width:32, height:32, borderRadius:16, objectFit:'cover', flexShrink:0 }} />
                : <div style={{ width:32, height:32, borderRadius:16, background:avatarColor(mb.user_id), display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:600, flexShrink:0, fontSize:'var(--fs-label)' }}>{name[0]?.toUpperCase()}</div>}
              <span>{name}</span>
            </div>
          );
        };
        return (
          <div onClick={()=>setReadByFor(null)} style={{ position:'fixed', inset:0, zIndex:400, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
            <div onClick={e=>e.stopPropagation()} style={{ width:'100%', maxWidth:500, background:'var(--surface)', borderRadius:'16px 16px 0 0', borderTop:'1px solid var(--border)', padding:'12px 16px max(16px, env(safe-area-inset-bottom, 16px))', maxHeight:'70vh', overflowY:'auto', animation:'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}>
              <div style={{ display:'flex', justifyContent:'center', marginBottom:10 }}><div style={{ width:36, height:4, borderRadius:2, background:'var(--border)' }} /></div>
              <div style={{ fontSize:'var(--fs-heading)', fontWeight:700, marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Прочитали {readers.length} из {others.length}
              </div>
              {readers.map(row)}
              {unread.length > 0 && <>
                <div style={{ fontSize:'var(--fs-caption)', color:'var(--muted)', fontWeight:600, margin:'14px 0 6px' }}>Ещё не прочитали</div>
                {unread.map(row)}
              </>}
            </div>
          </div>
        );
      })()}

      {recordingVideo && createPortal(
        <div className={'vnote-overlay' + (videoStarting ? ' vnote-is-starting' : '') + (videoFlipping ? ' vnote-is-flipping' : '')} role="dialog" aria-modal="true" aria-label="Запись видеосообщения">
          <div className="vnote-top">
            <div className="vnote-rec-pill">
              <span className="vnote-dot" aria-hidden="true" />
              <span className="vnote-rec-label">{videoStarting ? 'Подготовка камеры' : 'Видеосообщение'}</span>
              <span className="vnote-time">{Math.floor(videoDur / 60).toString().padStart(2, '0')}:{(videoDur % 60).toString().padStart(2, '0')}</span>
            </div>
          </div>

          <div className="vnote-preview-wrap">
            <div className="vnote-preview-shell">
              {videoStarting && <div className="vnote-camera-loading"><span /></div>}
              <video
                ref={videoPreviewRef}
                autoPlay
                playsInline
                muted
                className="vnote-preview"
                style={{ transform: videoFacing === 'user' ? 'scaleX(-1)' : 'none', opacity: videoFlipping ? 0.72 : 1 }}
              />
            </div>
            <svg className="vnote-ring" viewBox="0 0 220 220" aria-hidden="true">
              <circle cx="110" cy="110" r="106" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="3" />
              <circle
                cx="110" cy="110" r="106" fill="none" stroke="#ff453a" strokeWidth="4"
                strokeLinecap="round" strokeDasharray={666}
                strokeDashoffset={666 - (666 * Math.min(videoDur, 60) / 60)}
                transform="rotate(-90 110 110)"
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
          </div>

          <div className="vnote-hint">Круглое видео · до 60 секунд</div>

          <div className="vnote-actions">
            <button className="vnote-action vnote-discard" onClick={cancelVideoNote} aria-label="Удалить запись">
              <span className="vnote-action-icon"><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg></span>
              <span>Удалить</span>
            </button>

            <button className="vnote-send" onClick={stopVideoNote} disabled={videoStarting || videoFlipping} aria-label="Остановить и отправить">
              <span className="vnote-send-core" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg></span>
              <span className="vnote-send-label">Отправить</span>
            </button>

            <button className="vnote-action vnote-flip" onClick={flipVideoCamera} disabled={videoStarting || videoFlipping} aria-label="Сменить камеру">
              <span className="vnote-action-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M20.49 15A9 9 0 0 1 5.64 18.36L1 14"/></svg></span>
              <span>Камера</span>
            </button>
          </div>
        </div>,
        document.body
      )}
      {preview && (
        <div className="img-preview">
          <div key={preview} className={lbDir === 1 ? 'lb-slide-l' : lbDir === -1 ? 'lb-slide-r' : undefined} style={{ position:'absolute', inset:0 }}>
            <ZoomableImage
              src={preview}
              onClose={()=>setPreview(null)}
              onPrev={currentPhotoIdx > 0 ? () => gotoPhoto(-1) : undefined}
              onNext={currentPhotoIdx >= 0 && currentPhotoIdx < photoUrls.length - 1 ? () => gotoPhoto(1) : undefined}
            />
          </div>
          {/* Стрелки листания — видимые ink-кнопки */}
          {currentPhotoIdx > 0 && (
            <button className="ip-nav ip-prev" onClick={() => gotoPhoto(-1)} aria-label="Предыдущее">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
          )}
          {currentPhotoIdx >= 0 && currentPhotoIdx < photoUrls.length - 1 && (
            <button className="ip-nav ip-next" onClick={() => gotoPhoto(1)} aria-label="Следующее">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
            </button>
          )}
          {/* Закрывающий ✕ — единственный надёжный способ закрыть */}
          <button className="ip-close" onClick={()=>setPreview(null)} aria-label="Закрыть">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
          </button>
          {/* Counter */}
          {photoUrls.length > 1 && currentPhotoIdx >= 0 && (
            <div style={{
              position:'absolute',
              top:'calc(max(14px, env(safe-area-inset-top, 0px)) + 16px)',
              left:'50%', transform:'translateX(-50%)',
              color:'#fff', fontSize: 'var(--fs-snap14)', fontWeight:600, letterSpacing:0.3,
              background:'rgba(0,0,0,0.45)', padding:'6px 12px', borderRadius:14,
              backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)',
              zIndex:301,
            }}>
              {currentPhotoIdx + 1} / {photoUrls.length}
            </div>
          )}
        </div>
      )}

      {/* Attach menu with tabs */}
      {showAttachMenu && <div className={'attach-overlay' + (attachClosing ? ' closing' : '')} onClick={closeAttach}>
        <div
          className={'attach-sheet' + (['poll','event','game','ephemeral'].includes(attachTab) ? ' attach-sheet-flat' : '') + (attachClosing ? ' closing' : '') + (attachDragging ? ' dragging' : '')}
          onClick={e=>e.stopPropagation()}
          style={{
            transform: attachDragY ? `translate3d(0, ${attachDragY}px, 0)` : undefined,
            transition: attachDragging ? 'none' : 'transform 300ms cubic-bezier(.22,1,.36,1), opacity 220ms ease',
          }}
          onPointerDown={(e)=>{ if ((e.target as HTMLElement).closest('button')) haptic.tap(); }}
        >
          <div className={'attach-drag' + (attachDragging ? ' dragging' : '')} onPointerDown={onAttachDown} onPointerMove={onAttachMove} onPointerUp={onAttachUp} onPointerCancel={onAttachUp}>
            <div className="attach-grab" />
          </div>

          {/* Домашний вид: крупные Фото/Файл + сетка плиток (variant C) */}
          {attachTab === 'home' && <div className={'attach-home attach-dir-' + attachDir}>
            <div className="attach-grid">
              <button className="attach-tile" onClick={()=>pickGallery(false)}>
                <div className="attach-tile-ic" style={{background:'linear-gradient(135deg,#8A7CF5,#5A48D8)'}}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                </div>
                <span>Фото</span>
              </button>
              <button className="attach-tile" onClick={pickVideo}>
                <div className="attach-tile-ic" style={{background:'linear-gradient(135deg,#111827,#374151)'}}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/></svg>
                </div>
                <span>Видео</span>
              </button>
              <button className="attach-tile" onClick={pickFile}>
                <div className="attach-tile-ic" style={{background:'linear-gradient(135deg,#2ED8A7,#00A67F)'}}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <span>Файл</span>
              </button>
              <button className="attach-tile" onClick={()=>pickGallery(true)}>
                <div className="attach-tile-ic hd-icon" style={{background:'#111827', color:'#fff', fontSize:'var(--fs-heading)', fontWeight:900, letterSpacing:'-0.04em'}}>
                  HD
                </div>
                <span>HD</span>
              </button>
              <button className="attach-tile" onClick={()=>{setShowAttachMenu(false);handleSendLocation();}}>
                <div className="attach-tile-ic" style={{background:'linear-gradient(135deg,#FF8A8A,#F04A4A)'}}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                </div>
                <span>Гео</span>
              </button>
              <button className="attach-tile" onClick={()=>goAttachTab('poll')} style={conv?.is_encrypted ? {display:'none'} : undefined}>
                <div className="attach-tile-ic" style={{background:'#D9A300'}}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
                </div>
                <span>Опрос</span>
              </button>
              <button className="attach-tile" onClick={()=>goAttachTab('event')} style={conv?.is_encrypted ? {display:'none'} : undefined}>
                <div className="attach-tile-ic" style={{background:'#3478F6'}}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>
                </div>
                <span>Событие</span>
              </button>
              <button className="attach-tile" onClick={()=>goAttachTab('game')} style={conv?.is_encrypted ? {display:'none'} : undefined}>
                <div className="attach-tile-ic" style={{background:'#7C4DFF'}}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="11" x2="10" y2="11"/><line x1="8" y1="9" x2="8" y2="13"/><circle cx="15" cy="12" r="0.6" fill="#7C3AED"/><circle cx="18" cy="10" r="0.6" fill="#7C3AED"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/></svg>
                </div>
                <span>Игра</span>
              </button>
              {(user as any)?.tinder_access && !conv?.is_encrypted && <button className="attach-tile" onClick={()=>{setShowAttachMenu(false);setShowTinderWidget(true);}}>
                <div className="attach-tile-ic" style={{background:'linear-gradient(135deg,#F472B6,#DB2777)'}}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                </div>
                <span>Тиндер</span>
              </button>}
              <button className="attach-tile" onClick={()=>{setShowAttachMenu(false); nav(`/feedback?source=chat${id ? `&chat=${encodeURIComponent(id)}` : ''}`);}}>
                <div className="attach-tile-ic" style={{background:'linear-gradient(135deg,#7C4DFF,#20B486)'}}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 14.3 8.7 20 11l-5.7 2.3L12 19l-2.3-5.7L4 11l5.7-2.3L12 3Z"/><path d="M19 3v4M17 5h4"/></svg>
                </div>
                <span>Идеи и баги</span>
              </button>
              <button className="attach-tile" onClick={()=>goAttachTab('ephemeral')}>
                <div className="attach-tile-ic" style={{background:'#6E5AE6'}}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <span>Исчезает</span>
              </button>
              <button className="attach-tile" onClick={()=>{setPendingMode({type:'spoiler'});setShowAttachMenu(false);requestAnimationFrame(()=>composerRef.current?.focus());}}>
                <div className="attach-tile-ic" style={{background:'linear-gradient(135deg,#C084FC,#9333EA)'}}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                </div>
                <span>Скрытое</span>
              </button>
            </div>
          </div>}

          {/* Под-вид: поделиться событием */}
          {attachTab === 'event' && id && <div className={'attach-home attach-flat-panel attach-dir-' + attachDir}>
            <div className="attach-sub-hdr">
              <button className="attach-sub-back" onClick={()=>goAttachTab('home')} aria-label="Назад"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg></button>
              <div className="attach-sub-title">Поделиться событием</div>
            </div>
            <EventSharePane conversationId={id} onShared={() => setShowAttachMenu(false)} />
          </div>}

          {/* Под-вид: опрос */}
          {attachTab === 'poll' && id && <div className={'attach-home attach-flat-panel attach-dir-' + attachDir} style={{ display:'flex', flexDirection:'column', maxHeight:'80dvh' }}>
            <div className="attach-sub-hdr">
              <button className="attach-sub-back" onClick={()=>goAttachTab('home')} aria-label="Назад"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg></button>
              <div className="attach-sub-title">Опрос</div>
            </div>
            <div className="attach-form" style={{ overflowY:'auto', flex:1, minHeight:0 }}>
              <label className="af-label">Вопрос</label>
              <input className="af-input" placeholder="О чём спросить?" value={pollQ} maxLength={120} onChange={e=>setPollQ(e.target.value)} autoFocus />
              <div className="af-counter">{pollQ.length}/120</div>
              <label className="af-label" style={{marginTop:12}}>Варианты ответа</label>
              {pollOpts.map((o,i)=>(
                <div className="af-opt-row" key={`poll-opt-${i}-${pollOpts.length}`}>
                  <input className="af-input" placeholder={`Вариант ${i+1}`} value={o} maxLength={60} onChange={e=>{const c=[...pollOpts];c[i]=e.target.value;setPollOpts(c);}} />
                  {pollOpts.length>2 && <button className="af-opt-del" onClick={()=>setPollOpts(pollOpts.filter((_,j)=>j!==i))} aria-label="Удалить вариант"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>}
                </div>
              ))}
              {pollOpts.length < 10 && <button className="af-add" onClick={()=>{haptic.tap(); setPollOpts([...pollOpts,'']);}}>+ Вариант</button>}
            </div>
            <div className="attach-form-foot">
              {!(pollQ.trim() && pollOpts.filter(o=>o.trim()).length>=2) && <div className="af-hint">Введите вопрос и минимум 2 варианта</div>}
              <button className="af-submit" style={{background:'var(--accent)', color:'#fff'}} disabled={!(pollQ.trim() && pollOpts.filter(o=>o.trim()).length>=2) || pollSending} onClick={handleCreatePoll}>
                {pollSending ? <span className="btn-spin" /> : 'Создать опрос'}
              </button>
            </div>
          </div>}

          {/* Под-вид: игры */}
          {attachTab === 'game' && <div className={'attach-home attach-flat-panel attach-dir-' + attachDir}>
            <div className="attach-sub-hdr">
              <button className="attach-sub-back" onClick={()=>goAttachTab('home')} aria-label="Назад"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg></button>
              <div className="attach-sub-title">Игра</div>
            </div>
            <button className="attach-big-btn attach-big-btn-row attach-game-text-only" onClick={()=>{ setShowAttachMenu(false); nav(`/chess/create?chatId=${id}`); }}>
              <div style={{textAlign:'left', flex:1}}>
                <div className="attach-big-title">Chess</div>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <button className="attach-big-btn attach-big-btn-row attach-game-text-only" onClick={()=>{ setShowAttachMenu(false); nav('/alias'); }}>
              <div style={{textAlign:'left', flex:1}}>
                <div className="attach-big-title">Crocodile</div>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <button className="attach-big-btn attach-big-btn-row attach-game-text-only" onClick={()=>{ setShowAttachMenu(false); nav('/tod'); }}>
              <div style={{textAlign:'left', flex:1}}>
                <div className="attach-big-title">Truth or Dare</div>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>}

          {/* Под-вид: исчезающее сообщение */}
          {attachTab === 'ephemeral' && <div className={'attach-home attach-flat-panel attach-dir-' + attachDir} style={{ display:'flex', flexDirection:'column', maxHeight:'80dvh', overflowY:'auto', overscrollBehavior:'contain', WebkitOverflowScrolling:'touch' }}>
            <div className="attach-sub-hdr">
              <button className="attach-sub-back" onClick={()=>goAttachTab('home')} aria-label="Назад"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg></button>
              <div className="attach-sub-title">Исчезающее сообщение</div>
            </div>
            <EphemeralSlider onPick={(seconds, label) => { setPendingMode({type:'ephemeral',seconds,label}); setShowAttachMenu(false); requestAnimationFrame(()=>composerRef.current?.focus()); }} />
          </div>}
        </div>
      </div>}

      {/* Media gallery */}
      {attachDraft && (
        <div className="modal-overlay" onClick={()=>{ setAttachDraft(null); setAttachCaption(''); }}>
          <div className="modal-content" onClick={e=>e.stopPropagation()} style={{maxWidth:480}}>
            <div style={{fontSize: 'var(--fs-snap16)',fontWeight:700,marginBottom:12}}>
              {attachDraft.kind==='media'
                ? (attachDraft.files.length>1?`Медиа · ${attachDraft.files.length}`:'Медиа')
                : (attachDraft.files.length>1?`Файлы · ${attachDraft.files.length}`:'Файл')}
            </div>
            {attachDraft.kind==='media' ? (
              <div style={{display:'flex',gap:6,overflowX:'auto',marginBottom:14,paddingBottom:4}}>
                {draftPreviews.map((p,i)=>(
                  <div key={i} style={{position:'relative',flexShrink:0,width:88,height:88,borderRadius:10,overflow:'hidden',background:'#000'}}>
                    {p.isVideo
                      ? <>
                          <img src={p.previewUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />
                          <span className="cp-video-badge">Видео</span>
                        </>
                      : <img src={p.previewUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:14,maxHeight:220,overflowY:'auto'}}>
                {draftPreviews.map((p,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:10,background:'var(--surface-light)'}}>
                    <div style={{width:34,height:34,borderRadius:8,background:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize: 'var(--fs-label)',fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.name}</div>
                      <div style={{fontSize: 'var(--fs-micro)',color:'var(--muted)'}}>{formatFileSize(p.size)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!conv?.is_encrypted
              ? <input ref={attachCaptionInputRef} autoFocus value={attachCaption} onChange={e=>setAttachCaption(e.target.value)} placeholder="Подпись..."
                  style={{width:'100%',padding:'11px 14px',borderRadius:12,background:'var(--surface-light)',border:'1px solid var(--border)',color:'var(--text)',fontSize: 'var(--fs-body)',outline:'none',boxSizing:'border-box',marginBottom:14}} />
              : <div style={{fontSize: 'var(--fs-caption)',color:'var(--muted)',marginBottom:14}}>В защищённом чате подпись не добавляется</div>}
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>{ setAttachDraft(null); setAttachCaption(''); }} style={{flex:1,padding:12,borderRadius:12,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontWeight:600,cursor:'pointer'}}>Отмена</button>
              <button onClick={confirmSendDraft} style={{flex:1,padding:12,borderRadius:12,border:'none',background:'var(--primary)',color:'var(--bg)',fontWeight:700,cursor:'pointer'}}>Отправить</button>
            </div>
          </div>
        </div>
      )}
      {showGallery&&<div className="modal-overlay" onClick={()=>setShowGallery(false)}><div className="modal-content" onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><h2>МЕДИА</h2><button className="modal-close" onClick={()=>setShowGallery(false)}>✕</button></div>
        {gallery.length===0?<div style={{textAlign:'center',color:'var(--muted)',padding:32}}>Пусто</div>:
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:4}}>
          {gallery.filter(a=>a.mime_type?.startsWith('image/')).map(a=><img key={a.id} src={a.file_url} alt="" onClick={()=>{setShowGallery(false);setPreview(a.file_url)}} style={{width:'100%',aspectRatio:'1',objectFit:'cover',borderRadius:4,cursor:'pointer'}} />)}
        </div>}
        {gallery.filter(a=>!a.mime_type?.startsWith('image/')).length>0&&<>
          <div style={{fontSize: 'var(--fs-micro)',color:'var(--muted)',margin:'12px 0 6px',fontWeight:500}}>ФАЙЛЫ</div>
          {gallery.filter(a=>!a.mime_type?.startsWith('image/')).map(a=><div key={a.id} className="chat-item" onClick={()=>window.open(a.file_url,'_blank')} style={{padding:'6px 0'}}>
            <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.5'><path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/><path d='M14 2v6h6'/></svg><div className="ci-info"><div className="ci-name" style={{fontSize: 'var(--fs-caption)'}}>{a.file_name}</div><div className="ci-preview">{formatFileSize(a.file_size)}</div></div>
          </div>)}
        </>}
      </div></div>}

      {/* Опрос — теперь под-вид в меню вложений (attachTab==='poll') */}

      {/* User profile (for direct chats) */}
      {showUserProfile && otherUser && conv?.type==='direct' && <div className="profile-overlay" onClick={()=>setShowUserProfile(false)}>
        <div className="profile-sheet" onClick={e=>e.stopPropagation()}>
          <div className="profile-top">
            <button className="profile-close" onClick={()=>setShowUserProfile(false)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
          </div>

          <div className="profile-hero">
            {otherUser.avatar_url
              ? <img src={otherUser.avatar_url} alt="" className="profile-avatar" onClick={()=>setPreview(otherUser.avatar_url!)} />
              : <div className="profile-avatar profile-avatar-fallback" style={{background:avatarColor(otherUser.id)}}>{chatName[0]?.toUpperCase()}</div>
            }
            <div className="profile-name">{chatName}</div>
            {otherUser.custom_status_text && (
              <div style={{marginTop:4,fontSize: 'var(--fs-label)',fontWeight:600,color:otherUser.custom_status_color || 'var(--muted)',letterSpacing:0.3}}>
                {otherUser.custom_status_text}
              </div>
            )}
            <div className="profile-status" style={{color: otherOnline ? 'var(--success)' : 'var(--muted)'}}>
              {otherOnline ? 'в сети' : (otherLastSeen ? fmtLastSeen(otherLastSeen) : 'был(а) давно')}
            </div>
          </div>

          <div className="profile-actions">
            <button className="pa-btn" onClick={()=>{if(!otherUser)return;setShowUserProfile(false);startCall(otherUser,'audio', id);}}>
              <div className="pa-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg></div>
              <span>звонок</span>
            </button>
            <button className="pa-btn" onClick={()=>{if(!otherUser)return;setShowUserProfile(false);startCall(otherUser,'video', id);}}>
              <div className="pa-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg></div>
              <span>видео</span>
            </button>
            <button className="pa-btn" onClick={()=>{if(!otherUser)return;setShowUserProfile(false);nav(`/u/${otherUser.id}`);}}>
              <div className="pa-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg></div>
              <span>профиль</span>
            </button>
          </div>

          <div className="profile-info">
            <div className="pi-row">
              <div className="pi-label">email</div>
              <div className="pi-value">{otherUser.email}</div>
            </div>
            {conv?.is_encrypted && <div className="pi-row" onClick={()=>{ if(id){clearChatPassword(id);} setDecryptedMap({}); setDecryptedFiles({}); setShowUserProfile(false); setAskPassword(true); }} style={{cursor:'pointer'}}>
              <div className="pi-label" style={{color:'var(--accent)',fontWeight:600}}>Сменить пароль</div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><path d="M12 16v2"/></svg>
            </div>}
            {conv?.is_encrypted && <div className="pi-row" onClick={()=>{ if(id){clearChatPassword(id);} setShowUserProfile(false); nav('/chats'); }} style={{cursor:'pointer'}}>
              <div className="pi-label" style={{fontWeight:600}}>Заблокировать чат сейчас</div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>}
            <div className="pi-moderation-actions">
              <button className="pi-row pi-action-row pi-action-emphasis" onClick={async()=>{ if(!user || !otherUser) return; if(isBlocked){ await unblockUser(user.id, otherUser.id); toast.success('Пользователь разблокирован'); } else if(confirm('Заблокировать '+chatName+'? Вы не сможете отправлять ему сообщения.')){ await blockUser(user.id, otherUser.id); toast.success('Пользователь заблокирован'); } }}>
                <span className="pi-action-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="m7 7 10 10"/></svg>
                </span>
                <span className="pi-action-title">{isBlocked ? 'Разблокировать' : 'Заблокировать'}</span>
              </button>
              <div className="pi-action-divider" aria-hidden="true" />
              <button className="pi-row pi-action-row pi-action-emphasis danger" onClick={reportUser}>
                <span className="pi-action-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3v18"/><path d="M5 4h11l-2 4 2 4H5"/></svg>
                </span>
                <span className="pi-action-title">Пожаловаться</span>
              </button>
            </div>
          </div>

          <div
            className="profile-tabs"
            onPointerDown={onProfileTabsPointerDown}
            onPointerMove={onProfileTabsPointerMove}
            onPointerUp={onProfileSwipeUp}
            onPointerCancel={onProfileSwipeUp}
          >
            <button className={'p-tab'+(profileTab==='media'?' active':'')} onClick={()=>selectProfileTab('media')}>Медиа</button>
            <button className={'p-tab'+(profileTab==='voice'?' active':'')} onClick={()=>selectProfileTab('voice')}>Голосовые</button>
            <button className={'p-tab'+(profileTab==='files'?' active':'')} onClick={()=>selectProfileTab('files')}>Файлы</button>
            <button className={'p-tab'+(profileTab==='links'?' active':'')} onClick={()=>selectProfileTab('links')}>Ссылки</button>
          </div>

          <div
            className="profile-content profile-content-drag"
            onPointerDown={onProfileSwipeDown}
            onPointerMove={onProfileSwipeMove}
            onPointerUp={onProfileSwipeUp}
            onPointerCancel={onProfileSwipeUp}
          >
            {profileTab==='media' && <>
              {gallery.filter(a=>a.mime_type?.startsWith('image/')).length===0
                ? <div style={{textAlign:'center',color:'var(--muted)',padding:'32px 16px',fontSize: 'var(--fs-label)'}}>Нет медиафайлов</div>
                : <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:2}}>
                    {gallery.filter(a=>a.mime_type?.startsWith('image/')).map(a=>
                      <img key={a.id} src={a.file_url} alt="" onClick={()=>setPreview(a.file_url)} style={{width:'100%',aspectRatio:'1',objectFit:'cover',cursor:'pointer'}} />
                    )}
                  </div>
              }
            </>}
            {profileTab==='voice' && (() => {
              const isVoice = (a:any) => a.file_name?.startsWith('voice_') || a.mime_type?.startsWith('audio/');
              const voices = gallery.filter(isVoice);
              if (voices.length===0) return <div style={{textAlign:'center',color:'var(--muted)',padding:'32px 16px',fontSize: 'var(--fs-label)'}}>Нет голосовых сообщений</div>;
              return <div>
                {voices.map(a=>{
                  const senderName = (a as any).sender_id === user?.id ? 'Вы' : (otherUser?.name || 'Собеседник');
                  const d = new Date((a as any).created_at);
                  const dateStr = d.toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'numeric'}).replace(' г.','') + ' в ' + d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
                  return <VoiceProfileItem key={a.id} url={a.file_url} name={senderName} dateStr={dateStr} msgId={a.id} />;
                })}
              </div>;
            })()}
            {profileTab==='files' && <>
              {gallery.filter(a=>!a.mime_type?.startsWith('image/') && !(a.file_name?.startsWith('voice_')||a.mime_type?.startsWith('audio/'))).length===0
                ? <div style={{textAlign:'center',color:'var(--muted)',padding:'32px 16px',fontSize: 'var(--fs-label)'}}>Нет файлов</div>
                : <div>
                    {gallery.filter(a=>!a.mime_type?.startsWith('image/') && !(a.file_name?.startsWith('voice_')||a.mime_type?.startsWith('audio/'))).map(a=>
                      <div key={a.id} onClick={()=>{ haptic.tap(); setProfileFileMenu(a); }} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderBottom:'1px solid var(--border)',cursor:'pointer'}}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize: 'var(--fs-label)',color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.file_name}</div>
                          <div style={{fontSize: 'var(--fs-micro)',color:'var(--muted)'}}>{formatFileSize(a.file_size)}</div>
                        </div>
                      </div>
                    )}
                  </div>
              }
            </>}
            {profileTab==='links' && (() => {
              const linkMsgs = currentMessages.filter(m => !(m as any).is_encrypted && !(m as any).deleted_at && extractUrl(m.content || ''));
              if (linkMsgs.length === 0) return <div style={{textAlign:'center',color:'var(--muted)',padding:'32px 16px',fontSize: 'var(--fs-label)'}}>Нет ссылок</div>;
              return <div>
                {linkMsgs.map(m => {
                  const url = extractUrl(m.content || '')!;
                  let host = url; try { host = new URL(url).hostname.replace(/^www\./,''); } catch { /* keep */ }
                  return (
                    <div key={m.id} onClick={()=>window.open(url,'_blank')} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderBottom:'1px solid var(--border)',cursor:'pointer'}}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize: 'var(--fs-label)',color:'var(--accent)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{host}</div>
                        <div style={{fontSize: 'var(--fs-micro)',color:'var(--muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{url}</div>
                      </div>
                    </div>
                  );
                })}
              </div>;
            })()}
          </div>
        </div>
      </div>}

      {/* Group info modal — TG-style */}
      {showGroupInfo&&conv?.type==='group'&&<div className="profile-overlay" onClick={()=>{setShowGroupInfo(false);setAddMemberQuery('');setAddMemberResults([]);setEditingName(false);setMemberMenu(null);}}>
        <div className="profile-sheet group-profile-sheet" onClick={e=>e.stopPropagation()}>
          <div className="profile-top">
            <button className="profile-close" onClick={()=>setShowGroupInfo(false)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <div style={{flex:1}} />
          </div>

          <div className="group-profile-scroll">
          <div className="profile-hero">
            <div style={{position:'relative',width:128,height:128,margin:'0 auto',cursor:'pointer'}} onClick={()=>{
              const inp=document.createElement('input');inp.type='file';inp.accept='image/*';inp.onchange=async()=>{
                const f=inp.files?.[0]; if(!f||!id||!user) return;
                const path=id+'/group.'+f.name.split('.').pop();
                const { error: uploadError } = await supabase.storage.from('avatars').upload(path,f,{upsert:true,contentType:f.type});
                if (uploadError) { toast.error('Не удалось загрузить фото группы'); return; }
                const{data}=supabase.storage.from('avatars').getPublicUrl(path);
                const nextAvatarUrl=data.publicUrl+'?v='+Date.now();
                const { error: updateError } = await supabase.from('conversations').update({avatar_url:nextAvatarUrl}).eq('id',id);
                if (updateError) { toast.error('Не удалось изменить фото группы'); return; }
                const actorName = user.display_name || 'Участник';
                const systemPromise = sendWidgetMessage(id, user.id, `${actorName} изменил(а) фото группы`, 'system');
                void fetchConversations(user.id);
                const systemResult = await systemPromise;
                if (systemResult.error) toast.error('Фото изменено, но системное сообщение не отправилось');
              };inp.click();
            }}>
              {conv.avatar_url
                ? <img src={conv.avatar_url} alt="" className="profile-avatar" />
                : <div className="profile-avatar profile-avatar-fallback" style={{background:avatarColor(conv.id)}}>{(conv.name||'Г')[0]?.toUpperCase()}</div>
              }
              <div className="settings-avatar-edit">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" strokeWidth="1.8" strokeLinecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </div>
            </div>
            {editingName
              ? <input value={newGroupName} onChange={e=>setNewGroupName(e.target.value)} style={{maxWidth:280,textAlign:'center',fontSize: 'var(--fs-title)',margin:'16px auto 0',display:'block'}} autoFocus onKeyDown={e=>{if(e.key==='Enter'&&newGroupName.trim()){renameGroup(id!,newGroupName).then(() => { setEditingName(false);if(user)fetchConversations(user.id) }).catch(e => console.error('renameGroup:', e))}}} onBlur={()=>{if(newGroupName.trim()){renameGroup(id!,newGroupName).then(() => { setEditingName(false);if(user)fetchConversations(user.id) }).catch(e => console.error('renameGroup:', e))}else setEditingName(false)}} />
              : <div className="profile-name" onClick={()=>{setEditingName(true);setNewGroupName(conv.name||'')}} style={{cursor:'pointer'}}>{conv.name||'Группа'}</div>
            }
            <div className="profile-status">{conv.members.length} участников</div>
          </div>

          <div className="profile-actions">
            <button className="pa-btn" onClick={()=>{
              const participants = conv.members.map((m:any) => m.user).filter(Boolean);
              setShowGroupInfo(false);
              startGroupCall(conv.id, conv.name || 'Групповой звонок', participants, 'audio');
            }}>
              <div className="pa-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg></div>
              <span>звонок</span>
            </button>
            <button className="pa-btn" onClick={()=>{
              const participants = conv.members.map((m:any) => m.user).filter(Boolean);
              setShowGroupInfo(false);
              startGroupCall(conv.id, conv.name || 'Групповой звонок', participants, 'video');
            }}>
              <div className="pa-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg></div>
              <span>видео</span>
            </button>
          </div>

          {/* Members list */}
          <div style={{padding:'0 0 20px'}}>
            <div style={{fontSize: 'var(--fs-micro)',fontWeight:600,color:'var(--text2)',padding:'8px 16px 6px',textTransform:'uppercase',letterSpacing:0.5}}>
              УЧАСТНИКИ
            </div>

            {conv.members.find(x=>x.user_id===user?.id)?.role==='admin' && <div style={{padding:'0 16px 8px'}}>
              <input
                placeholder="Добавить участника..."
                value={addMemberQuery}
                onChange={async e=>{setAddMemberQuery(e.target.value);if(e.target.value.length>=1&&user){const r=await searchUsers(e.target.value,user.id);setAddMemberResults(r.filter(u=>!conv.members.some(m=>m.user_id===u.id)))}else setAddMemberResults([])}}
              />
              {addMemberResults.length>0 && <div style={{background:'var(--surface)',borderRadius:8,marginTop:4,overflow:'hidden'}}>
                {addMemberResults.map(u=><div key={u.id} className="group-member-row" onClick={async()=>{if(!user)return;const{error}=await addGroupMember(id!,u.id,user.id);if(error){toast.error('Не удалось добавить участника');return;}setAddMemberQuery('');setAddMemberResults([]);await fetchConversations(user.id)}}>
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt="" style={{width:42,height:42,borderRadius:21,objectFit:'cover'}} />
                    : <div className="av" style={{width:42,height:42,borderRadius:21,background:avatarColor(u.id),fontSize: 'var(--fs-snap16)'}}>{u.display_name?.[0]?.toUpperCase()}</div>
                  }
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize: 'var(--fs-body)',color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{u.display_name}</div>
                    <div style={{fontSize: 'var(--fs-caption)',color:'var(--muted)'}}>Нажми, чтобы добавить</div>
                  </div>
                  <span style={{color:'var(--accent)',fontSize: 'var(--fs-title)',fontWeight:300}}>+</span>
                </div>)}
              </div>}
            </div>}

            {conv.members.map(m=>{
              const mu=(m as any)?.user; if(!mu) return null;
              const isMe=mu.id===user?.id;
              const myRole=conv.members.find(x=>x.user_id===user?.id)?.role;
              return <div key={mu.id} className="group-member-row" style={{position:'relative'}} onClick={()=>{
                if(isMe||myRole!=='admin') return;
                setMemberMenu(memberMenu===mu.id?null:mu.id);
              }}>
                {mu.avatar_url
                  ? <img src={mu.avatar_url} alt="" style={{width:42,height:42,borderRadius:21,objectFit:'cover'}} />
                  : <div className="av" style={{width:42,height:42,borderRadius:21,background:avatarColor(mu.id),fontSize: 'var(--fs-snap16)'}}>{mu.display_name?.[0]?.toUpperCase()}</div>
                }
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize: 'var(--fs-body)',color:'var(--text)',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {mu.display_name}{isMe && <span style={{color:'var(--muted)',fontWeight:400}}> (вы)</span>}
                  </div>
                  <div style={{fontSize: 'var(--fs-caption)',color: m.role==='admin' ? 'var(--accent)' : 'var(--muted)'}}>
                    {m.role==='admin' ? 'владелец' : (mu.status==='online' ? 'в сети' : 'был(а) недавно')}
                  </div>
                </div>
                {memberMenu===mu.id&&<div className="ctx-menu member-menu" style={{top:'100%', bottom:'auto', right:16, left:'auto', marginTop:6, marginBottom:0, zIndex:10}}>
                  {m.role!=='admin'&&<button onClick={async(e)=>{e.stopPropagation();const{error}=await supabase.from('conversation_members').update({role:'admin'}).eq('conversation_id',id).eq('user_id',mu.id);if(error)toast.error('Ошибка: '+error.message);setMemberMenu(null);if(user){await fetchConversations(user.id);}}}>Назначить админом</button>}
                  <button onClick={async(e)=>{e.stopPropagation();if(!confirm('Удалить '+mu.display_name+'?'))return;const{error}=await removeGroupMember(id!,mu.id);if(error)toast.error('Ошибка: '+error);setMemberMenu(null);if(user){await fetchConversations(user.id);}}} className="ctx-danger">Удалить из группы</button>
                </div>}
              </div>
            })}
          </div>

          {/* Г6 — медиа/файлы/ссылки группы */}
          <div className="profile-tabs" style={{marginTop:8}}>
            <button className={'p-tab'+(groupTab==='media'?' active':'')} onClick={()=>{setGroupTab('media');if(id)fetchMediaGallery(id).then(setGallery).catch(()=>{})}}>Медиа</button>
            <button className={'p-tab'+(groupTab==='files'?' active':'')} onClick={()=>{setGroupTab('files');if(id)fetchMediaGallery(id).then(setGallery).catch(()=>{})}}>Файлы</button>
            <button className={'p-tab'+(groupTab==='links'?' active':'')} onClick={()=>setGroupTab('links')}>Ссылки</button>
          </div>
          <div className="profile-content" key={groupTab}>
            {groupTab==='media' && (gallery.filter(a=>a.mime_type?.startsWith('image/')).length===0
              ? <div style={{textAlign:'center',color:'var(--muted)',padding:'28px 16px',fontSize: 'var(--fs-label)'}}>Нет медиафайлов</div>
              : <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:2}}>
                  {gallery.filter(a=>a.mime_type?.startsWith('image/')).map(a=>
                    <img key={a.id} src={a.file_url} alt="" onClick={()=>setPreview(a.file_url)} style={{width:'100%',aspectRatio:'1',objectFit:'cover',cursor:'pointer'}} />)}
                </div>)}
            {groupTab==='files' && (gallery.filter(a=>!a.mime_type?.startsWith('image/') && !(a.file_name?.startsWith('voice_')||a.mime_type?.startsWith('audio/'))).length===0
              ? <div style={{textAlign:'center',color:'var(--muted)',padding:'28px 16px',fontSize: 'var(--fs-label)'}}>Нет файлов</div>
              : <div>
                  {gallery.filter(a=>!a.mime_type?.startsWith('image/') && !(a.file_name?.startsWith('voice_')||a.mime_type?.startsWith('audio/'))).map(a=>
                    <div key={a.id} onClick={()=>{ haptic.tap(); setProfileFileMenu(a); }} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderBottom:'1px solid var(--border)',cursor:'pointer'}}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize: 'var(--fs-label)',color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.file_name}</div>
                        <div style={{fontSize: 'var(--fs-micro)',color:'var(--muted)'}}>{formatFileSize(a.file_size)}</div>
                      </div>
                    </div>)}
                </div>)}
            {groupTab==='links' && (() => {
              const linkMsgs = currentMessages.filter(m => !(m as any).is_encrypted && !(m as any).deleted_at && extractUrl(m.content || ''));
              if (linkMsgs.length === 0) return <div style={{textAlign:'center',color:'var(--muted)',padding:'28px 16px',fontSize: 'var(--fs-label)'}}>Нет ссылок</div>;
              return <div>
                {linkMsgs.map(m => {
                  const url = extractUrl(m.content || '')!;
                  let host = url; try { host = new URL(url).hostname.replace(/^www\./,''); } catch { /* keep */ }
                  return (
                    <div key={m.id} onClick={()=>window.open(url,'_blank')} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderBottom:'1px solid var(--border)',cursor:'pointer'}}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize: 'var(--fs-label)',color:'var(--accent)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{host}</div>
                        <div style={{fontSize: 'var(--fs-micro)',color:'var(--muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{url}</div>
                      </div>
                    </div>
                  );
                })}
              </div>;
            })()}
          </div>

          <div style={{padding:'0 16px 24px'}}>
            <button onClick={()=>{if(user&&confirm('Покинуть группу?'))leaveGroup(id!,user.id).then(() => nav('/chats')).catch(e => console.error('leaveGroup:', e))}}
              className="group-danger-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Покинуть группу
            </button>
            {conv.members.find(x=>x.user_id===user?.id)?.role==='admin'&&<button
              onClick={()=>{if(confirm('Удалить группу навсегда? Все сообщения будут потеряны.'))deleteGroup(id!).then(() => nav('/chats')).catch(e => console.error('deleteGroup:', e))}}
              className="group-danger-btn" style={{marginTop:8,opacity:0.75}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              Удалить группу
            </button>}
          </div>
          </div>
        </div>
      </div>}

      {showAuctionCreator && user && id && conv?.type==='group' && (
        <AuctionCreator
          conversationId={id}
          creatorId={user.id}
          onClose={() => setShowAuctionCreator(false)}
        />
      )}

      {showTinderBetSheet && user && id && conv?.type==='group' && isOwnerEmail(user.email) && (
        <CreateTinderBetSheet
          conversationId={id}
          onCreated={() => setShowTinderBetSheet(false)}
          onClose={() => setShowTinderBetSheet(false)}
        />
      )}

      {showTinderWidget && user && id && (
        <TinderWidget
          conversationId={id}
          userId={user.id}
          onClose={() => setShowTinderWidget(false)}
        />
      )}

      {profileFileMenu && createPortal(
        <div className="profile-file-action-scrim" onClick={() => setProfileFileMenu(null)}>
          <div className="profile-file-action-sheet" onClick={e => e.stopPropagation()}>
            <div className="profile-file-action-head">
              <div className="profile-file-action-name">{profileFileMenu.file_name || 'Файл'}</div>
              <div className="profile-file-action-meta">{formatFileSize(profileFileMenu.file_size)}</div>
            </div>
            <button className="profile-file-action-btn" onClick={() => showProfileFileInChat(profileFileMenu)}>
              <span className="profile-file-action-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z"/><circle cx="12" cy="12" r="2.5"/></svg></span>
              Показать в чате
            </button>
            <button className="profile-file-action-btn" onClick={() => forwardProfileFile(profileFileMenu)}>
              <span className="profile-file-action-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="m14 5 7 7-7 7v-4c-5 0-8.5 1.4-11 4 1-6 4.5-10 11-10V5Z"/></svg></span>
              Переслать
            </button>
            <button className="profile-file-action-btn" onClick={() => downloadProfileFile(profileFileMenu)}>
              <span className="profile-file-action-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg></span>
              Скачать
            </button>
          </div>
        </div>,
        document.body,
      )}

      {forwardMsgs && user && (
        <ForwardSheet
          msgs={forwardMsgs}
          myId={user.id}
          currentConvId={id}
          onClose={() => setForwardMsgs(null)}
        />
      )}
    </div>
  );
}

function ForwardSheet({ msgs, myId, currentConvId, onClose }: { msgs: MessageWithSender[]; myId: string; currentConvId?: string; onClose: () => void }) {
  const nav = useNavigate();
  const conversations = useChatStore(s => s.conversations);
  const forwardMessage = useChatStore(s => s.forwardMessage);
  const fetchConversations = useChatStore(s => s.fetchConversations);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => { if (conversations.length === 0) fetchConversations(myId); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const convName = (c: any) => c.is_saved ? 'Избранное' : (c.name || (c.members?.find((mm: any) => mm.user_id !== myId || mm.id !== myId)?.user?.display_name) || 'Чат');
  const list = conversations.filter(c => {
    if ((c as any).is_encrypted) return false; // нельзя пересылать в защищённый чат
    if (!q.trim()) return true;
    return (convName(c) || '').toLowerCase().includes(q.trim().toLowerCase());
  });

  const doForward = async (convId: string) => {
    if (busy) return;
    setBusy(convId);
    let err: string | null = null;
    for (const m of msgs) {
      const { error } = await forwardMessage(convId, myId, m);
      if (error) { err = error; break; }
    }
    setBusy(null);
    if (err) { toast.error('Не удалось: ' + err); return; }
    toast.success(msgs.length > 1 ? `Переслано (${msgs.length})` : 'Переслано');
    onClose();
    if (convId !== currentConvId) nav('/chat/' + convId);
  };

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:400, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'flex-end' }}>
      <div onClick={e => e.stopPropagation()} className="share-sheet-enter" style={{ width:'100%', maxHeight:'80vh', display:'flex', flexDirection:'column', background:'var(--bg)', color:'var(--text)', borderRadius:'var(--r-xl, 20px) var(--r-xl, 20px) 0 0', padding:'12px 14px max(20px, env(safe-area-inset-bottom, 20px))' }}>
        <div style={{ display:'flex', justifyContent:'center', marginBottom:10 }}>
          <div style={{ width:36, height:4, borderRadius:2, background:'var(--border)' }} />
        </div>
        <div style={{ fontSize: 'var(--fs-heading)', fontWeight:700, marginBottom:10 }}>Переслать в…</div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск чата" style={{ marginBottom:10 }} />
        <div style={{ overflowY:'auto', display:'flex', flexDirection:'column', gap:2 }}>
          {list.length === 0 && <div style={{ padding:16, textAlign:'center', color:'var(--muted)', fontSize: 'var(--fs-snap14)' }}>Чаты не найдены</div>}
          {list.map(c => (
            <button key={c.id} onClick={() => doForward(c.id)} disabled={!!busy} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 8px', border:'none', background:'transparent', color:'var(--text)', cursor:'pointer', textAlign:'left', borderRadius:10, opacity: busy && busy !== c.id ? 0.5 : 1 }}>
              <div style={{ width:42, height:42, borderRadius:21, flexShrink:0, overflow:'hidden', background:c.is_saved ? 'var(--text)' : 'var(--surface-light)', color:c.is_saved ? 'var(--bg)' : 'var(--text)', display:'flex', alignItems:'center', justifyContent:'center', fontSize: 'var(--fs-heading)', fontWeight:600 }}>
                {c.is_saved
                  ? <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4.8A2.8 2.8 0 0 1 8.8 2h6.4A2.8 2.8 0 0 1 18 4.8V22l-6-3.8L6 22V4.8Z"/></svg>
                  : c.avatar_url ? <img src={c.avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : (convName(c)[0] || '?').toUpperCase()}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize: 'var(--fs-body)', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{convName(c)}</div>
                <div style={{ fontSize: 'var(--fs-caption)', color:'var(--muted)' }}>{c.is_saved ? 'Личное хранилище' : (c.type === 'group' ? 'Группа' : 'Личный чат')}</div>
              </div>
              {busy === c.id && <span style={{ fontSize: 'var(--fs-caption)', color:'var(--muted)' }}>…</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
