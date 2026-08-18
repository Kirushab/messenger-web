import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { toast } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { compressImage } from '@/lib/compress';
import { captureVideoPoster } from '@/lib/mediaPreview';
import { avatarColor } from '@/lib/utils';
import EventSection from '@/components/EventSection';
import { IconCamera } from '@/components/icons/EventIcons';

interface EventMedia {
  id: string;
  event_id: string;
  user_id: string;
  file_url: string;
  storage_path: string | null;
  preview_url?: string | null;
  preview_path?: string | null;
  mime_type: string;
  width?: number | null;
  height?: number | null;
  created_at: string;
  user?: { id: string; display_name: string; avatar_url: string | null };
}

const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
const isVideoMedia = (item: EventMedia) => item.mime_type?.startsWith('video/');

export default function EventGallery({ eventId, canUpload }: { eventId: string; canUpload: boolean }) {
  const { user } = useAuthStore();
  const [media, setMedia] = useState<EventMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [previewRect, setPreviewRect] = useState<DOMRect | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = async () => {
    const { data } = await supabase
      .from('event_photos')
      .select('*, user:users(id, display_name, avatar_url)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
    setMedia((data || []) as EventMedia[]);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ch = supabase.channel(`event-media-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_photos', filter: `event_id=eq.${eventId}` }, () => reload())
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  const uploadImage = async (file: File) => {
    if (!user) return;
    const compressed = await compressImage(file, 1600, 0.85);
    const ext = compressed.type.includes('webp') ? 'webp' : compressed.type.includes('png') ? 'png' : 'jpg';
    const base = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const path = `${eventId}/${user.id}/${base}.${ext}`;
    const { error: upErr } = await supabase.storage.from('event-photos').upload(path, compressed, { upsert: false, contentType: compressed.type });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from('event-photos').getPublicUrl(path);
    const { error: insertErr } = await supabase.from('event_photos').insert({
      event_id: eventId,
      user_id: user.id,
      file_url: pub.publicUrl,
      storage_path: path,
      mime_type: compressed.type,
    });
    if (insertErr) throw insertErr;
  };

  const uploadVideo = async (file: File) => {
    if (!user) return;
    if (file.size > MAX_VIDEO_SIZE) throw new Error('Видео должно быть не больше 50 МБ');

    const base = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const rawExt = (file.name.split('.').pop() || (file.type === 'video/quicktime' ? 'mov' : 'mp4')).replace(/[^a-z0-9]/gi, '').toLowerCase();
    const path = `${eventId}/${user.id}/${base}.${rawExt || 'mp4'}`;

    let previewUrl: string | null = null;
    let previewPath: string | null = null;
    let width: number | null = null;
    let height: number | null = null;
    const localUrl = URL.createObjectURL(file);
    try {
      try {
        const poster = await captureVideoPoster(localUrl, false);
        width = poster.width;
        height = poster.height;
        previewPath = `${eventId}/${user.id}/previews/${base}.jpg`;
        const { error: posterErr } = await supabase.storage.from('event-photos').upload(previewPath, poster.blob, {
          upsert: false,
          contentType: 'image/jpeg',
        });
        if (!posterErr) {
          const { data: posterPublic } = supabase.storage.from('event-photos').getPublicUrl(previewPath);
          previewUrl = posterPublic.publicUrl;
        } else {
          previewPath = null;
        }
      } catch {
        // Video can still be uploaded if poster extraction is unavailable on the device.
      }

      const { error: upErr } = await supabase.storage.from('event-photos').upload(path, file, {
        upsert: false,
        contentType: file.type || 'video/mp4',
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('event-photos').getPublicUrl(path);
      const { error: insertErr } = await supabase.from('event_photos').insert({
        event_id: eventId,
        user_id: user.id,
        file_url: pub.publicUrl,
        storage_path: path,
        preview_url: previewUrl,
        preview_path: previewPath,
        mime_type: file.type || 'video/mp4',
        width,
        height,
      });
      if (insertErr) throw insertErr;
    } catch (error) {
      const cleanup = [path, previewPath].filter(Boolean) as string[];
      if (cleanup.length) { try { await supabase.storage.from('event-photos').remove(cleanup); } catch { /* noop */ } }
      throw error;
    } finally {
      URL.revokeObjectURL(localUrl);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || !user || uploading || !canUpload) return;
    const picked = Array.from(files).filter(file => file.type.startsWith('image/') || file.type.startsWith('video/')).slice(0, 12);
    if (!picked.length) return;
    setUploading(true);
    try {
      for (const file of picked) {
        try {
          if (file.type.startsWith('video/')) await uploadVideo(file);
          else await uploadImage(file);
        } catch (error: any) {
          toast.error(error?.message ? `Не удалось загрузить ${file.name}: ${error.message}` : `Не удалось загрузить ${file.name}`);
        }
      }
      await reload();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (item: EventMedia) => {
    if (!canUpload || !confirm(isVideoMedia(item) ? 'Удалить видео?' : 'Удалить фото?')) return;
    const paths = [item.storage_path, item.preview_path].filter(Boolean) as string[];
    if (paths.length) await supabase.storage.from('event-photos').remove(paths);
    await supabase.from('event_photos').delete().eq('id', item.id);
  };

  return (
    <>
      <EventSection
        title={`Медиа${media.length > 0 ? ` · ${media.length}` : ''}`}
        subtitle={media.length > 0 ? 'Фото и видео участников' : undefined}
        icon={<IconCamera size={18} />}
        iconBg="rgba(236, 72, 153, 0.12)"
        iconColor="#EC4899"
        action={canUpload && (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="tap-effect"
            style={{
              background:'var(--text)', border:'none',
              width:32, height:32, borderRadius:16, padding:0,
              color:'var(--bg)', cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center',
              opacity:uploading?0.55:1,
            }}
            aria-label="Добавить фото или видео"
            title="Добавить фото или видео"
          >
            {uploading
              ? <span className="btn-spin-sm" aria-hidden="true" />
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>}
          </button>
        )}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={e => handleFiles(e.target.files)}
          style={{display:'none'}}
        />

        {loading && <div style={{padding:20,textAlign:'center'}}><div className="spinner" style={{margin:'0 auto'}} /></div>}

        {!loading && media.length === 0 && (
          <div style={{padding:'14px 8px',textAlign:'center',color:'var(--muted)',fontSize:'var(--fs-caption)'}}>
            {canUpload ? 'Добавьте фото или видео события' : 'Здесь появятся фото и видео события'}
          </div>
        )}

        {!loading && media.length > 0 && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(3, minmax(0, 1fr))',gap:4}}>
            {media.map((item, i) => {
              const video = isVideoMedia(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={(e) => {
                    setPreviewRect((e.currentTarget as HTMLElement).getBoundingClientRect());
                    setPreviewIdx(i);
                  }}
                  style={{
                    position:'relative', aspectRatio:'1/1', background:'#0b0b0d', cursor:'pointer', overflow:'hidden', borderRadius:10,
                    border:'none', padding:0, display:'block',
                  }}
                >
                  {video ? (
                    item.preview_url
                      ? <img src={item.preview_url} alt="" loading="lazy" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} />
                      : <video src={item.file_url} muted playsInline preload="metadata" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} />
                  ) : (
                    <img src={item.file_url} alt="" loading="lazy" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} />
                  )}
                  {video && (
                    <span style={{
                      position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)',
                      width:34, height:34, borderRadius:17, background:'rgba(0,0,0,.56)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)',
                      display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', boxShadow:'0 4px 14px rgba(0,0,0,.24)',
                    }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </EventSection>

      {previewIdx !== null && media[previewIdx] && (
        <MediaPreview
          media={media[previewIdx]}
          total={media.length}
          idx={previewIdx}
          fromRect={previewRect}
          canDelete={canUpload && user?.id === media[previewIdx].user_id}
          onClose={() => { setPreviewIdx(null); setPreviewRect(null); }}
          onPrev={() => setPreviewIdx(i => i! > 0 ? i! - 1 : i!)}
          onNext={() => setPreviewIdx(i => i! < media.length - 1 ? i! + 1 : i!)}
          onDelete={() => { const item = media[previewIdx]; setPreviewIdx(null); setPreviewRect(null); void handleDelete(item); }}
        />
      )}
    </>
  );
}

function MediaPreview({ media, total, idx, fromRect, canDelete, onClose, onPrev, onNext, onDelete }: {
  media: EventMedia; total: number; idx: number;
  fromRect: DOMRect | null;
  canDelete: boolean;
  onClose: () => void; onPrev: () => void; onNext: () => void; onDelete: () => void;
}) {
  const video = isVideoMedia(media);
  const [phase, setPhase] = useState<'entering' | 'open' | 'closing'>(fromRect && !video ? 'entering' : 'open');
  const [dragY, setDragY] = useState(0);
  const startYRef = useRef<number | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.dataset.eventMediaViewer = 'true';
    return () => {
      document.body.style.overflow = previousOverflow;
      delete document.body.dataset.eventMediaViewer;
    };
  }, []);

  useEffect(() => {
    if (phase === 'entering') requestAnimationFrame(() => requestAnimationFrame(() => setPhase('open')));
  }, [phase]);

  const close = () => {
    if (phase === 'closing') return;
    if (!fromRect || video) { onClose(); return; }
    setPhase('closing');
    setTimeout(onClose, 280);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (video || e.touches.length !== 1) return;
    startYRef.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (video || startYRef.current === null) return;
    const dy = e.touches[0].clientY - startYRef.current;
    if (Math.abs(dy) > 5) setDragY(dy);
  };
  const onTouchEndH = () => {
    if (video) return;
    if (Math.abs(dragY) > 100) close(); else setDragY(0);
    startYRef.current = null;
  };

  const isOpen = phase === 'open';
  let bgOpacity = 1;
  if (phase === 'entering' || phase === 'closing') bgOpacity = 0;
  if (isOpen && !video) bgOpacity = Math.max(0.4, 1 - Math.abs(dragY) / 400);

  const imageStyle: React.CSSProperties = isOpen
    ? {
        position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'contain',
        transform: dragY !== 0 ? `translateY(${dragY}px) scale(${Math.max(0.85, 1 - Math.abs(dragY)/1500)})` : 'translateY(0) scale(1)',
        transition: dragY === 0 ? 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
      }
    : fromRect
      ? {
          position:'absolute', left:fromRect.left, top:fromRect.top, width:fromRect.width, height:fromRect.height,
          objectFit:'cover', transition: phase === 'closing' ? 'all 0.28s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
        }
      : { width:'100%', height:'100%', objectFit:'contain' };

  const chromeOpacity = (isOpen && (video || Math.abs(dragY) < 60)) ? 1 : 0;
  const chromeStyle: React.CSSProperties = { opacity:chromeOpacity, transition:'opacity .2s ease', pointerEvents:chromeOpacity === 0 ? 'none' : 'auto' };

  return createPortal(
    <div
      onClick={close}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEndH}
      style={{position:'fixed',inset:0,zIndex:10020,background:`rgba(0,0,0,${bgOpacity * 0.97})`,transition:'background .28s ease',isolation:'isolate'}}
    >
      {video ? (
        <video
          key={media.file_url}
          src={media.file_url}
          poster={media.preview_url || undefined}
          controls
          autoPlay
          playsInline
          preload="auto"
          onClick={e => e.stopPropagation()}
          style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'contain',background:'#000'}}
        />
      ) : (
        <img src={media.file_url} alt="" style={imageStyle} onClick={(e) => { e.stopPropagation(); close(); }} />
      )}

      <header
        onClick={e => e.stopPropagation()}
        style={{
          position:'absolute',top:0,left:0,right:0,display:'flex',alignItems:'center',gap:8,color:'#fff',
          padding:'max(12px, env(safe-area-inset-top, 12px)) 16px 12px',
          background:'linear-gradient(to bottom, rgba(0,0,0,.58), transparent)',zIndex:5,...chromeStyle,
        }}
      >
        <button onClick={close} aria-label="Закрыть" style={{width:40,height:40,borderRadius:20,background:'rgba(0,0,0,.62)',border:'1px solid rgba(255,255,255,.18)',color:'#fff',fontSize:'var(--fs-title)',cursor:'pointer',padding:0,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
        <div style={{flex:1,display:'flex',alignItems:'center',gap:8,minWidth:0}}>
          {media.user?.avatar_url
            ? <img src={media.user.avatar_url} alt="" style={{width:28,height:28,borderRadius:14,objectFit:'cover'}} />
            : <div style={{width:28,height:28,borderRadius:14,background:avatarColor(media.user_id),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'var(--fs-caption)',fontWeight:600}}>{(media.user?.display_name||'?')[0].toUpperCase()}</div>}
          <span style={{fontSize:'var(--fs-label)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{media.user?.display_name || '—'}</span>
        </div>
        <span style={{fontSize:'var(--fs-label)',color:'rgba(255,255,255,.72)'}}>{idx + 1}/{total}</span>
        {canDelete && (
          <button onClick={onDelete} aria-label="Удалить" style={{background:'none',border:'none',color:'#FF6B6B',cursor:'pointer',padding:4}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        )}
      </header>

      {idx > 0 && (
        <button onClick={(e) => { e.stopPropagation(); onPrev(); }} style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',width:42,height:42,borderRadius:21,background:'rgba(0,0,0,.62)',border:'1px solid rgba(255,255,255,.18)',color:'#fff',cursor:'pointer',fontSize:'var(--fs-snap24)',zIndex:5,...chromeStyle}}>‹</button>
      )}
      {idx < total - 1 && (
        <button onClick={(e) => { e.stopPropagation(); onNext(); }} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',width:42,height:42,borderRadius:21,background:'rgba(0,0,0,.62)',border:'1px solid rgba(255,255,255,.18)',color:'#fff',cursor:'pointer',fontSize:'var(--fs-snap24)',zIndex:5,...chromeStyle}}>›</button>
      )}
    </div>,
    document.body,
  );
}
