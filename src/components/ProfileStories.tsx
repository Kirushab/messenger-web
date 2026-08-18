import { useEffect, useState } from 'react';
import { useStoriesStore, Story, StoryGroup } from '@/stores/storiesStore';
import StoryViewer from './StoryViewer';
import type { User } from '@/types';

// Раздел историй в профиле. Владелец видит весь архив, остальные — закреплённые «в профиле».
export default function ProfileStories({ profile, isOwner }: { profile: User; isOwner: boolean }) {
  const { loadProfileStories } = useStoriesStore();
  const [stories, setStories] = useState<Story[]>([]);
  const [openAt, setOpenAt] = useState<number | null>(null);

  useEffect(() => {
    loadProfileStories(profile.id, isOwner).then(setStories);
  }, [profile.id, isOwner]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!stories.length) return null;

  const group: StoryGroup = { user: profile, stories, allSeen: false };

  return (
    <div className="profile-stories">
      <div className="profile-stories-title">{isOwner ? 'Мои истории' : 'Истории'}</div>
      <div className="profile-stories-row">
        {stories.map((s, i) => (
          <div key={s.id} className="ps-thumb" onClick={() => setOpenAt(i)}>
            {s.media_type === 'video'
              ? <video src={s.media_url} muted playsInline preload="metadata" />
              : <img src={s.media_url} alt="" />}
            {s.media_type === 'video' && (
              <span className="ps-play"><svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><polygon points="6,4 20,12 6,20"/></svg></span>
            )}
          </div>
        ))}
      </div>
      {openAt !== null && (
        <StoryViewer groups={[group]} startIndex={0} startStory={openAt} onClose={() => setOpenAt(null)} />
      )}
    </div>
  );
}
