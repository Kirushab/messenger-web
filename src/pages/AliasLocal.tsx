// Локальная игра Alias — без БД, всё в state. Передаётся один телефон между командами.
// State-machine: setup → team-intro → playing → round-result → (next team или winner)
import { GlyphIcon, normalizeGlyph } from '@/components/icons/AppGlyph';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { goBack } from '@/lib/nav';
import { useNavigate } from 'react-router-dom';
import { WORD_CATEGORIES, pickRandomWord } from '@/lib/alias-words';
import { useAuthStore } from '@/stores/authStore';
import { useAliasCategoriesStore } from '@/stores/aliasCategoriesStore';
import { haptic } from '@/lib/haptics';
import { triggerConfetti } from '@/lib/confetti';

type Phase = 'setup' | 'team-intro' | 'playing' | 'round-result' | 'winner';

interface Team {
  name: string;
  color: string;
  score: number;
}

interface RoundResult {
  word: string;
  guessed: boolean;
}

// Цвета команд — 4 контрастных
const TEAM_COLORS = [
  { name: 'Красные', color: '#EF4444' },
  { name: 'Синие',   color: '#3B82F6' },
  { name: 'Зелёные', color: '#10B981' },
  { name: 'Жёлтые',  color: '#F59E0B' },
];

const STORAGE_KEY = 'alias-local-v1';

// A6 — карточка слова со свайпом: вправо = угадали, влево = пропуск
function SwipeWord({ word, teamColor, onGuess, onSkip }: { word: string; teamColor: string; onGuess: () => void; onSkip: () => void }) {
  const [dx, setDx] = useState(0);
  const [flying, setFlying] = useState<null | 'left' | 'right'>(null);
  const dragging = useRef(false);
  const startX = useRef(0);

  useEffect(() => { setDx(0); setFlying(null); dragging.current = false; }, [word]);

  const THRESH = 90;
  const down = (e: React.PointerEvent) => {
    if (flying) return;
    dragging.current = true; startX.current = e.clientX;
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* noop */ }
  };
  const move = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    setDx(e.clientX - startX.current);
  };
  const up = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (dx > THRESH) { setFlying('right'); haptic.success(); window.setTimeout(onGuess, 220); }
    else if (dx < -THRESH) { setFlying('left'); haptic.tap(); window.setTimeout(onSkip, 220); }
    else { setDx(0); }
  };

  const rot = Math.max(-12, Math.min(12, dx / 12));
  const tx = flying === 'right' ? 700 : flying === 'left' ? -700 : dx;
  const trot = flying === 'right' ? 22 : flying === 'left' ? -22 : rot;
  const gHint = Math.max(0, Math.min(1, dx / THRESH));
  const sHint = Math.max(0, Math.min(1, -dx / THRESH));

  return (
    <div
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 16px', position: 'relative', touchAction: 'none', userSelect: 'none' }}
    >
      <div style={{ position: 'absolute', top: 20, right: 20, padding: '6px 14px', borderRadius: 12, background: '#fff', color: teamColor, fontWeight: 800, fontSize: 'var(--fs-snap14)', opacity: gHint, transform: `rotate(-12deg) scale(${0.8 + gHint * 0.3})`, pointerEvents: 'none' }}>✓ УГАДАЛИ</div>
      <div style={{ position: 'absolute', top: 20, left: 20, padding: '6px 14px', borderRadius: 12, background: 'rgba(0,0,0,0.4)', color: '#fff', fontWeight: 800, fontSize: 'var(--fs-snap14)', opacity: sHint, transform: `rotate(12deg) scale(${0.8 + sHint * 0.3})`, pointerEvents: 'none' }}>✗ ПРОПУСК</div>
      <div
        key={word}
        className="alias-word-in"
        style={{
          transform: `translateX(${tx}px) rotate(${trot}deg)`,
          transition: dragging.current ? 'none' : 'transform .25s var(--ease-out, ease), opacity .25s',
          opacity: flying ? 0 : 1,
          willChange: 'transform',
          fontSize: 'clamp(36px, 10vw, 64px)', fontWeight: 800, textAlign: 'center', lineHeight: 1.15, letterSpacing: '-0.5px',
        }}
      >
        {word}
      </div>
    </div>
  );
}

