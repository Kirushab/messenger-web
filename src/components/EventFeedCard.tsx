import { useState } from 'react';
import type { EventType, SigEvent, RsvpStatus } from '@/stores/eventsStore';
import { avatarColor } from '@/lib/utils';
import { IconPartyPopper, IconPlane } from '@/components/icons/EventIcons';

// Акцент раздела берётся из текущего оформления приложения.
export const EVENT_ACCENT = 'var(--accent)';

type GoingMember = { user_id: string; user?: { display_name?: string | null; avatar_url?: string | null } | null };

export const TYPE_META: Record<EventType, {
  title: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  createCta: string;
  gradient: string;
}> = {
  party: { title: 'Тусы', label: 'Вечеринка', Icon: IconPartyPopper, createCta: 'Создать тусу', gradient: 'var(--surface-light)' },
  trip:  { title: 'Поездки', label: 'Поездка', Icon: IconPlane, createCta: 'Создать поездку', gradient: 'var(--surface-light)' },
};

export function fmtEventDateTime(e: SigEvent): string {
  const d = new Date(e.start_at);
  const date = d.toLocaleDateString('ru', { day: 'numeric', month: 'long' });
  const time = d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
}

// Бейдж ответа. onLight — тёмная blur-плашка с цветной точкой (поверх обложки).
export function RsvpBadge({ rsvp, onLight }: { rsvp: RsvpStatus; onLight?: boolean }) {
  const cfg = rsvp === 'going' ? { t: 'Иду', dot: '#35C775' }
    : rsvp === 'maybe' ? { t: 'Возможно', dot: '#F5A623' }
    : { t: 'Не иду', dot: '#EF5350' };
  if (onLight) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px 6px 10px', borderRadius: 999, background: 'rgba(10,10,12,0.5)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: cfg.dot }} />
        <span style={{ fontSize: 'var(--fs-micro)', fontWeight: 600, color: '#fff' }}>{cfg.t}</span>
      </span>
    );
  }
  return <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 'var(--fs-micro)', fontWeight: 700, background: cfg.dot + '22', color: cfg.dot }}>{cfg.t}</span>;
}

const chipStyle: React.CSSProperties = {
  padding: '6px 11px', borderRadius: 999, background: 'rgba(10,10,12,0.5)',
  backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
  fontSize: 'var(--fs-caption)', fontWeight: 600, color: '#fff', letterSpacing: 0.2,
};

// Карточка события в ленте — по дизайну: обложка (карусель/градиент) без фона карточки,
// чип категории + ⋯ + ответ поверх, ниже — заголовок, описание, дата · место, аватарки участников.
export default function EventFeedCard({ event, images, onTap, going = [] }: { event: SigEvent; images: string[]; onTap: () => void; going?: GoingMember[] }) {
  const meta = TYPE_META[event.type];
  const [idx, setIdx] = useState(0);
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget; const w = el.clientWidth || 1;
    setIdx(Math.round(el.scrollLeft / w));
  };
  const goCount = event.goingCount || going.length;
  const names = going.map(m => m.user?.display_name?.split(' ')[0]).filter(Boolean) as string[];
  const namesLabel = names.length === 0 ? '' : names.length <= 2 ? names.join(', ')
    : `${names.slice(0, 2).join(', ')} и ещё\u00A0${goCount - 2}`;

  return (
    <article onClick={onTap} style={{ display: 'flex', flexDirection: 'column', gap: 11, cursor: 'pointer' }}>
      <div style={{ position: 'relative', height: 210, borderRadius: 20, overflow: 'hidden', background: meta.gradient }}>
        {images.length > 0 ? (
          <div onScroll={onScroll} style={{ display: 'flex', height: '100%', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}>
            {images.map((u, i) => <img key={i} src={u} alt="" loading="lazy" style={{ minWidth: '100%', width: '100%', height: '100%', objectFit: 'cover', scrollSnapAlign: 'start', display: 'block' }} />)}
          </div>
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><meta.Icon size={54} color="var(--muted)" strokeWidth={1.5} /></div>
        )}
        {images.length > 0 && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'rgba(0,0,0,.18)' }} />}
        <div style={{ position: 'absolute', top: 12, left: 12 }}><span style={chipStyle}>{meta.label}</span></div>
        <button onClick={(e) => { e.stopPropagation(); onTap(); }} style={{ position: 'absolute', top: 12, right: 12, width: 32, height: 32, border: 'none', borderRadius: 999, background: 'rgba(10,10,12,0.5)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="18" height="18" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2" fill="#fff" /><circle cx="12" cy="12" r="2" fill="#fff" /><circle cx="19" cy="12" r="2" fill="#fff" /></svg>
        </button>
        {event.myRsvp && <div style={{ position: 'absolute', left: 12, bottom: 12 }}><RsvpBadge rsvp={event.myRsvp} onLight /></div>}
        {images.length > 1 && (
          <div style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', gap: 5 }}>
            {images.map((_, i) => <span key={i} style={{ width: i === idx ? 16 : 6, height: 6, borderRadius: 6, background: i === idx ? '#fff' : 'rgba(255,255,255,0.5)', transition: 'width .2s' }} />)}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <h3 style={{ margin: 0, fontSize: 'var(--fs-heading)', fontWeight: 700, letterSpacing: '-0.2px', lineHeight: 1.2, color: 'var(--text)' }}>{event.title}</h3>
          {event.description && <p style={{ margin: 0, fontSize: 'var(--fs-label)', lineHeight: 1.35, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{event.description}</p>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 'var(--fs-caption)', color: 'var(--muted)', flexWrap: 'wrap' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" /><path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span>{fmtEventDateTime(event)}</span>
          {event.location_name && <><span style={{ opacity: 0.45 }}>·</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>{event.location_name}</span></>}
        </div>
        {goCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 1 }}>
            <div style={{ display: 'flex' }}>
              {going.slice(0, 3).map((m, i) => (
                <div key={m.user_id} style={{ marginLeft: i ? -9 : 0 }}>
                  {m.user?.avatar_url
                    ? <img src={m.user.avatar_url} alt="" style={{ width: 27, height: 27, borderRadius: 14, objectFit: 'cover', border: '2px solid var(--bg)' }} />
                    : <div style={{ width: 27, height: 27, borderRadius: 14, background: avatarColor(m.user_id), border: '2px solid var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-snap10)', fontWeight: 600, color: '#fff' }}>{(m.user?.display_name || '?')[0].toUpperCase()}</div>}
                </div>
              ))}
              {goCount > 3 && <div style={{ marginLeft: -9, width: 27, height: 27, borderRadius: 14, background: 'var(--surface-2)', border: '2px solid var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: 'var(--text2)' }}>+{goCount - 3}</div>}
            </div>
            {namesLabel && <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)' }}>{namesLabel}</span>}
          </div>
        )}
      </div>
    </article>
  );
}
