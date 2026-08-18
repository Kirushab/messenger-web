import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useStoriesStore } from '@/stores/storiesStore';
import { useEventsStore } from '@/stores/eventsStore';
import { compressImage } from '@/lib/compress';
import { toast } from '@/stores/toastStore';
import { createLocalMediaPreview, revokeLocalMediaPreview } from '@/lib/mediaPreview';

const MAX_CAPTION = 200;
const MAX_ITEMS = 10;

type Item = { file: File; sourceUrl: string; previewUrl: string; isVideo: boolean; width?: number; height?: number };


function StoryTripIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2Z" />
    </svg>
  );
}

function StoryPartyIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20.5c2.9 0 5.25-3.1 5.25-6.9S14.9 6.7 12 6.7 6.75 9.8 6.75 13.6s2.35 6.9 5.25 6.9Z" />
      <path d="M12 20.5c0 1.15-.62 1.7-1.55 2" />
      <path d="M8.2 8.8c.85.75 2.15 1.2 3.8 1.2s2.95-.45 3.8-1.2" />
      <path d="M18.8 3.2v2.6M17.5 4.5h2.6" />
      <path d="M5.1 4.1v2M4.1 5.1h2" />
      <path d="m15.9 2.5.45.9.9.45-.9.45-.45.9-.45-.9-.9-.45.9-.45.45-.9Z" />
    </svg>
  );
}