export default function AliasLocal() {
  const nav = useNavigate();
  const { session } = useAuthStore();
  const myId = session?.user?.id;
  const customCats = useAliasCategoriesStore(s => s.mine);
  const loadMyCats = useAliasCategoriesStore(s => s.loadMine);
  const allCategories = useMemo(() => [...WORD_CATEGORIES, ...customCats], [customCats]);
  useEffect(() => { if (myId) loadMyCats(myId); }, [myId, loadMyCats]);
  const [phase, setPhase] = useState<Phase>('setup');

  // Setup
  const [numTeams, setNumTeams] = useState(2);
  const [targetPoints, setTargetPoints] = useState(30);
  const [roundDuration, setRoundDuration] = useState(60);
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set(['basic']));

  // Game state
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentTeam, setCurrentTeam] = useState(0);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());

  // Round
  const [currentWord, setCurrentWord] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [roundResults, setRoundResults] = useState<RoundResult[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Восстановление из localStorage при загрузке
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.phase && parsed.phase !== 'setup' && parsed.phase !== 'winner') {
          // В разгаре игры — восстанавливаем, но в team-intro чтобы не запутать
          setPhase('team-intro');
          setNumTeams(parsed.numTeams);
          setTargetPoints(parsed.targetPoints);
          setRoundDuration(parsed.roundDuration);
          setSelectedCats(new Set(parsed.selectedCats?.length ? parsed.selectedCats : ['basic']));
          setTeams(parsed.teams);
          setCurrentTeam(parsed.currentTeam);
          setUsedWords(new Set(parsed.usedWords));
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Сохранение state при изменениях во время игры
  useEffect(() => {
    if (phase === 'setup' || phase === 'winner') {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        phase, numTeams, targetPoints, roundDuration,
        selectedCats: Array.from(selectedCats),
        teams, currentTeam,
        usedWords: Array.from(usedWords),
      }));
    } catch { /* ignore */ }
  }, [phase, numTeams, targetPoints, roundDuration, selectedCats, teams, currentTeam, usedWords]);

  // Таймер
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(roundDuration);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          // Время вышло — переход в round-result
          setPhase('round-result');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, [roundDuration]);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // === Действия ===
  // A12 — конфетти при экране победителя
  const winnerConfettiRef = useRef(false);
  useEffect(() => {
    if (phase === 'winner' && !winnerConfettiRef.current) {
      winnerConfettiRef.current = true;
      haptic.success();
      triggerConfetti({ count: 120, power: 14, duration: 2800 });
    }
    if (phase !== 'winner') winnerConfettiRef.current = false;
  }, [phase]);

  const handleStart = () => {
    if (selectedCats.size === 0) return;
    const newTeams = TEAM_COLORS.slice(0, numTeams).map(t => ({ ...t, score: 0 }));
    setTeams(newTeams);
    setCurrentTeam(0);
    setUsedWords(new Set());
    setPhase('team-intro');
  };

  const startRound = () => {
    const w = pickRandomWord(Array.from(selectedCats), usedWords, allCategories);
    if (!w) {
      // Слова кончились — присуждаем победу команде с макс очками или сбрасываем
      setPhase('winner');
      return;
    }
    setCurrentWord(w);
    setUsedWords(prev => new Set(prev).add(w));
    setRoundResults([]);
    setPhase('playing');
    startTimer();
  };

  const nextWord = (guessed: boolean) => {
    setRoundResults(prev => [...prev, { word: currentWord, guessed }]);
    const w = pickRandomWord(Array.from(selectedCats), usedWords, allCategories);
    if (!w) {
      if (timerRef.current) clearInterval(timerRef.current);
      setPhase('round-result');
      return;
    }
    setCurrentWord(w);
    setUsedWords(prev => new Set(prev).add(w));
  };

  const finishRound = () => {
    // Подсчёт: каждое угаданное = +1, пропущенное = 0 (можно -1 опцию)
    const guessed = roundResults.filter(r => r.guessed).length;
    const updated = teams.map((t, i) =>
      i === currentTeam ? { ...t, score: t.score + guessed } : t
    );
    setTeams(updated);
    // Проверка победы
    const winner = updated.find(t => t.score >= targetPoints);
    if (winner) {
      setPhase('winner');
    } else {
      setCurrentTeam((currentTeam + 1) % teams.length);
      setPhase('team-intro');
    }
  };

  const restart = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('setup');
    setTeams([]);
    setCurrentTeam(0);
    setUsedWords(new Set());
    setRoundResults([]);
    setTimeLeft(0);
    localStorage.removeItem(STORAGE_KEY);
  };

  const toggleCat = (id: string) => {
    setSelectedCats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // === Рендеры ===
  if (phase === 'setup') {
    return (
      <div className="crocodile-setup" style={{ height: '100dvh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header className="safe-top" style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
          borderBottom: '1px solid var(--border)',
        }}>
          <button onClick={() => goBack(nav, '/alias')} style={{
            width: 36, height: 36, borderRadius: 18, border: 'none',
            background: 'var(--surface-light)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 style={{ margin: 0, fontSize: 'var(--fs-heading)', fontWeight: 700 }}>Crocodile</h1>
        </header>

        <div className="page-scroll ce-form crocodile-setup-scroll" style={{ padding: 16, paddingBottom: '24px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div className="ce-block" style={{ marginBottom: 20, animationDelay: '0ms' }}>
            <div style={{ fontSize: 'var(--fs-micro)', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>Команд</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[2, 3, 4].map(n => (
                <button key={n} onClick={() => { haptic.tap(); setNumTeams(n); }} style={{
                  padding: '14px 0', borderRadius: 14,
                  background: numTeams === n ? 'var(--accent)' : 'var(--surface-light)',
                  color: numTeams === n ? 'var(--bg)' : 'var(--text)',
                  border: '1px solid', borderColor: numTeams === n ? 'var(--accent)' : 'var(--border)',
                  fontSize: 'var(--fs-snap16)', fontWeight: 600, cursor: 'pointer',
                }}>{n}</button>
              ))}
            </div>
          </div>

          <div className="ce-block" style={{ marginBottom: 20, animationDelay: '60ms' }}>
            <div style={{ fontSize: 'var(--fs-micro)', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>До скольки баллов</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[30, 50, 100].map(n => (
                <button key={n} onClick={() => { haptic.tap(); setTargetPoints(n); }} style={{
                  padding: '14px 0', borderRadius: 14,
                  background: targetPoints === n ? 'var(--accent)' : 'var(--surface-light)',
                  color: targetPoints === n ? 'var(--bg)' : 'var(--text)',
                  border: '1px solid', borderColor: targetPoints === n ? 'var(--accent)' : 'var(--border)',
                  fontSize: 'var(--fs-snap16)', fontWeight: 600, cursor: 'pointer',
                }}>{n}</button>
              ))}
            </div>
          </div>

          <div className="ce-block" style={{ marginBottom: 20, animationDelay: '120ms' }}>
            <div style={{ fontSize: 'var(--fs-micro)', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>Время раунда</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[30, 60, 90].map(n => (
                <button key={n} onClick={() => { haptic.tap(); setRoundDuration(n); }} style={{
                  padding: '14px 0', borderRadius: 14,
                  background: roundDuration === n ? 'var(--accent)' : 'var(--surface-light)',
                  color: roundDuration === n ? 'var(--bg)' : 'var(--text)',
                  border: '1px solid', borderColor: roundDuration === n ? 'var(--accent)' : 'var(--border)',
                  fontSize: 'var(--fs-snap16)', fontWeight: 600, cursor: 'pointer',
                }}>{n} сек</button>
              ))}
            </div>
          </div>

          <div className="ce-block" style={{ marginBottom: 20, animationDelay: '180ms' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 'var(--fs-micro)', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
                Категории слов <span style={{ fontWeight: 400, textTransform: 'none' }}>(можно несколько)</span>
              </div>
              <button onClick={() => { haptic.tap(); nav('/alias/categories'); }} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 'var(--fs-caption)', fontWeight: 700, cursor: 'pointer', padding: 0, flexShrink: 0, whiteSpace: 'nowrap' }}>
                Свои категории →
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {allCategories.map(c => {
                const active = selectedCats.has(c.id);
                return (
                  <button key={c.id} onClick={() => { haptic.select(); toggleCat(c.id); }} style={{
                    padding: '14px 10px', borderRadius: 14,
                    background: active ? 'var(--accent)' : 'var(--surface-light)',
                    color: active ? 'var(--bg)' : 'var(--text)',
                    border: '1px solid', borderColor: active ? 'var(--accent)' : 'var(--border)',
                    textAlign: 'left', cursor: 'pointer',
                  }}>
                    <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', color: active ? 'currentColor' : 'var(--accent)' }}><GlyphIcon name={normalizeGlyph(c.emoji, 'archive')} size={22} /></div>
                    <div style={{ fontSize: 'var(--fs-label)', fontWeight: 600 }}>{c.title}</div>
                    <div style={{ fontSize: 'var(--fs-snap10)', opacity: 0.7, marginTop: 1 }}>{c.words.length} слов</div>
                    {('owner_id' in c) && <div style={{ fontSize: 'var(--fs-snap10)', fontWeight: 700, opacity: 0.9, marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}><GlyphIcon name="edit" size={12} /> своя</div>}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        <div className="game-setup-footer" style={{ padding:'10px 16px calc(12px + env(safe-area-inset-bottom, 0px))', borderTop:'1px solid var(--border)', background:'color-mix(in srgb, var(--bg) 90%, transparent)', backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)' }}>
          <div className="crocodile-start-dock" style={{ margin:0, padding:0, background:'none' }}>
            <button onClick={() => { haptic.tap(); handleStart(); }} disabled={selectedCats.size === 0} className="alias-btn-press crocodile-start-button" style={{
              width: '100%', minHeight: 56, padding: '16px 20px', borderRadius: 20,
              background: selectedCats.size > 0 ? 'var(--accent)' : 'var(--surface-light)',
              color: selectedCats.size > 0 ? '#fff' : 'var(--muted)',
              border: 'none', fontSize: 'var(--fs-snap16)', fontWeight: 750,
              cursor: selectedCats.size > 0 ? 'pointer' : 'default',
            }}>
              Начать игру
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== Team intro =====
  if (phase === 'team-intro') {
    const team = teams[currentTeam];
    return (
      <div style={{
        height: '100dvh', minHeight: 0, overflow: 'hidden', background: team.color,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 'calc(20px + env(safe-area-inset-top, 0px)) 20px calc(20px + env(safe-area-inset-bottom, 0px))',
        boxSizing: 'border-box', color: '#fff', position: 'relative',
      }}>
        <button onClick={() => { haptic.tap(); restart(); }} style={{
          position: 'absolute', top: 'calc(12px + env(safe-area-inset-top, 0px))', left: 16,
          width: 36, height: 36, borderRadius: 18, border: 'none',
          background: 'rgba(0,0,0,0.25)', color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>

        {/* Текущий счёт */}
        <div style={{
          position: 'absolute', top: 'calc(12px + env(safe-area-inset-top, 0px))', right: 16,
          padding: '6px 12px', borderRadius: 14,
          background: 'rgba(0,0,0,0.25)', fontSize: 'var(--fs-caption)', fontWeight: 600,
        }}>
          до {targetPoints}
        </div>

        <div style={{ fontSize: 'var(--fs-snap14)', fontWeight: 500, opacity: 0.8, marginBottom: 8 }}>Ход команды</div>
        <div className="alias-team-in" style={{ fontSize: 44, fontWeight: 800, marginBottom: 24, textAlign: 'center' }}>{team.name}</div>

        {/* Табло всех команд */}
        <div style={{ width: '100%', maxWidth: 360, marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {teams.map((t, i) => (
            <div key={i} className="alias-row-in" style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 14px', borderRadius: 12,
              background: i === currentTeam ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.12)',
              border: i === currentTeam ? '1.5px solid rgba(255,255,255,0.4)' : 'none',
              animationDelay: i * 60 + 'ms',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flexWrap: 'wrap' }}>
                <div style={{ width: 12, height: 12, borderRadius: 6, background: t.color, border: '1.5px solid rgba(255,255,255,0.6)' }} />
                <span style={{ fontSize: 'var(--fs-snap14)', fontWeight: 600 }}>{t.name}</span>
              </div>
              <span style={{ fontSize: 'var(--fs-snap16)', fontWeight: 700 }}>{t.score}</span>
            </div>
          ))}
        </div>

        <button onClick={() => { haptic.success(); startRound(); }} className="alias-btn-press alias-cta-in" style={{
          padding: '18px 40px', borderRadius: 100,
          background: '#fff', color: team.color,
          border: 'none', fontSize: 'var(--fs-heading)', fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
        }}>
          Готовы, начать
        </button>

        <div style={{ marginTop: 20, fontSize: 'var(--fs-caption)', opacity: 0.85, textAlign: 'center', maxWidth: 280 }}>
          Передайте телефон ведущему команды. Один объясняет — остальные угадывают.
        </div>
      </div>
    );
  }

  // ===== Playing =====
  if (phase === 'playing') {
    const team = teams[currentTeam];
    const guessed = roundResults.filter(r => r.guessed).length;
    const skipped = roundResults.filter(r => !r.guessed).length;
    return (
      <div style={{
        height: '100dvh', minHeight: 0, overflow: 'hidden', background: team.color,
        display: 'flex', flexDirection: 'column', color: '#fff',
        padding: 'calc(12px + env(safe-area-inset-top, 0px)) 16px calc(16px + env(safe-area-inset-bottom, 0px))',
        boxSizing: 'border-box',
      }}>
        {/* Шапка: таймер + счёт */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
          padding: '4px 2px 8px', marginBottom: 'auto', minWidth: 0, flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--fs-caption)', opacity: 0.85 }}>Угадано:</span>
            <span key={guessed} className="alias-score-pop" style={{ fontSize: 'var(--fs-title)', fontWeight: 800 }}>{guessed}</span>
            <span style={{ opacity: 0.5 }}>/</span>
            <span style={{ fontSize: 'var(--fs-snap14)', opacity: 0.7 }}>пропущено {skipped}</span>
          </div>
          <div className={timeLeft <= 10 ? 'alias-timer-hot' : undefined} style={{
            padding: '8px 16px', borderRadius: 100,
            background: timeLeft <= 10 ? '#fff' : 'rgba(0,0,0,0.25)',
            color: timeLeft <= 10 ? team.color : '#fff',
            fontSize: 'var(--fs-title)', fontWeight: 800, fontVariantNumeric: 'tabular-nums',
            transition: 'background 200ms, color 200ms',
          }}>
            {timeLeft}
          </div>
        </div>

        {/* Слово (свайп: вправо = угадали, влево = пропуск) */}
        <SwipeWord word={currentWord} teamColor={team.color} onGuess={() => nextWord(true)} onSkip={() => nextWord(false)} />

        {/* Кнопки */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12, marginTop: 'auto', flexShrink: 0 }}>
          <button onClick={() => { haptic.tap(); nextWord(false); }} className="alias-btn-press" style={{
            padding: '18px 8px', borderRadius: 18,
            background: 'rgba(0,0,0,0.30)', color: '#fff',
            border: 'none', fontSize: 'var(--fs-snap16)', fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Пропустить
          </button>
          <button onClick={() => { haptic.success(); nextWord(true); }} className="alias-btn-press" style={{
            padding: '18px 8px', borderRadius: 18,
            background: '#fff', color: team.color,
            border: 'none', fontSize: 'var(--fs-snap16)', fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Угадали
          </button>
        </div>
      </div>
    );
  }

  // ===== Round result =====
  if (phase === 'round-result') {
    const team = teams[currentTeam];
    const guessed = roundResults.filter(r => r.guessed).length;
    const skipped = roundResults.filter(r => !r.guessed).length;
    return (
      <div style={{
        height: '100dvh', minHeight: 0, overflow: 'hidden', background: 'var(--bg)', color: 'var(--text)',
        display: 'flex', flexDirection: 'column', padding: '0 20px', boxSizing: 'border-box',
      }}>
        <header className="safe-top" style={{ paddingBottom: 16, flexShrink: 0 }}>
          <div style={{ fontSize: 'var(--fs-snap14)', color: 'var(--muted)', marginBottom: 4 }}>Итог раунда</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 18, height: 18, borderRadius: 9, background: team.color, flexShrink: 0 }} />
            <h1 style={{ margin: 0, fontSize: 'var(--fs-title)', fontWeight: 800 }}>{team.name}</h1>
          </div>
        </header>

        <div style={{
          padding: '24px 20px', textAlign: 'center', background: 'var(--surface-light)',
          borderRadius: 20, marginBottom: 16, flexShrink: 0,
        }}>
          <div style={{ fontSize: 'var(--fs-snap14)', color: 'var(--muted)', marginBottom: 8 }}>За раунд</div>
          <div className="alias-bignum-in" style={{ fontSize: 56, fontWeight: 800, color: team.color, lineHeight: 1 }}>+{guessed}</div>
          {skipped > 0 && (
            <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 8 }}>
              пропущено: {skipped}
            </div>
          )}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 12 }}>
          {roundResults.length > 0 && (
            <div>
              <div style={{ fontSize: 'var(--fs-micro)', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                Слова раунда (нажми чтобы поменять)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {roundResults.map((r, i) => (
                  <button key={i} className="alias-result-in" onClick={() => {
                    haptic.select();
                    setRoundResults(prev => prev.map((x, idx) => idx === i ? { ...x, guessed: !x.guessed } : x));
                  }} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                    width: '100%', padding: '11px 14px', borderRadius: 12, boxSizing: 'border-box',
                    background: r.guessed ? 'var(--surface-light)' : 'transparent',
                    border: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left',
                    animationDelay: Math.min(i, 12) * 35 + 'ms',
                  }}>
                    <span style={{
                      minWidth: 0, fontSize: 'var(--fs-snap14)', color: 'var(--text)',
                      textDecoration: r.guessed ? 'none' : 'line-through',
                      opacity: r.guessed ? 1 : 0.5,
                    }}>
                      {r.word}
                    </span>
                    <span style={{
                      flexShrink: 0, fontSize: 'var(--fs-caption)', fontWeight: 600,
                      color: r.guessed ? '#10B981' : 'var(--muted)',
                    }}>
                      {r.guessed ? '+1' : 'пропуск'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{
          flexShrink: 0, padding: '12px 0 calc(12px + env(safe-area-inset-bottom, 0px))',
          background: 'var(--bg)', borderTop: '1px solid var(--border)',
        }}>
          <button onClick={() => { haptic.tap(); finishRound(); }} className="alias-btn-press" style={{
            width: '100%', minHeight: 54, padding: '15px 18px', borderRadius: 16,
            background: 'var(--accent)', color: 'var(--bg)',
            border: 'none', fontSize: 'var(--fs-snap16)', fontWeight: 750, cursor: 'pointer',
          }}>
            Продолжить
          </button>
        </div>
      </div>
    );
  }

  // ===== Winner =====
  if (phase === 'winner') {
    const sorted = teams.slice().sort((a, b) => b.score - a.score);
    const winner = sorted[0];
    return (
      <div style={{
        minHeight: '100vh', background: winner.color, color: '#fff',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '24px', textAlign: 'center',
      }}>
        <div className="alias-trophy" style={{ fontSize: 72, marginBottom: 16 }}>🏆</div>
        <div style={{ fontSize: 'var(--fs-snap14)', opacity: 0.85, marginBottom: 6 }}>Победили</div>
        <div className="alias-team-in" style={{ fontSize: 48, fontWeight: 800, marginBottom: 32 }}>{winner.name}</div>

        {/* Итоговая таблица */}
        <div style={{ width: '100%', maxWidth: 360, marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sorted.map((t, i) => (
            <div key={i} className="alias-row-in" style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 18px', borderRadius: 14,
              background: i === 0 ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.12)',
              border: i === 0 ? '1.5px solid rgba(255,255,255,0.4)' : 'none',
              animationDelay: i * 70 + 'ms',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 'var(--fs-heading)', fontWeight: 800, opacity: 0.7, minWidth: 16 }}>{i + 1}</span>
                <div style={{ width: 12, height: 12, borderRadius: 6, background: t.color, border: '1.5px solid rgba(255,255,255,0.6)' }} />
                <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>{t.name}</span>
              </div>
              <span style={{ fontSize: 'var(--fs-title)', fontWeight: 800 }}>{t.score}</span>
            </div>
          ))}
        </div>

        <button onClick={() => { haptic.tap(); restart(); }} className="alias-btn-press" style={{
          padding: '16px 40px', borderRadius: 100,
          background: '#fff', color: winner.color,
          border: 'none', fontSize: 'var(--fs-snap16)', fontWeight: 700, cursor: 'pointer',
          marginBottom: 12,
        }}>
          Сыграть ещё
        </button>
        <button onClick={() => { haptic.tap(); restart(); goBack(nav, '/alias'); }} className="alias-btn-press" style={{
          padding: '12px 32px', borderRadius: 100,
          background: 'transparent', color: '#fff',
          border: '1.5px solid rgba(255,255,255,0.5)',
          fontSize: 'var(--fs-snap14)', fontWeight: 600, cursor: 'pointer',
        }}>
          В чаты
        </button>
      </div>
    );
  }

  return null;
}
