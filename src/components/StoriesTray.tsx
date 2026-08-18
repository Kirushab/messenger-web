import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useStoriesStore, StoryGroup } from '@/stores/storiesStore';
import { avatarColor } from '@/lib/utils';
import StoryViewer from './StoryViewer';

// Кольцо с сегментами по числу историй (СД1) + вращение градиента для непросмотренных (СА3)
function RingAvatar({ url, name, id, seen, size = 58, count = 1 }: { url: string | null; name: string; id: string; seen?: boolean; size?: number; count?: number }) {
  const inner = url
    ? <img src={url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
    : <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: avatarColor(id), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: size * 0.38 }}>{name?.[0]?.toUpperCase() || '?'}</div>;

  const ring = size + 8;
  const sw = 2.5;
  const r = (ring - sw) / 2;
  const c = ring / 2;
  const C = 2 * Math.PI * r;
  const n = Math.max(1, count);
  const gap = n > 1 ? 7 : 0;
  const seg = n > 1 ? (C / n) - gap : C;
  const dash = n > 1 ? `${seg} ${gap}` : undefined;
  const gid = 'sr-' + id;

  return (
    <div style={{ width: ring, height: ring, position: 'relative' }}>
      <svg className={'story-ring-svg' + (seen ? '' : ' unseen')} width={ring} height={ring} style={{ position: 'absolute', inset: 0 }}>
        {!seen && (
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="50%" stopColor="#6EE7B7" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>
          </defs>
        )}
        <circle cx={c} cy={c} r={r} fill="none"
          stroke={seen ? 'rgba(127,127,127,0.4)' : `url(#${gid})`}
          strokeWidth={sw} strokeDasharray={dash} strokeLinecap="round"
          transform={`rotate(-90 ${c} ${c})`} />
      </svg>
      <div className="story-ring-inner" style={{ width: size, height: size, position: 'absolute', top: 4, left: 4 }}>{inner}</div>
    </div>
  );
}

export default function StoriesTray() {
  const { user } = useAuthStore();
  const { groups, myGroup, loadStories } = useStoriesStore();
  const nav = useNavigate();
  const [viewer, setViewer] = useState<{ groups: StoryGroup[]; index: number; origin?: { x: number; y: number } } | null>(null);

  useEffect(() => { if (user) loadStories(user.id); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  const allGroups: StoryGroup[] = [...(myGroup ? [myGroup] : []), ...groups];

  const openViewer = (g: StoryGroup, e: React.MouseEvent) => {
    const idx = allGroups.findIndex(x => x.user.id === g.user.id);
    if (idx < 0) return;
    // СА1 — origin для zoom из ячейки
    const el = (e.currentTarget as HTMLElement).querySelector('.story-ring-inner') || (e.currentTarget as HTMLElement);
    const r = (el as HTMLElement).getBoundingClientRect();
    setViewer({ groups: allGroups, index: idx, origin: { x: r.left + r.width / 2, y: r.top + r.height / 2 } });
  };

  const myCount = myGroup ? myGroup.stories.length : 0;

  return (
    <div className="stories-tray">
      {/* Моя история */}
      <div className="story-cell" onClick={(e) => { if (myGroup) openViewer(myGroup, e); else nav('/stories/new'); }}>
        <div style={{ position: 'relative' }} className={myCount > 1 ? 'story-stack' : ''}>
          <RingAvatar url={user.avatar_url} name={user.display_name} id={user.id} seen={myGroup ? myGroup.allSeen : true} count={myCount || 1} />
          <button className="story-add" onClick={(e) => { e.stopPropagation(); nav('/stories/new'); }} aria-label="Добавить историю">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </div>
        <div className="story-name">Моя история</div>
      </div>

      {groups.map(g => (
        <div className="story-cell" key={g.user.id} onClick={(e) => openViewer(g, e)}>
          <RingAvatar url={g.user.avatar_url} name={g.user.display_name} id={g.user.id} seen={g.allSeen} count={g.stories.length} />
          <div className="story-name">{g.user.display_name}</div>
        </div>
      ))}

      {viewer && (
        <StoryViewer
          groups={viewer.groups}
          startIndex={viewer.index}
          origin={viewer.origin}
          onClose={() => { setViewer(null); if (user) loadStories(user.id); }}
        />
      )}
    </div>
  );
}
