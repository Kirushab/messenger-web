import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { usePostStore } from '@/stores/postStore';
import { useEventsStore } from '@/stores/eventsStore';
import { haptic } from '@/lib/haptics';
import { avatarColor } from '@/lib/utils';
import { createLocalMediaPreview, revokeLocalMediaPreview, type LocalMediaPreview } from '@/lib/mediaPreview';

const MAX_MEDIA = 10;
const MAX_CAPTION = 2200;

export default function CreatePost() {
  const { user } = useAuthStore();
  const { createPost } = usePostStore();
  const { events, loadEvents } = useEventsStore();
  const nav = useNavigate();

  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<LocalMediaPreview[]>([]);
  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [eventId, setEventId] = useState<string | null>(null);
  const [eventPickerOpen, setEventPickerOpen] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const previewsRef = useRef<LocalMediaPreview[]>([]);

  useEffect(() => { if (user) loadEvents(user.id).catch(() => {}); }, [user?.id, loadEvents]);
  useEffect(() => { previewsRef.current = previews; }, [previews]);
  useEffect(() => () => { previewsRef.current.forEach(revokeLocalMediaPreview); }, []);

  const eventList = useMemo(
    () => Object.values(events).sort((a, b) => (b.start_at || '').localeCompare(a.start_at || '')),
    [events],
  );
  const selectedEvent = eventId ? events[eventId] : null;

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    if (!picked.length) return;
    const remaining = Math.max(0, MAX_MEDIA - files.length);
    const accepted = picked.slice(0, remaining);
    if (picked.length > remaining) toast.error(`Можно добавить не больше ${MAX_MEDIA} файлов`);

    const built = await Promise.all(accepted.map(createLocalMediaPreview));
    setFiles(prev => [...prev, ...accepted]);
    setPreviews(prev => [...prev, ...built]);
  };

  const removeAt = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) revokeLocalMediaPreview(removed);
      return next;
    });
  };

  const submit = async () => {
    if (!user) return;
    if (!files.length) { toast.error('Добавьте хотя бы одно фото или видео'); return; }
    setSubmitting(true);
    const { id, error } = await createPost(user.id, caption.trim(), files, eventId);
    setSubmitting(false);
    if (error || !id) { toast.error(error || 'Не удалось опубликовать пост'); return; }
    toast.success('Пост опубликован');
    nav(`/p/${id}`, { replace: true });
  };

  return (
    <div className="cp-screen cp-v334">
      <header className="cp-header safe-top-sm">
        <button className="cp-round-button" onClick={() => nav(-1)} disabled={submitting} aria-label="Закрыть">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div className="cp-title-wrap">
          <div><b>Новый пост</b></div>
        </div>
        <button className="cp-publish" onClick={submit} disabled={submitting || !files.length} aria-label="Опубликовать">
          {submitting ? <span className="spinner cp-spinner" /> : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 16V4"/><path d="m7.5 8.5 4.5-4.5 4.5 4.5"/><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>
            </svg>
          )}
        </button>
      </header>

      <main className="cp-scroll page-scroll">
        <section className="cp-author-card">
          {user?.avatar_url
            ? <img src={user.avatar_url} alt="" />
            : <span style={{ background: avatarColor(user?.id || 'sigmas') }}>{(user?.display_name || 'S')[0]}</span>}
          <div><b>{user?.display_name || 'Пользователь'}</b><small>Публикация будет видна в Sigmas</small></div>
        </section>

        <section className="cp-media-card">
          <div className="cp-section-heading">
            <div><b>Фото и видео</b><small>{previews.length}/{MAX_MEDIA}</small></div>
          </div>

          {previews.length === 0 ? (
            <div className="cp-media-empty">
              <span>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="4"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 5-5 4 4 2-2 5 5"/></svg>
              </span>
              <b>Добавить медиа</b>
              <small>До десяти фото или видео в одном посте</small>
              <div className="cp-media-empty-actions">
                <button type="button" onClick={() => { haptic.tap(); photoInputRef.current?.click(); }}>Выбрать фото</button>
                <button type="button" onClick={() => { haptic.tap(); videoInputRef.current?.click(); }}>Выбрать видео</button>
              </div>
            </div>
          ) : (
            <>
              <div className="cp-preview-strip">
                {previews.map((preview, index) => {
                  return (
                    <div key={preview.sourceUrl} className="cp-thumb">
                      {preview.isVideo ? (
                        <>
                          {preview.previewUrl !== preview.sourceUrl
                            ? <img src={preview.previewUrl} alt="Превью видео" />
                            : <video src={preview.sourceUrl} muted playsInline preload="auto" />}
                          <span className="cp-video-badge" aria-hidden="true">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M9 7.5v9l7-4.5-7-4.5Z"/></svg>
                          </span>
                        </>
                      ) : <img src={preview.previewUrl} alt="" />}
                      <span className="cp-media-number">{index + 1}</span>
                      <button onClick={() => { haptic.tap(); removeAt(index); }} aria-label="Удалить медиа">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  );
                })}
              </div>
              {previews.length < MAX_MEDIA && (
                <div className="cp-add-more-media-row">
                  <button className="cp-add-more-media" onClick={() => { haptic.tap(); photoInputRef.current?.click(); }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                    Фото
                  </button>
                  <button className="cp-add-more-media" onClick={() => { haptic.tap(); videoInputRef.current?.click(); }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 10l4.5-2.5v9L15 14M5 6h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"/></svg>
                    Видео
                  </button>
                </div>
              )}
            </>
          )}
          <input ref={photoInputRef} type="file" accept="image/*" multiple hidden onChange={handlePick} />
          <input ref={videoInputRef} type="file" accept="video/*,.mov,.mp4,.m4v" multiple hidden onChange={handlePick} />
        </section>

        <section className="cp-copy-card">
          <div className="cp-section-heading"><div><b>Подпись</b><small>{caption.length}/{MAX_CAPTION}</small></div></div>
          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value.slice(0, MAX_CAPTION))}
            placeholder="Расскажите, что происходит..."
            disabled={submitting}
            className="cp-caption"
          />
        </section>

        <section className="cp-event-card">
          <div className="cp-section-heading"><div><b>Связь с событием</b><small>Необязательно</small></div></div>
          {selectedEvent ? (
            <div className="cp-event-selected">
              <span className="cp-event-cover">
                {selectedEvent.cover_url
                  ? <img src={selectedEvent.cover_url} alt="" />
                  : <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>}
              </span>
              <div><b>{selectedEvent.title}</b><small>{selectedEvent.location_name || (selectedEvent.type === 'trip' ? 'Поездка' : 'Событие')}</small></div>
              <button onClick={() => setEventId(null)}>Открепить</button>
            </div>
          ) : (
            <button className="cp-event-add" onClick={() => { haptic.tap(); setEventPickerOpen(true); }}>
              <span><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg></span>
              <div><b>Привязать к событию</b><small>Пост появится в фильтре выбранного события</small></div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          )}
        </section>
      </main>

      {eventPickerOpen && (
        <div className="cp-picker-overlay" onClick={() => setEventPickerOpen(false)}>
          <div className="cp-picker-sheet" onClick={e => e.stopPropagation()}>
            <div className="cp-picker-grip" />
            <div className="cp-picker-title">Выберите событие</div>
            <div className="cp-picker-list">
              {eventList.length === 0 && <div className="cp-picker-empty">Событий пока нет</div>}
              {eventList.map(ev => (
                <button key={ev.id} onClick={() => { haptic.select(); setEventId(ev.id); setEventPickerOpen(false); }}>
                  <span className="cp-event-cover">
                    {ev.cover_url
                      ? <img src={ev.cover_url} alt="" />
                      : <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>}
                  </span>
                  <div><b>{ev.title}</b><small>{ev.location_name || (ev.type === 'trip' ? 'Поездка' : 'Событие')}</small></div>
                  {eventId === ev.id && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><path d="m5 12 4 4L19 6"/></svg>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