// Редактор истории: выбор нескольких фото/видео + описание, затем публикация.
// Несколько файлов публикуются как отдельные сегменты одной истории.
export default function StoryEditor() {
  const { user } = useAuthStore();
  const { createStory } = useStoriesStore();
  const { events, loadEvents } = useEventsStore();
  const nav = useNavigate();

  const [items, setItems] = useState<Item[]>([]);
  const [sel, setSel] = useState(0);
  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [eventId, setEventId] = useState<string | null>(null);
  const [eventPickerOpen, setEventPickerOpen] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<Item[]>([]);

  useEffect(() => { if (user) loadEvents(user.id); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => () => { itemsRef.current.forEach(revokeLocalMediaPreview); }, []);

  const eventList = Object.values(events).sort((a, b) => (b.start_at || '').localeCompare(a.start_at || ''));
  const selectedEvent = eventId ? events[eventId] : null;

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    const room = MAX_ITEMS - items.length;
    if (room <= 0) { toast.error(`Максимум ${MAX_ITEMS} файлов`); return; }
    const accepted = files.slice(0, room);
    const previews = await Promise.all(accepted.map(createLocalMediaPreview));
    const added = accepted.map((file, i) => ({ file, ...previews[i] }));
    setItems(prev => [...prev, ...added]);
    if (files.length > room) toast.error(`Добавлено ${room}, максимум ${MAX_ITEMS}`);
  };

  const removeAt = (i: number) => {
    setItems(prev => {
      const it = prev[i];
      if (it) revokeLocalMediaPreview(it);
      const next = prev.filter((_, idx) => idx !== i);
      setSel(s => Math.max(0, Math.min(s, next.length - 1)));
      return next;
    });
  };

  const submit = async () => {
    if (!user) return;
    if (!items.length) { toast.error('Добавьте фото или видео'); return; }
    setSubmitting(true);
    setProgress(0);
    let failed = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const toUpload = it.file.type.startsWith('image/') ? await compressImage(it.file) : it.file;
      // Подпись — только к первому сегменту
      const { error } = await createStory(user.id, toUpload, i === 0 ? caption : '', eventId);
      if (error) failed++;
      setProgress(i + 1);
    }
    setSubmitting(false);
    items.forEach(revokeLocalMediaPreview);
    if (failed === items.length) { toast.error('Не удалось опубликовать'); return; }
    toast.success(items.length > 1 ? `Опубликовано историй: ${items.length - failed}` : 'История опубликована');
    nav('/chats', { replace: true });
  };

  const main = items[sel];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', paddingTop: 'max(12px, env(safe-area-inset-top, 12px))', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 5 }}>
        <button onClick={() => nav(-1)} disabled={submitting} style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: 'var(--fs-snap16)', cursor: 'pointer', padding: 4 }}>Отмена</button>
        <h2 style={{ margin: 0, fontSize: 'var(--fs-heading)', fontWeight: 600 }}>Новая история</h2>
        <button className="se-publish-button" onClick={submit} disabled={submitting || !items.length} aria-label="Опубликовать историю">
          {submitting ? <span className="se-publish-progress">{progress}/{items.length}</span> : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 16V4"/><path d="m7.5 8.5 4.5-4.5 4.5 4.5"/><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>
            </svg>
          )}
        </button>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!main ? (
          <div className="se-empty-media-card">
            <div className="se-empty-media-icon" aria-hidden="true">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3.5" width="18" height="17" rx="4"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4.5 17 4.5-4.5 3.5 3.5 2.2-2.2 4.8 4.8"/>
              </svg>
            </div>
            <div className="se-empty-media-title">Добавьте историю</div>
            <div className="se-empty-media-subtitle">Фото и видео можно смешивать · до {MAX_ITEMS} файлов</div>
            <div className="se-media-picker-bar">
              <button type="button" onClick={() => photoInputRef.current?.click()} aria-label="Добавить фото">
                <span className="se-media-picker-icon"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="4"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 5-5 4 4 2-2 5 5"/></svg></span>
                <span><b>Фото</b><small>из галереи</small></span>
              </button>
              <span className="se-media-picker-divider" aria-hidden="true" />
              <button type="button" onClick={() => videoInputRef.current?.click()} aria-label="Добавить видео">
                <span className="se-media-picker-icon"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="12" height="12" rx="3"/><path d="M15 10l5-3v10l-5-3"/></svg></span>
                <span><b>Видео</b><small>из галереи</small></span>
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ position: 'relative', width: '100%', maxHeight: '52vh', borderRadius: 16, overflow: 'hidden', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {main.isVideo
                ? <video key={main.sourceUrl} src={main.sourceUrl} poster={main.previewUrl !== main.sourceUrl ? main.previewUrl : undefined} muted playsInline autoPlay loop preload="auto" style={{ width: '100%', maxHeight: '52vh', objectFit: 'contain', display: 'block' }} />
                : <img src={main.previewUrl} alt="" style={{ width: '100%', maxHeight: '52vh', objectFit: 'contain', display: 'block' }} />}
              {items.length > 1 && (
                <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 'var(--fs-caption)', fontWeight: 600, padding: '3px 9px', borderRadius: 20 }}>{sel + 1} / {items.length}</div>
              )}
              <button onClick={() => removeAt(sel)} style={{ position: 'absolute', top: 10, right: 10, padding: '6px 12px', borderRadius: 20, border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 'var(--fs-label)', cursor: 'pointer' }}>Удалить</button>
            </div>

            {/* Полоса миниатюр */}
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
              {items.map((it, i) => (
                <div key={it.sourceUrl} onClick={() => setSel(i)} style={{ position: 'relative', flexShrink: 0, width: 56, height: 56, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', border: i === sel ? '2px solid var(--accent)' : '2px solid transparent', background: '#000' }}>
                  <img src={it.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  {it.isVideo && <span className="se-video-thumb-badge" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M9 7.5v9l7-4.5-7-4.5Z"/></svg></span>}
                  <button onClick={(e) => { e.stopPropagation(); removeAt(i); }} style={{ position: 'absolute', top: 1, right: 1, width: 18, height: 18, borderRadius: 9, border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
                </div>
              ))}

            </div>
            {items.length < MAX_ITEMS && (
              <div className="se-media-picker-bar se-media-picker-bar-compact">
                <button onClick={() => photoInputRef.current?.click()} aria-label="Добавить фото">
                  <span className="se-media-picker-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="4"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 5-5 4 4 2-2 5 5"/></svg></span>
                  <span><b>Фото</b></span>
                </button>
                <span className="se-media-picker-divider" aria-hidden="true" />
                <button onClick={() => videoInputRef.current?.click()} aria-label="Добавить видео">
                  <span className="se-media-picker-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="12" height="12" rx="3"/><path d="M15 10l5-3v10l-5-3"/></svg></span>
                  <span><b>Видео</b></span>
                </button>
              </div>
            )}
          </>
        )}

        <div>
          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value.slice(0, MAX_CAPTION))}
            placeholder={items.length > 1 ? 'Подпись к первому фото…' : 'Добавьте описание…'}
            rows={3}
            style={{ width: '100%', resize: 'none', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', background: 'var(--surface)', color: 'var(--text)', fontSize: 'var(--fs-body)', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
          <div style={{ textAlign: 'right', fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 4 }}>{caption.length}/{MAX_CAPTION}</div>
        </div>

        {/* Привязка к событию (туса/поездка) */}
        {selectedEvent ? (
          <div className="se-event-row">
            <span style={{ color: 'var(--primary)', display: 'flex', flexShrink: 0 }}>
              {selectedEvent.type === 'trip' ? <StoryTripIcon /> : <StoryPartyIcon />}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedEvent.title}</div>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)' }}>{selectedEvent.type === 'trip' ? 'Поездка' : 'Тусовка'}</div>
            </div>
            <button onClick={() => setEventId(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 'var(--fs-label)', cursor: 'pointer', padding: 4 }}>Открепить</button>
          </div>
        ) : (
          <button onClick={() => setEventPickerOpen(true)} className="se-event-add">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            Привязать к событию
          </button>
        )}
      </div>

      <input ref={photoInputRef} type="file" accept="image/*" multiple hidden onChange={pick} />
      <input ref={videoInputRef} type="file" accept="video/*,.mov,.mp4,.m4v" multiple hidden onChange={pick} />

      {eventPickerOpen && (
        <div className="se-picker-sheet" onClick={() => setEventPickerOpen(false)}>
          <div className="se-picker-card" onClick={e => e.stopPropagation()}>
            <div className="sv-viewers-grip" />
            <div className="sv-viewers-title">Привязать к событию</div>
            <div style={{ overflowY: 'auto' }}>
              {eventList.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--fs-body)' }}>Событий пока нет</div>}
              {eventList.map(ev => (
                <button key={ev.id} className="se-picker-row" onClick={() => { setEventId(ev.id); setEventPickerOpen(false); }}>
                  <div className="se-picker-ic">
                    {ev.type === 'trip' ? <StoryTripIcon /> : <StoryPartyIcon />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</div>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.type === 'trip' ? 'Поездка' : 'Тусовка'}{ev.location_name ? ' · ' + ev.location_name : ''}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
