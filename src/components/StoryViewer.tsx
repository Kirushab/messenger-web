import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useStoriesStore, StoryGroup, StoryReaction } from '@/stores/storiesStore';
import { useChatStore } from '@/stores/chatStore';
import { fmtRelative, avatarColor } from '@/lib/utils';
import { toast } from '@/stores/toastStore';
import type { User, StoryReplySnapshot } from '@/types';
import { bufferedAhead, initialBufferTarget, warmVideo } from '@/lib/videoWarmup';
import { supabase } from '@/lib/supabase';

const IMAGE_MS = 15000;
const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '🔥', '👏', '😍'];
const ALL_REACTIONS = ['❤️', '😂', '😮', '😢', '🔥', '👏', '😍', '🥰', '😎', '🤔', '😡', '👍', '👎', '🙏', '🎉', '💯', '😱', '🤯', '😴', '🤩', '😅', '😭', '🥳', '👀'];
// СА5 — частицы для россыпи сердец (предрассчитанные смещения)
async function persistStoryReplyPreview(convId: string, storyId: string, media: HTMLImageElement | HTMLVideoElement | null): Promise<string | null> {
  if (!media) return null;
  try {
    const sourceWidth = media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth;
    const sourceHeight = media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight;
    if (!sourceWidth || !sourceHeight) return null;
    const maxSide = 420;
    const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(media, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    if (!blob) return null;
    const path = `${convId}/story-replies/${storyId}_${Date.now()}.jpg`;
    const upload = supabase.storage.from('chat-files').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    const result = await Promise.race([
      upload,
      new Promise<{ error: { message: string } | null }>(resolve => window.setTimeout(() => resolve({ error: { message: 'preview-timeout' } }), 2200)),
    ]);
    if ((result as any)?.error) return null;
    return supabase.storage.from('chat-files').getPublicUrl(path).data.publicUrl || null;
  } catch {
    return null;
  }
}

const HEART_PARTICLES = [
  { dx: -70, dy: -150, s: 0.7, d: 0 }, { dx: 60, dy: -180, s: 0.9, d: 60 },
  { dx: -30, dy: -210, s: 0.6, d: 120 }, { dx: 90, dy: -130, s: 0.75, d: 30 },
  { dx: -90, dy: -110, s: 0.55, d: 90 }, { dx: 20, dy: -240, s: 0.8, d: 150 },
];

function MiniAvatar({ url, name, id, size = 34 }: { url: string | null; name: string; id: string; size?: number }) {
  if (url) return <img src={url} alt="" style={{ width: size, height: size, borderRadius: size / 2, objectFit: 'cover', flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: size / 2, flexShrink: 0, background: avatarColor(id), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: size * 0.44 }}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

export default function StoryViewer({ groups, startIndex, startStory = 0, origin, onClose }: { groups: StoryGroup[]; startIndex: number; startStory?: number; origin?: { x: number; y: number }; onClose: () => void }) {
  const { user } = useAuthStore();
  const { markViewed, deleteStory, loadStories, togglePin, loadViewers, reactToStory, loadStoryReactions, unlinkStoryFromEvent } = useStoriesStore();
  const { createDirectChat, sendMessage } = useChatStore();
  const nav = useNavigate();

  const [gi, setGi] = useState(startIndex);
  const [si, setSi] = useState(startStory);
  const [muted, setMuted] = useState(false);
  const [manualPaused, setManualPaused] = useState(false);
  const [pageHidden, setPageHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const [menu, setMenu] = useState(false);
  const [reply, setReply] = useState('');
  const [replyFocused, setReplyFocused] = useState(false);
  const [replySending, setReplySending] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [pinned, setPinned] = useState(false);
  const [viewers, setViewers] = useState<{ user: User; viewed_at: string }[]>([]);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [reactions, setReactions] = useState<StoryReaction[]>([]);
  const [burst, setBurst] = useState(0);
  const [burstChar, setBurstChar] = useState('❤️');
  const [burstHearts, setBurstHearts] = useState(false);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [videoBufferReady, setVideoBufferReady] = useState(false);
  const [videoBuffering, setVideoBuffering] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const [eventUnlinked, setEventUnlinked] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const startRef = useRef(0);
  const holdTimer = useRef<any>(null);
  const lastTapRef = useRef(0);
  const navTimerRef = useRef<any>(null);
  const bufferResumeTimerRef = useRef<number | null>(null);
  const playbackPausedRef = useRef(false);
  const gest = useRef({ x: 0, y: 0, held: false, dragging: false });

  const group = groups[gi];
  const story = group?.stories[si];
  const isMine = !!(story && user && story.user_id === user.id);
  const blocked = menu || viewersOpen || reactOpen;
  const playbackPaused = manualPaused || replyFocused || replySending || blocked || pageHidden;
  playbackPausedRef.current = playbackPaused;

  const nextVideoUrl = (() => {
    if (!story) return null;
    for (let groupOffset = 0; groupOffset < groups.length; groupOffset += 1) {
      const groupIndex = gi + groupOffset;
      if (groupIndex >= groups.length) break;
      const stories = groups[groupIndex]?.stories || [];
      const start = groupOffset === 0 ? si + 1 : 0;
      for (let storyIndex = start; storyIndex < stories.length; storyIndex += 1) {
        if (stories[storyIndex]?.media_type === 'video') return stories[storyIndex].media_url;
      }
    }
    return null;
  })();

  const evaluateVideoBuffer = useCallback((forceReady = false) => {
    const video = videoRef.current;
    if (!video) return false;
    const ahead = bufferedAhead(video);
    const target = initialBufferTarget(video);
    const nearEnd = Number.isFinite(video.duration) && video.duration > 0 && (video.duration - video.currentTime) <= 0.7;
    const ready = forceReady || video.readyState >= 4 || ahead >= target || nearEnd;
    if (ready) {
      setVideoBufferReady(true);
      setVideoBuffering(false);
    } else {
      setVideoBuffering(true);
    }
    return ready;
  }, []);

  const next = useCallback(() => {
    setElapsed(0); setMenu(false);
    setSi(cur => {
      if (cur + 1 < groups[gi].stories.length) return cur + 1;
      if (gi + 1 < groups.length) { setGi(gi + 1); return 0; }
      onClose();
      return cur;
    });
  }, [gi, groups, onClose]);

  const prev = useCallback(() => {
    setElapsed(0); setMenu(false);
    setSi(cur => {
      if (cur > 0) return cur - 1;
      if (gi > 0) { const pg = gi - 1; setGi(pg); return groups[pg].stories.length - 1; }
      return 0;
    });
  }, [gi, groups]);

  const nextGroup = () => { setElapsed(0); setMenu(false); if (gi + 1 < groups.length) { setGi(gi + 1); setSi(0); } else onClose(); };
  const prevGroup = () => { setElapsed(0); setMenu(false); if (gi > 0) { setGi(gi - 1); setSi(0); } };

  // Отметить просмотр чужой истории
  useEffect(() => {
    if (story && user && story.user_id !== user.id) markViewed(story.id, user.id);
  }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // СА8 — сброс состояния загрузки и прогресса при смене истории
  useEffect(() => {
    setMediaLoaded(false);
    setVideoBufferReady(story?.media_type !== 'video');
    setVideoBuffering(story?.media_type === 'video');
    setEventUnlinked(false);
    setManualPaused(false);
    setReplyFocused(false);
    setReplySending(false);
    setReply('');
    setElapsed(0);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (bufferResumeTimerRef.current) { window.clearTimeout(bufferResumeTimerRef.current); bufferResumeTimerRef.current = null; }
    const v = videoRef.current;
    if (v) {
      try { v.currentTime = 0; } catch { /* noop */ }
    }
  }, [story?.id, story?.media_type]);

  // Пока пользователь смотрит текущую историю, заранее прогреваем ближайшее следующее видео.
  // Браузер/CDN успевает скачать первые byte-ranges и переход реже начинается с пустого буфера.
  useEffect(() => {
    if (nextVideoUrl && nextVideoUrl !== story?.media_url) warmVideo(nextVideoUrl);
  }, [nextVideoUrl, story?.media_url]);

  // Синхронизация pin + список просмотревших для своих историй
  useEffect(() => {
    if (!story) return;
    setPinned(!!story.pinned_to_profile);
    if (isMine) { loadViewers(story.id).then(setViewers); loadStoryReactions(story.id).then(setReactions); } else { setViewers([]); setReactions([]); }
  }, [story?.id, isMine]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const syncVisibility = () => setPageHidden(document.hidden);
    document.addEventListener('visibilitychange', syncVisibility);
    return () => document.removeEventListener('visibilitychange', syncVisibility);
  }, []);

  // Таймер прогресса для фото: стартует только после загрузки медиа,
  // поэтому линия не убегает вперёд на медленном соединении/iOS Safari.
  useEffect(() => {
    if (!story || story.media_type === 'video' || playbackPaused || !mediaLoaded) return;
    startRef.current = performance.now() - elapsed * IMAGE_MS;
    const tick = (t: number) => {
      const e = Math.min(1, (t - startRef.current) / IMAGE_MS);
      setElapsed(e);
      if (e >= 1) { next(); return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [story?.id, playbackPaused, mediaLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    v.muted = muted;
    if (playbackPaused || (story?.media_type === 'video' && !videoBufferReady)) {
      v.pause();
      return;
    }
    v.play().catch(() => {});
  }, [muted, playbackPaused, story?.id, story?.media_type, videoBufferReady]);

  // Видео обновляет прогресс через RAF, а не только onTimeUpdate: на iOS
  // onTimeUpdate может приходить редко, из-за чего верхняя линия "замирает".
  useEffect(() => {
    if (!story || story.media_type !== 'video' || playbackPaused || !mediaLoaded) return;
    const tick = () => {
      const v = videoRef.current;
      if (v && v.duration) setElapsed(Math.max(0, Math.min(1, v.currentTime / v.duration)));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [story?.id, playbackPaused, mediaLoaded]);

  useEffect(() => () => {
    if (navTimerRef.current) clearTimeout(navTimerRef.current);
    if (bufferResumeTimerRef.current) window.clearTimeout(bufferResumeTimerRef.current);
  }, []);

  if (!group || !story) return null;

  const onVideoTime = () => {
    const v = videoRef.current; if (!v || !v.duration) return;
    setElapsed(Math.max(0, Math.min(1, v.currentTime / v.duration)));
  };
  const onVideoReady = () => {
    const v = videoRef.current;
    if (v && v.duration) setElapsed(Math.max(0, Math.min(1, v.currentTime / v.duration)));
    setMediaLoaded(true);
    evaluateVideoBuffer(false);
  };
  const onVideoProgress = () => {
    const ready = evaluateVideoBuffer(false);
    const v = videoRef.current;
    if (ready && v && !playbackPaused && v.paused) v.play().catch(() => {});
  };
  const onVideoWaiting = () => {
    setVideoBuffering(true);
    const v = videoRef.current;
    if (!v) return;
    // На медленной сети даём плееру накопить небольшой запас вместо серии
    // коротких play/waiting/play рывков.
    if (bufferedAhead(v) < 0.45 && !v.paused) {
      try { v.pause(); } catch {}
      if (bufferResumeTimerRef.current) window.clearTimeout(bufferResumeTimerRef.current);
      const retry = () => {
        const current = videoRef.current;
        if (!current || playbackPausedRef.current) return;
        if (bufferedAhead(current) >= 1.25 || current.readyState >= 4) {
          setVideoBuffering(false);
          current.play().catch(() => {});
          bufferResumeTimerRef.current = null;
        } else {
          bufferResumeTimerRef.current = window.setTimeout(retry, 180);
        }
      };
      bufferResumeTimerRef.current = window.setTimeout(retry, 180);
    }
  };
  const onVideoPlaying = () => setVideoBuffering(false);

  // ---- Жесты: тап (нав), удержание (пауза), свайп вниз (закрыть), свайп вбок (автор) ----
  const onDown = (e: React.PointerEvent) => {
    gest.current = { x: e.clientX, y: e.clientY, held: false, dragging: false };
    holdTimer.current = setTimeout(() => { gest.current.held = true; setManualPaused(true); }, 220);
  };
  const onMove = (e: React.PointerEvent) => {
    const g = gest.current;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.dragging && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      clearTimeout(holdTimer.current);
      g.dragging = true;
      if (g.held) { g.held = false; setManualPaused(false); }
    }
    if (g.dragging && dy > 0 && dy > Math.abs(dx)) setDragY(dy);
  };
  const onUp = (e: React.PointerEvent) => {
    clearTimeout(holdTimer.current);
    const g = gest.current;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    const w = (e.currentTarget as HTMLElement).clientWidth || window.innerWidth;
    setDragY(0);
    if (g.held) { setManualPaused(false); return; }
    if (g.dragging) {
      if (dy < -50 && Math.abs(dy) > Math.abs(dx) && !isMine) { setReactOpen(true); return; } // свайп вверх → реакции
      if (dy > 110 && dy > Math.abs(dx)) { onClose(); return; }                                // свайп вниз → закрыть
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) { if (dx < 0) nextGroup(); else prevGroup(); return; } // свайп вбок
      return;
    }
    // тап: края — мгновенная навигация; центр — двойной тап = лайк
    const tapX = e.clientX;
    const leftZone = tapX < w * 0.28;
    const rightZone = tapX > w * 0.72;
    if (leftZone) { lastTapRef.current = 0; if (navTimerRef.current) { clearTimeout(navTimerRef.current); navTimerRef.current = null; } prev(); return; }
    if (rightZone) { lastTapRef.current = 0; if (navTimerRef.current) { clearTimeout(navTimerRef.current); navTimerRef.current = null; } next(); return; }
    // центр
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      lastTapRef.current = 0;
      if (navTimerRef.current) { clearTimeout(navTimerRef.current); navTimerRef.current = null; }
      if (!isMine) sendReaction('❤️'); // двойной тап в центре → лайк
      return;
    }
    lastTapRef.current = now;
    if (navTimerRef.current) clearTimeout(navTimerRef.current);
    navTimerRef.current = setTimeout(() => { navTimerRef.current = null; next(); }, 280); // одиночный тап в центре → дальше
  };

  const doReply = async (text: string) => {
    const value = text.trim();
    if (!user || !value || replySending) return;
    setReplySending(true);
    setReplyFocused(true);
    try {
      const { id, error } = await createDirectChat(user.id, story.user_id);
      if (error || !id) { toast.error('Не удалось отправить'); return; }
      const previewUrl = await persistStoryReplyPreview(id, story.id, story.media_type === 'video' ? videoRef.current : imageRef.current);
      const snapshot: StoryReplySnapshot = {
        story_id: story.id,
        author_id: story.user_id,
        author_name: group.user.display_name || 'История',
        media_url: story.media_url || null,
        preview_url: previewUrl,
        media_type: story.media_type,
        caption: story.caption || null,
        story_created_at: story.created_at || null,
      };
      const result = await sendMessage(id, user.id, value, undefined, { storyReplySnapshot: snapshot });
      if (result.error) { toast.error('Не удалось отправить'); return; }
      setReply('');
      setReplyFocused(false);
      if (replyInputRef.current) replyInputRef.current.style.height = '52px';
      replyInputRef.current?.blur();
      toast.success('Комментарий отправлен');
    } finally {
      setReplySending(false);
    }
  };

  const sendReaction = (emoji: string) => {
    if (!user || isMine) return;
    setBurstChar(emoji);
    setBurstHearts(emoji === '❤️');
    setBurst(b => b + 1);
    setReactOpen(false);
    reactToStory(story.id, user.id, emoji); // видна автору в «Просмотрах»
  };

  const onDelete = async () => {
    setMenu(false);
    await deleteStory(story.id);
    toast.success('История удалена');
    if (user) await loadStories(user.id);
    next();
  };

  const onTogglePin = async () => {
    const np = !pinned;
    setPinned(np); setMenu(false);
    await togglePin(story.id, np);
    toast.success(np ? 'История закреплена в профиле' : 'Убрана из профиля');
  };

  const onUnlinkEvent = async () => {
    setMenu(false);
    setEventUnlinked(true);
    await unlinkStoryFromEvent(story.id);
    toast.success('История откреплена от события');
  };

  const muteIcon = muted
    ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg>
    : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>;

  const reactionByUser: Record<string, string> = {};
  reactions.forEach(r => { reactionByUser[r.user.id] = r.emoji; });
  const reactionSummary: { emoji: string; count: number }[] = [];
  reactions.forEach(r => {
    const ex = reactionSummary.find(x => x.emoji === r.emoji);
    if (ex) ex.count++; else reactionSummary.push({ emoji: r.emoji, count: 1 });
  });

  // Портал в body: fixed-позиционирование ломается внутри предков с transform
  // (route-анимации/свайпы) — вьювер занимал часть экрана, снизу просвечивал список.
  return createPortal(
    <div className={'story-viewer' + (origin ? ' from-origin' : '')} style={{
      transformOrigin: origin ? `${origin.x}px ${origin.y}px` : undefined,
      transform: dragY ? `translateY(${dragY}px)` : undefined,
      borderRadius: dragY ? Math.min(28, dragY / 6) : 0,
      overflow: 'hidden',
      opacity: dragY ? Math.max(0.4, 1 - dragY / 500) : 1,
      transition: dragY ? 'none' : 'transform 0.22s ease, opacity 0.22s ease, border-radius 0.22s ease',
    }}>
      <div className="sv-segments">
        {group.stories.map((s, i) => (
          <div className={'sv-seg' + (i === si ? ' active' : '')} key={s.id}>
            <div
              className="sv-seg-fill"
              style={{ transform: `scaleX(${i < si ? 1 : i === si ? elapsed : 0})` }}
            />
          </div>
        ))}
      </div>

      <div className="sv-header">
        <div className="sv-author">
          <MiniAvatar url={group.user.avatar_url} name={group.user.display_name} id={group.user.id} />
          <div style={{ minWidth: 0 }}>
            <div className="sv-name">{group.user.display_name}{pinned && isMine && <span style={{ fontSize: 'var(--fs-micro)', color: 'rgba(255,255,255,0.7)', marginLeft: 6 }}>· в профиле</span>}</div>
            <div className="sv-time">{fmtRelative(story.created_at)}</div>
          </div>
        </div>
        <div className="sv-actions">
          {story.media_type === 'video' && <button onClick={() => setMuted(m => !m)} aria-label="Звук">{muteIcon}</button>}
          {isMine && (
            <button onClick={() => setMenu(m => !m)} aria-label="Меню">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
            </button>
          )}
          <button onClick={onClose} aria-label="Закрыть">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        {menu && isMine && (
          <div className="sv-menu">
            <button style={{ color: 'var(--text)' }} onClick={onTogglePin}>{pinned ? 'Убрать из профиля' : 'Показывать в профиле'}</button>
            {story.event_id && !eventUnlinked && <button style={{ color: 'var(--text)' }} onClick={onUnlinkEvent}>Открепить от события</button>}
            <button onClick={onDelete}>Удалить историю</button>
          </div>
        )}
      </div>

      <div className="sv-media" key={story.id}>
        {story.media_type === 'video'
          ? <video ref={videoRef} crossOrigin="anonymous" src={story.media_url} playsInline autoPlay muted={muted} preload="auto" onLoadedMetadata={onVideoReady} onLoadedData={onVideoReady} onCanPlay={onVideoProgress} onCanPlayThrough={() => evaluateVideoBuffer(true)} onProgress={onVideoProgress} onWaiting={onVideoWaiting} onStalled={onVideoWaiting} onPlaying={onVideoPlaying} onTimeUpdate={onVideoTime} onEnded={next} className={mediaLoaded ? 'sv-media-el sv-loaded' : 'sv-media-el'} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          : <img ref={imageRef} crossOrigin="anonymous" src={story.media_url} alt="" onLoad={() => setMediaLoaded(true)} className={mediaLoaded ? 'sv-media-el sv-loaded' : 'sv-media-el'} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />}
        {!mediaLoaded && <div className="sv-skeleton" />}
        {story.media_type === 'video' && videoBuffering && <div className="sv-buffering" aria-label="Загрузка видео"><span className="sv-buffer-spinner" /></div>}
      </div>

      <div className="sv-gesture" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { clearTimeout(holdTimer.current); gest.current.held = false; setManualPaused(false); }} />

      {story.event && !eventUnlinked && (
        <button className="sv-event-chip" onClick={() => { onClose(); nav('/events/' + story.event!.id); }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span>{story.event.title}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      )}

      {story.caption && (
        <div className="sv-caption-wrap" style={{ bottom: `calc(env(safe-area-inset-bottom, 0px) + ${isMine ? 74 : 124}px)` }}>
          <span className="sv-caption-plate">{story.caption}</span>
        </div>
      )}

      {isMine ? (
        <div className="sv-footer">
          <button className="sv-viewers" onClick={() => setViewersOpen(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            {viewers.length > 0 ? `${viewers.length}` : 'Нет просмотров'}
          </button>
        </div>
      ) : (
        <div className="sv-footer-col">
          <div className="sv-footer">
            <textarea
              ref={replyInputRef}
              className="sv-reply"
              value={reply}
              rows={1}
              onChange={e => {
                setReply(e.target.value);
                e.currentTarget.style.height = 'auto';
                e.currentTarget.style.height = `${Math.min(104, Math.max(52, e.currentTarget.scrollHeight))}px`;
              }}
              onFocus={() => setReplyFocused(true)}
              onBlur={() => setReplyFocused(false)}
              placeholder="Комментарий к истории..."
            />
            {(replyFocused || reply.trim()) ? (
              <button
                className="sv-send-reply"
                onPointerDown={e => e.preventDefault()}
                onClick={() => void doReply(reply)}
                disabled={!reply.trim() || replySending}
                aria-label="Отправить комментарий"
              >
                {replySending
                  ? <span className="sv-send-reply-spinner" />
                  : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>}
              </button>
            ) : (
              <button className="sv-like" onClick={() => sendReaction('❤️')} aria-label="Нравится">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"/></svg>
              </button>
            )}
          </div>
        </div>
      )}

      {burst > 0 && (
        <div className="sv-burst-layer" key={burst}>
          <span className="sv-heart-burst" style={{ fontSize: 104, lineHeight: 1 }}>{burstChar}</span>
          {burstHearts && HEART_PARTICLES.map((p, i) => (
            <span key={i} className="sv-heart-particle" style={{ ['--dx' as any]: p.dx + 'px', ['--dy' as any]: p.dy + 'px', ['--s' as any]: p.s, animationDelay: p.d + 'ms' }}>❤️</span>
          ))}
        </div>
      )}

      {reactOpen && (
        <div className="sv-react-sheet" onClick={() => setReactOpen(false)}>
          <div className="sv-react-card" onClick={e => e.stopPropagation()}>
            <div className="sv-viewers-grip" />
            <div className="sv-viewers-title">Отправить реакцию</div>
            <div className="sv-react-grid">
              {ALL_REACTIONS.map((em, i) => (
                <button key={i} className="sv-react-big" onClick={() => sendReaction(em)}>{em}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {viewersOpen && (
        <div className="sv-viewers-sheet" onClick={() => setViewersOpen(false)}>
          <div className="sv-viewers-card" onClick={e => e.stopPropagation()}>
            <div className="sv-viewers-grip" />
            <div className="sv-viewers-title">Просмотры · {viewers.length}{reactions.length > 0 ? `  ·  реакций: ${reactions.length}` : ''}</div>
            {reactionSummary.length > 0 && (
              <div className="sv-react-summary">
                {reactionSummary.map(rs => (
                  <div className="sv-react-sum-chip" key={rs.emoji}><span>{rs.emoji}</span>{rs.count}</div>
                ))}
              </div>
            )}
            <div className="sv-viewers-list">
              {viewers.length === 0 && <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--fs-snap14)' }}>Пока никто не посмотрел</div>}
              {viewers.map(v => (
                <div className="sv-viewer-row" key={v.user.id}>
                  <MiniAvatar url={v.user.avatar_url} name={v.user.display_name} id={v.user.id} size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--fs-snap14)', fontWeight: 600, color: 'var(--text)' }}>{v.user.display_name}</div>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)' }}>{fmtRelative(v.viewed_at)}</div>
                  </div>
                  {reactionByUser[v.user.id] && <span className="sv-viewer-react">{reactionByUser[v.user.id]}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  , document.body);
}
