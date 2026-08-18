import { GlyphIcon } from '@/components/icons/AppGlyph';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguagesStore } from '@/stores/languagesStore';
import { SkeletonCourseCard } from '@/components/Skeleton';
import { supabase } from '@/lib/supabase';
import ErrorRetry from '@/components/ErrorRetry';

export default function LanguagesLeaderboard() {
  const nav = useNavigate();
  const { leaderboard, loadLeaderboard, leaderboardError } = useLanguagesStore();
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const retry = async () => { setLoading(true); await loadLeaderboard(); setLoading(false); };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setMyId(data.user?.id ?? null);
      await loadLeaderboard();
      setLoading(false);
    })();
    /* eslint-disable-next-line */
  }, []);

  // Награды за топ-3 места — SVG-медали (диск + лента)
  const medalFor = (rank: number) => {
    const c: Record<number, string> = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };
    if (!c[rank]) return null;
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c[rank]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="6" />
        <path d="M8.21 13.89 7 23l5-3 5 3-1.21-9.12" />
      </svg>
    );
  };

  const statusFor = (themes: number) => {
    if (themes >= 20) return { label: 'Мастер', icon: 'trophy' as const };
    if (themes >= 10) return { label: 'Продвинутый', icon: 'star' as const };
    if (themes >= 4) return { label: 'Ученик', icon: 'book' as const };
    return { label: 'Новичок', icon: 'seedling' as const };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header className="safe-top" style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)',
      }}>
        <button onClick={() => nav(-1)} style={{
          width: 36, height: 36, borderRadius: 18, border: 'none',
          background: 'var(--surface-light)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4z"/><path d="M5 5H3v2a3 3 0 0 0 3 3M19 5h2v2a3 3 0 0 1-3 3"/></svg>Лидерборд</div>
      </header>

      <div className="page-scroll" style={{ padding: '16px 16px 40px' }}>
        {loading ? (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}><SkeletonCourseCard /><SkeletonCourseCard /><SkeletonCourseCard /><SkeletonCourseCard /><SkeletonCourseCard /></div>
        ) : leaderboardError && leaderboard.length === 0 ? (
          <ErrorRetry onRetry={retry} text="Не удалось загрузить лидерборд" />
        ) : leaderboard.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)', fontSize: 'var(--fs-label)' }}>
            Пока никто не прошёл ни одной темы.<br/>Стань первым!
          </div>
        ) : (
          <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', textAlign: 'center', margin: '0 0 8px' }}>
              Топ-{leaderboard.length} по пройденным темам · обновляется после каждой сессии
            </p>
            {leaderboard.map((entry, i) => {
              const rank = i + 1;
              const isMe = entry.user_id === myId;
              const medal = medalFor(rank);
              const status = statusFor(entry.themes_completed);
              return (
                <div
                  key={entry.user_id}
                  className="edu-row"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px',
                    background: isMe ? 'rgba(59,130,246,0.12)' : 'var(--surface-light)',
                    border: isMe ? '1px solid rgba(59,130,246,0.35)' : '1px solid transparent',
                    borderRadius: 14,
                    animationDelay: Math.min(i, 14) * 40 + 'ms',
                  }}
                >
                  {/* Ранг или медаль */}
                  <div style={{
                    width: 32, fontSize: medal ? 22 : 14, fontWeight: 700,
                    color: 'var(--muted)', textAlign: 'center', flexShrink: 0,
                  }}>
                    {medal || `#${rank}`}
                  </div>

                  {/* Аватар */}
                  {entry.avatar_url ? (
                    <img
                      src={entry.avatar_url}
                      alt=""
                      style={{ width: 40, height: 40, borderRadius: 20, objectFit: 'cover', flexShrink: 0, background: 'var(--surface)' }}
                    />
                  ) : (
                    <div style={{
                      width: 40, height: 40, borderRadius: 20,
                      background: 'var(--surface)', color: 'var(--text)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 'var(--fs-snap16)', fontWeight: 600, flexShrink: 0,
                    }}>
                      {entry.display_name.slice(0, 1).toUpperCase()}
                    </div>
                  )}

                  {/* Имя + статы */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--fs-snap14)', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {entry.display_name}
                      {isMe && <span style={{ fontSize: 'var(--fs-snap10)', color: '#3B82F6', marginLeft: 6, fontWeight: 700 }}>ТЫ</span>}
                    </div>
                    <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', marginTop: 4, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="language-rank-status"><GlyphIcon name={status.icon} size={12} /> {status.label}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><GlyphIcon name="book" size={12} /> {entry.themes_completed} {entry.themes_completed === 1 ? 'тема' : entry.themes_completed < 5 ? 'темы' : 'тем'}</span>
                      {entry.current_streak > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><GlyphIcon name="flame" size={12} /> {entry.current_streak}</span>}
                      <span style={{ color: '#F59E0B', fontWeight: 600 }}>● {entry.total_coins}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p style={{
          textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--fs-micro)',
          marginTop: 24, padding: '0 24px', lineHeight: 1.5,
        }}>
          Сортировка: пройденные темы → монетки → стрик.<br/>
          Чтобы попасть в топ — проходи темы с точностью ≥80%.
        </p>
      </div>
    </div>
  );
}
