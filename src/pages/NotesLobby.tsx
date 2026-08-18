import { useEffect, useState, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotesStore } from '@/stores/notesStore';
import PullToRefresh from '@/components/PullToRefresh';
import { Skeleton } from '@/components/Skeleton';
import { useAuthStore } from '@/stores/authStore';
import { haptic } from '@/lib/haptics';
import MiniBars from '@/components/MiniBars';
import ErrorRetry from '@/components/ErrorRetry';
import { GlyphIcon } from '@/components/icons/AppGlyph';
import { hasFlag } from '@/lib/featureFlags';

export default function NotesLobby() {
  const nav = useNavigate();
  const { progress, leaderboard, history, loadProgress, loadLeaderboard, loadHistory, loadError } = useNotesStore();
  const [tab, setTab] = useState<'play' | 'stats' | 'top'>('play');
  const { session, user } = useAuthStore();
  const myId = session?.user?.id;
  const canOpen = hasFlag(user, 'notes');

  useEffect(() => {
    if (!canOpen) { nav('/languages'); return; }
    loadProgress();
    loadLeaderboard();
    loadHistory();
  }, [canOpen, nav]);

  const accuracy = progress && progress.total_attempts > 0
    ? Math.round((progress.total_correct / progress.total_attempts) * 100)
    : 0;
  const notesChart = useMemo(() => {
    const last = history.slice(0, 12).slice().reverse();
    return last.map((s, i) => ({ label: (i % 2 === 0 || i === last.length - 1) ? String(new Date(s.created_at).getDate()) : '', value: s.correct_count }));
  }, [history]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 12px', borderBottom: '1px solid var(--border)',
      }}>
        <button onClick={() => nav('/languages')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 'var(--fs-title)', padding: 0 }}>‹</button>
        <h2 style={{ margin: 0, fontSize: 'var(--fs-heading)', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}><GlyphIcon name="music" size={19} />Ноты</h2>
        <button onClick={() => { haptic.tap(); nav('/learn/settings'); }} aria-label="Настройки" style={{ marginLeft: 'auto', background: 'var(--surface-light)', border: 'none', width: 34, height: 34, borderRadius: 17, cursor: 'pointer', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {([
          { id: 'play' as const, label: 'Играть' },
          { id: 'stats' as const, label: 'Прогресс' },
          { id: 'top' as const, label: 'Топ-10' },
        ]).map(t => (
          <button key={t.id} onClick={() => { haptic.tap(); setTab(t.id); }} style={{
            flex: 1, padding: '12px 8px', background: 'none', border: 'none',
            color: tab === t.id ? 'var(--accent)' : 'var(--muted)',
            borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            fontSize: 'var(--fs-snap14)', fontWeight: 600, cursor: 'pointer',
          }}>{t.label}</button>
        ))}
      </div>

      <PullToRefresh className="page-scroll" style={{ padding: 16 }} onRefresh={async () => {
        await Promise.all([loadProgress(), loadLeaderboard(), loadHistory()]);
      }}>
        {loadError && (
          <ErrorRetry onRetry={() => { loadProgress(); loadLeaderboard(); loadHistory(); }} text="Не удалось загрузить данные" />
        )}
        {tab === 'play' && (
          <>
            {!progress && (
              <div style={{
                padding: 14, background: 'var(--surface-light)', borderRadius: 12, marginBottom: 16,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div style={{ flex: 1 }}>
                  <Skeleton width="60%" height={12} />
                  <div style={{ marginTop: 6 }}><Skeleton width="40%" height={22} /></div>
                </div>
                <div style={{ width: 60 }}>
                  <Skeleton width="100%" height={12} />
                  <div style={{ marginTop: 6 }}><Skeleton width="100%" height={20} /></div>
                </div>
              </div>
            )}
            {progress && (
              <div style={{
                padding: 14, background: 'var(--surface-light)', borderRadius: 12, marginBottom: 16,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)' }}>Лучшая серия</div>
                  <div style={{ fontSize: 'var(--fs-title)', fontWeight: 700, color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="edu-flame" style={{ display: 'inline-flex' }}><GlyphIcon name="flame" size={22} /></span> {progress.best_streak}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)' }}>Точность</div>
                  <div style={{ fontSize: 'var(--fs-title)', fontWeight: 700, color: 'var(--text)' }}>{accuracy}%</div>
                </div>
              </div>
            )}

            <div style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', marginBottom: 10 }}>Выбери уровень</div>

            <LevelCard
              icon={<TrebleClefIcon size={32} />}
              title="Скрипичный ключ"
              desc="9 нот в скрипичном ключе"
              best={progress?.best_treble_score ?? 0}
              total={10}
              delay={0}
              onClick={() => { haptic.tap(); nav('/notes/play/treble'); }}
            />
            <LevelCard
              icon={<BassClefIcon size={32} />}
              title="Басовый ключ"
              desc="9 нот в басовом ключе"
              best={progress?.best_bass_score ?? 0}
              total={10}
              delay={70}
              onClick={() => { haptic.tap(); nav('/notes/play/bass'); }}
            />
            <LevelCard
              icon={<BothClefsIcon size={36} />}
              title="Оба ключа (бонус +3)"
              desc="18 нот в скрипичном и басовом"
              best={progress?.best_both_score ?? 0}
              total={10}
              delay={140}
              onClick={() => { haptic.tap(); nav('/notes/play/both'); }}
            />
            <LevelCard
              icon={<GlyphIcon name="music" size={32} />}
              title="С альтерациями (+5)"
              desc="Диезы и бемоли в обоих ключах"
              best={progress?.best_advanced_score ?? 0}
              total={10}
              delay={210}
              onClick={() => { haptic.tap(); nav('/notes/play/advanced'); }}
            />
          </>
        )}

        {tab === 'stats' && (
          <>
            {progress && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <Stat label="Всего сессий" value={progress.sessions_played} delay={0} />
                <Stat label="Лучшая серия" value={progress.best_streak} delay={60} />
                <Stat label="Всего верно" value={progress.total_correct} delay={120} />
                <Stat label="Точность" value={
                  <span>{progress.total_attempts > 0 ? Math.round((progress.total_correct / progress.total_attempts) * 100) : 0}%</span>
                } delay={180} />
              </div>
            )}

            {history.length > 0 && (
              <div style={{ background: 'var(--surface-light)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 'var(--fs-label)', fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Очки за сессию</div>
                <MiniBars data={notesChart} height={100} />
              </div>
            )}

            <div style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', marginBottom: 8 }}>История сессий</div>
            {history.length === 0 && (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Пока пусто</div>
            )}
            {history.map((s, i) => (
              <div key={s.id} className="edu-row" style={{
                padding: 12, background: 'var(--surface-light)', borderRadius: 10, marginBottom: 8,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                animationDelay: Math.min(i, 12) * 40 + 'ms',
              }}>
                <div>
                  <div style={{ fontSize: 'var(--fs-snap14)', color: 'var(--text)', fontWeight: 600 }}>
                    {s.level === 'treble' ? 'Скрипичный' :
                     s.level === 'bass' ? 'Басовый' :
                     s.level === 'both' ? 'Оба' :
                     'С альтерациями'}
                  </div>
                  <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)' }}>
                    {new Date(s.created_at).toLocaleString('ru')}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 'var(--fs-snap16)', fontWeight: 700, color: 'var(--text)' }}>
                    {s.correct_count}/{s.total_questions}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'top' && (
          <>
            <div style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', marginBottom: 8 }}>Лучшие игроки</div>
            {leaderboard.length === 0 && (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Пока никто не играл</div>
            )}
            {leaderboard.map((e, i) => (
              <div key={e.user_id} className="edu-row" style={{
                padding: 12, background: e.user_id === myId ? 'rgba(16,185,129,0.12)' : 'var(--surface-light)', borderRadius: 10, marginBottom: 8,
                display: 'flex', alignItems: 'center', gap: 10,
                border: e.user_id === myId ? '1px solid var(--accent)' : '1px solid transparent',
                animationDelay: Math.min(i, 12) * 40 + 'ms',
              }}>
                <div style={{ width: 28, textAlign: 'center', color: i < 3 ? 'var(--accent)' : 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-label)', fontWeight: 800 }}>
                  {i < 3 ? <GlyphIcon name="trophy" size={22} /> : `#${i + 1}`}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--fs-snap14)', color: 'var(--text)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {e.display_name}
                  </div>
                  <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)' }}>{e.sessions_played} сессий</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 'var(--fs-snap14)', fontWeight: 700, color: 'var(--accent)' }}>
                    {e.best_advanced_score > 0 ? `${e.best_advanced_score}/10` : `${e.best_both_score}/10`}
                  </div>
                  <div style={{ fontSize: 'var(--fs-snap10)', color: 'var(--muted)' }}>
                    {e.best_advanced_score > 0 ? 'альтерации' : 'оба ключа'}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </PullToRefresh>
    </div>
  );
}

function LevelCard({ icon, title, desc, best, total, onClick, delay = 0 }: {
  icon: ReactNode; title: string; desc: string; best: number; total: number; onClick: () => void; delay?: number;
}) {
  return (
    <div onClick={onClick} className="edu-card" style={{
      padding: 14,
      background: 'var(--surface-light)',
      borderRadius: 12, marginBottom: 10,
      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
      border: '1px solid var(--border)',
      animationDelay: delay + 'ms',
    }}>
      <div style={{
        fontSize: 32,
        width: 44, minWidth: 44, height: 44,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text)',
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text)' }}>{title}</div>
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)' }}>{desc}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)' }}>лучший</div>
        <div style={{ fontSize: 'var(--fs-snap16)', fontWeight: 700, color: best > 0 ? 'var(--accent)' : 'var(--muted)' }}>
          {best}/{total}
        </div>
      </div>
    </div>
  );
}

// Скрипичный ключ (G-clef) — Unicode 𝄞 через Apple Symbols / Bravura,
// тот же глиф что в самих упражнениях, чтобы меню и упражнение выглядели одинаково.
function TrebleClefIcon({ size = 32 }: { size?: number }) {
  return (
    <span
      style={{
        fontFamily: "'Bravura', 'Petaluma', 'Apple Symbols', 'Segoe UI Symbol', 'Times New Roman', serif",
        fontSize: size * 1.3,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        color: 'var(--text)',
      }}
      aria-hidden="true"
    >𝄞</span>
  );
}

// Басовый ключ (F-clef) — Unicode 𝄢 с двумя точками
function BassClefIcon({ size = 32 }: { size?: number }) {
  return (
    <span
      style={{
        fontFamily: "'Bravura', 'Petaluma', 'Apple Symbols', 'Segoe UI Symbol', 'Times New Roman', serif",
        fontSize: size * 1.1,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        color: 'var(--text)',
      }}
      aria-hidden="true"
    >𝄢</span>
  );
}

// Оба ключа — стопкой через flex
function BothClefsIcon({ size = 36 }: { size?: number }) {
  return (
    <span
      style={{
        fontFamily: "'Bravura', 'Petaluma', 'Apple Symbols', 'Segoe UI Symbol', 'Times New Roman', serif",
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        width: size,
        height: size,
        color: 'var(--text)',
        letterSpacing: -2,
      }}
      aria-hidden="true"
    >
      <span style={{ fontSize: size * 1.0 }}>𝄞</span>
      <span style={{ fontSize: size * 0.85 }}>𝄢</span>
    </span>
  );
}

function Stat({ label, value, delay = 0 }: { label: string; value: any; delay?: number }) {
  return (
    <div className="edu-card" style={{ padding: 12, background: 'var(--surface-light)', borderRadius: 10, animationDelay: delay + 'ms' }}>
      <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 700, color: 'var(--text)' }}>{value}</div>
    </div>
  );
}
