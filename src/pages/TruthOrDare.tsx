import { useState, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { TOD_CATEGORIES, pickPrompt, hasKind, type TodKind, type TodCategory } from '@/lib/tod-prompts';
import { useAuthStore } from '@/stores/authStore';
import { useTodCategoriesStore } from '@/stores/todCategoriesStore';
import { haptic } from '@/lib/haptics';
import { GlyphIcon, normalizeGlyph } from '@/components/icons/AppGlyph';

const STORAGE_KEY = 'tod-local-v2';
const TRUTH = { color: '#63B9FF', grad: 'linear-gradient(145deg, #21D4FD 0%, #3A7BFF 100%)', label: 'ПРАВДА' };
const DARE = { color: '#D8FF36', grad: 'linear-gradient(145deg, #E6FF48 0%, #73F29D 100%)', label: 'ДЕЙСТВИЕ' };
const DRINK = { color: '#F637D8', grad: 'linear-gradient(145deg, #B122F2 0%, #FF43CB 100%)', label: 'НАПИТОК' };
const TIMERS = [0, 30, 60];
const PLAYER_COLORS = ['#F23CE4', '#D8FF36', '#73F29D', '#63B9FF', '#FFB84A', '#FF6B81'];

const BackIcon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>;
const DotsIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>;

const pageBg = '#000';
const panelBg = 'rgba(255,255,255,0.06)';
const panelSoft = 'rgba(255,255,255,0.09)';
const borderSoft = 'rgba(255,255,255,0.09)';
const borderStrong = 'rgba(255,255,255,0.16)';
const textMain = '#fff';
const textMuted = 'rgba(255,255,255,0.66)';

const sectionLabelStyle: CSSProperties = {
  fontSize: 'var(--fs-micro)',
  fontWeight: 700,
  color: textMuted,
  textTransform: 'uppercase',
  letterSpacing: '.08em',
  marginBottom: 10,
};

function playerColor(index: number) {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}

function glassButton(active = false): CSSProperties {
  return {
    borderRadius: 18,
    border: `1px solid ${active ? 'rgba(255,255,255,0.28)' : borderSoft}`,
    background: active ? 'rgba(255,255,255,0.14)' : panelBg,
    color: textMain,
    cursor: 'pointer',
  };
}

export default function TruthOrDare() {
  const nav = useNavigate();
  const { session } = useAuthStore();
  const myId = session?.user?.id;
  const customCats = useTodCategoriesStore(s => s.mine);
  const loadMine = useTodCategoriesStore(s => s.loadMine);
  const allCategories: TodCategory[] = useMemo(() => [
    ...TOD_CATEGORIES,
    ...customCats.map(c => ({ id: c.id, title: c.title, emoji: c.emoji, rating: c.rating, truths: c.truths, dares: c.dares })),
  ], [customCats]);

  const [phase, setPhase] = useState<'setup' | 'playing'>('setup');
  const [names, setNames] = useState<string[]>(['', '']);
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set(['classic']));
  const [hideSpicy, setHideSpicy] = useState(false);
  const [dareTimer, setDareTimer] = useState(0);
  const [randomOrder, setRandomOrder] = useState(false);
  const [mode, setMode] = useState<'players' | 'deck'>('players');
  const [ruleset, setRuleset] = useState<'classic' | 'drink'>('classic');

  const [current, setCurrent] = useState(0);
  const [turn, setTurn] = useState(1);
  const [used, setUsed] = useState<Set<string>>(new Set());
  const [passesLeft, setPassesLeft] = useState<number[]>([1, 1]);
  const [scores, setScores] = useState<number[]>([0, 0]);
  const [card, setCard] = useState<{ kind: TodKind; text: string } | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [picking, setPicking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => { if (myId) loadMine(myId); }, [myId, loadMine]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (p) {
        if (Array.isArray(p.names) && p.names.length >= 2) setNames(p.names);
        if (Array.isArray(p.selectedCats) && p.selectedCats.length) setSelectedCats(new Set(p.selectedCats));
        if (typeof p.hideSpicy === 'boolean') setHideSpicy(p.hideSpicy);
        if (TIMERS.includes(p.dareTimer)) setDareTimer(p.dareTimer);
        if (typeof p.randomOrder === 'boolean') setRandomOrder(p.randomOrder);
        if (Array.isArray(p.used)) setUsed(new Set(p.used));
        if (p.mode === 'deck' || p.mode === 'players') setMode(p.mode);
        if (p.ruleset === 'classic' || p.ruleset === 'drink') setRuleset(p.ruleset);
      }
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        names,
        selectedCats: Array.from(selectedCats),
        hideSpicy,
        dareTimer,
        randomOrder,
        mode,
        ruleset,
        used: Array.from(used),
      }));
    } catch { /* noop */ }
  }, [names, selectedCats, hideSpicy, dareTimer, randomOrder, mode, ruleset, used]);

  useEffect(() => {
    if (!card || card.kind !== 'dare' || !dareTimer) { setTimeLeft(0); return; }
    setTimeLeft(dareTimer);
    const iv = window.setInterval(() => setTimeLeft(t => {
      if (t <= 1) {
        window.clearInterval(iv);
        return 0;
      }
      return t - 1;
    }), 1000);
    return () => window.clearInterval(iv);
  }, [card, dareTimer]);

  const visibleCategories = useMemo(() => allCategories.filter(c => !hideSpicy || c.rating !== 'spicy'), [allCategories, hideSpicy]);
  const effectiveIds = useMemo(() => {
    const vis = new Set(visibleCategories.map(c => c.id));
    return Array.from(selectedCats).filter(id => vis.has(id));
  }, [selectedCats, visibleCategories]);
  const truthsAvail = useMemo(() => hasKind(effectiveIds, 'truth', allCategories), [effectiveIds, allCategories]);
  const daresAvail = useMemo(() => hasKind(effectiveIds, 'dare', allCategories), [effectiveIds, allCategories]);
  const canStart = (mode === 'deck' || names.length >= 2) && effectiveIds.length > 0 && (truthsAvail || daresAvail);

  const cleanNames = () => names.map((n, i) => n.trim() || `Игрок ${i + 1}`);
  const activeNames = phase === 'playing' ? names : cleanNames();
  const player = activeNames[current] || `Игрок ${current + 1}`;
  const currentPasses = passesLeft[current] || 0;
  const currentScore = scores[current] || 0;

  const toggleCat = (id: string) => {
    haptic.select();
    setSelectedCats(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const start = () => {
    if (!canStart) return;
    haptic.success();
    const resolvedNames = cleanNames();
    setNames(resolvedNames);
    setCurrent(0);
    setTurn(1);
    setCard(null);
    setPassesLeft(new Array(resolvedNames.length).fill(1));
    setScores(new Array(resolvedNames.length).fill(0));
    setPhase('playing');
    setMenuOpen(false);
    setLeaderboardOpen(false);
  };

  const draw = (req: TodKind | 'random') => {
    let kind: TodKind;
    if (req === 'random') {
      const opts: TodKind[] = [];
      if (truthsAvail) opts.push('truth');
      if (daresAvail) opts.push('dare');
      if (!opts.length) return;
      kind = opts[Math.floor(Math.random() * opts.length)];
    } else {
      kind = req;
    }
    let text = pickPrompt(effectiveIds, kind, used, allCategories);
    if (!text) {
      const fresh = new Set<string>();
      text = pickPrompt(effectiveIds, kind, fresh, allCategories);
      setUsed(fresh);
      if (!text) return;
    }
    setUsed(prev => new Set(prev).add(text as string));
    setCard({ kind, text });
  };

  const drawRandom = () => {
    if (spinning || picking) return;
    haptic.tap();
    setSpinning(true);
    const t = window.setTimeout(() => { setSpinning(false); draw('random'); }, 850);
    timers.current.push(t);
  };

  const advance = () => {
    if (mode === 'deck') {
      setTurn(x => x + 1);
      return;
    }
    if (names.length > 1 && randomOrder) {
      setPicking(true);
      let idx = Math.floor(Math.random() * names.length);
      while (idx === current && names.length > 1) idx = Math.floor(Math.random() * names.length);
      const t = window.setTimeout(() => {
        setPicking(false);
        setCurrent(idx);
        setTurn(x => x + 1);
      }, 1000);
      timers.current.push(t);
    } else {
      setCurrent(c => (c + 1) % names.length);
      setTurn(x => x + 1);
    }
  };

  const done = () => {
    haptic.success();
    if (mode === 'players') {
      setScores(prev => {
        const next = [...prev];
        next[current] = (next[current] || 0) + 1;
        return next;
      });
    }
    setCard(null);
    advance();
  };

  const usePass = () => {
    if (currentPasses <= 0) return;
    haptic.tap();
    setPassesLeft(prev => {
      const next = [...prev];
      next[current] = Math.max(0, (next[current] || 0) - 1);
      return next;
    });
    setCard(null);
    advance();
  };

  const drinkInstead = () => {
    haptic.tap();
    setCard(null);
    advance();
  };

  const skipClassic = () => {
    haptic.tap();
    setCard(null);
    advance();
  };

  const restartGame = () => {
    haptic.tap();
    setMenuOpen(false);
    setLeaderboardOpen(false);
    setCurrent(0);
    setTurn(1);
    setCard(null);
    setPassesLeft(new Array(names.length).fill(1));
    setScores(new Array(names.length).fill(0));
  };
  const resetUsed = () => { haptic.tap(); setMenuOpen(false); setUsed(new Set()); };
  const finishGame = () => { haptic.tap(); setMenuOpen(false); setConfirmExit(false); setLeaderboardOpen(false); setPhase('setup'); setCard(null); };

  const addPlayer = () => { haptic.tap(); setNames(prev => [...prev, '']); };
  const removePlayer = (i: number) => { haptic.tap(); setNames(prev => prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)); };
  const setName = (i: number, v: string) => setNames(prev => prev.map((n, idx) => idx === i ? v : n));

  const leaderboardRows = activeNames.map((name, index) => ({
    name,
    score: scores[index] || 0,
    passes: passesLeft[index] || 0,
    color: playerColor(index),
    index,
  })).sort((a, b) => b.score - a.score || b.passes - a.passes || a.index - b.index);

  const exitModal = confirmExit && (
    <div onClick={() => setConfirmExit(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.62)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} className="anim-pop-in" style={{ background: '#111', borderRadius: 24, padding: 20, width: 320, maxWidth: '90vw', border: `1px solid ${borderStrong}`, color: textMain }}>
        <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 800, marginBottom: 6 }}>Выйти из игры?</div>
        <div style={{ fontSize: 'var(--fs-label)', color: textMuted, marginBottom: 16 }}>Текущая партия сбросится.</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => { haptic.tap(); setConfirmExit(false); }} style={{ flex: 1, padding: 13, borderRadius: 14, border: `1px solid ${borderSoft}`, background: panelBg, color: textMain, fontSize: 'var(--fs-label)', fontWeight: 700, cursor: 'pointer' }}>Отмена</button>
          <button onClick={finishGame} className="alias-btn-press" style={{ flex: 1, padding: 13, borderRadius: 14, border: 'none', background: 'linear-gradient(145deg, #ff4d7a, #ff2256)', color: '#fff', fontSize: 'var(--fs-label)', fontWeight: 800, cursor: 'pointer' }}>Выйти</button>
        </div>
      </div>
    </div>
  );

  const leaderboardModal = leaderboardOpen && mode === 'players' && (
    <div onClick={() => setLeaderboardOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 160, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 0 }}>
      <div onClick={e => e.stopPropagation()} className="anim-pop-in" style={{ width: '100%', maxWidth: 520, borderTopLeftRadius: 28, borderTopRightRadius: 28, background: '#131313', border: `1px solid ${borderStrong}`, padding: '10px 16px calc(20px + env(safe-area-inset-bottom, 0px))' }}>
        <div style={{ width: 54, height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.18)', margin: '0 auto 14px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 800, color: textMain }}>Таблица лидеров</div>
          <button onClick={() => setLeaderboardOpen(false)} style={{ width: 40, height: 40, borderRadius: 20, border: 'none', background: panelBg, color: '#fff', cursor: 'pointer', fontSize: 24, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {leaderboardRows.map((row, index) => (
            <div key={row.name + row.index} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 12, padding: '14px 14px', borderRadius: 18, background: row.color, color: '#000' }}>
              <div style={{ width: 28, height: 28, borderRadius: 14, background: 'rgba(0,0,0,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{index + 1}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-title)', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</div>
                <div style={{ fontSize: 'var(--fs-caption)', opacity: 0.8, marginTop: 2 }}>{ruleset === 'drink' ? `пропуск без напитка: ${row.passes}` : 'классические правила'}</div>
              </div>
              <div style={{ fontSize: 'clamp(22px, 6vw, 34px)', fontWeight: 900 }}>{row.score}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (phase === 'setup') {
    return (
      <div style={{ height: '100dvh', background: pageBg, color: textMain, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header className="safe-top" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px 8px' }}>
          <button onClick={() => { haptic.tap(); nav(-1); }} style={{ width: 42, height: 42, borderRadius: 21, border: `1px solid ${borderSoft}`, background: panelBg, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{BackIcon}</button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 800 }}>Правда или Действие</div>
            <div style={{ fontSize: 'var(--fs-caption)', color: textMuted }}>Яркий локальный режим для компании</div>
          </div>
        </header>

        <div className="page-scroll ce-form" style={{ padding: '8px 16px 24px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 30, background: '#070707', border: `1px solid ${borderStrong}`, padding: '26px 18px 22px', marginBottom: 20 }}>
            <div style={{ position: 'absolute', inset: 'auto -40px 24px auto', width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(242,60,228,0.35), rgba(242,60,228,0) 68%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', inset: '-20px auto auto -50px', width: 220, height: 60, borderRadius: 22, background: TRUTH.grad, transform: 'rotate(-8deg)', opacity: 0.95 }} />
            <div style={{ position: 'absolute', inset: '70px -60px auto auto', width: 210, height: 60, borderRadius: 22, background: DARE.grad, transform: 'rotate(-8deg)', opacity: 0.95 }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 'clamp(34px, 11vw, 68px)', fontWeight: 900, lineHeight: 0.9, letterSpacing: '-0.04em', marginBottom: 14 }}>Правда <span style={{ color: '#63B9FF' }}>или</span><br/>Действие</div>
              <div style={{ fontSize: 'var(--fs-body)', color: textMuted, lineHeight: 1.5, maxWidth: 420 }}>Выбирай игроков, стиль партии и нужные категории. В режиме «Правда или напиток» каждый игрок получает один бесплатный пропуск без напитка.</div>
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={sectionLabelStyle}>Режим</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => { haptic.tap(); setMode('players'); }} style={{ ...glassButton(mode === 'players'), padding: '15px 14px', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}><GlyphIcon name="users" size={18} /><span style={{ fontSize: 'var(--fs-label)', fontWeight: 800 }}>С игроками</span></div>
                <div style={{ fontSize: 'var(--fs-caption)', color: textMuted }}>Передавайте телефон по кругу</div>
              </button>
              <button onClick={() => { haptic.tap(); setMode('deck'); }} style={{ ...glassButton(mode === 'deck'), padding: '15px 14px', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}><GlyphIcon name="cards" size={18} /><span style={{ fontSize: 'var(--fs-label)', fontWeight: 800 }}>Колода</span></div>
                <div style={{ fontSize: 'var(--fs-caption)', color: textMuted }}>Тяните карточки без очереди</div>
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={sectionLabelStyle}>Правила</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => { haptic.tap(); setRuleset('classic'); }} style={{ ...glassButton(ruleset === 'classic'), padding: '15px 14px', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}><GlyphIcon name="cards" size={18} /><span style={{ fontSize: 'var(--fs-label)', fontWeight: 800 }}>Классика</span></div>
                <div style={{ fontSize: 'var(--fs-caption)', color: textMuted }}>Правда или действие</div>
              </button>
              <button onClick={() => { haptic.tap(); setRuleset('drink'); }} style={{ ...glassButton(ruleset === 'drink'), padding: '15px 14px', textAlign: 'left', boxShadow: ruleset === 'drink' ? '0 0 0 1px rgba(246,55,216,0.35), 0 16px 34px rgba(246,55,216,0.18)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5, color: ruleset === 'drink' ? '#ff7de5' : '#fff' }}><GlyphIcon name="bottle" size={18} /><span style={{ fontSize: 'var(--fs-label)', fontWeight: 800 }}>Правда или напиток</span></div>
                <div style={{ fontSize: 'var(--fs-caption)', color: textMuted }}>Не справился — пьёшь. У всех по 1 бесплатному пропуску.</div>
              </button>
            </div>
          </div>

          {mode === 'players' && (
            <div style={{ marginBottom: 18 }}>
              <div style={sectionLabelStyle}>Игроки</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {names.map((n, i) => {
                  const accent = playerColor(i);
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: accent, color: '#000', padding: '10px 12px', borderRadius: 22, transform: `rotate(${i % 2 === 0 ? '-2deg' : '2deg'})`, boxShadow: '0 10px 28px rgba(0,0,0,0.2)' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 17, background: 'rgba(255,255,255,0.24)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>{i + 1}</div>
                      <input value={n} onChange={e => setName(i, e.target.value)} maxLength={24} placeholder={`Игрок ${i + 1}`} style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: '#000', fontSize: 'var(--fs-title)', fontWeight: 800 }} />
                      {names.length > 2 && (
                        <button onClick={() => removePlayer(i)} className="alias-btn-press" style={{ width: 36, height: 36, borderRadius: 18, border: 'none', background: 'rgba(0,0,0,0.14)', color: '#000', cursor: 'pointer', flexShrink: 0, fontSize: 'var(--fs-title)', lineHeight: 1 }}>×</button>
                      )}
                    </div>
                  );
                })}
              </div>
              <button onClick={addPlayer} className="alias-btn-press" style={{ marginTop: 12, width: '100%', padding: '15px', borderRadius: 18, border: `1px dashed ${borderStrong}`, background: panelBg, color: '#fff', fontSize: 'var(--fs-label)', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <GlyphIcon name="users" size={16} /> Добавить игрока
              </button>
            </div>
          )}

          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={sectionLabelStyle}>Категории</div>
              <button onClick={() => { haptic.tap(); nav('/tod/categories'); }} style={{ background: 'none', border: 'none', color: '#63B9FF', fontSize: 'var(--fs-caption)', fontWeight: 800, cursor: 'pointer', padding: 0, whiteSpace: 'nowrap' }}>Свои категории →</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {visibleCategories.map((c, idx) => {
                const active = selectedCats.has(c.id);
                const isCustom = customCats.some(m => m.id === c.id);
                const accent = PLAYER_COLORS[idx % PLAYER_COLORS.length];
                return (
                  <button key={c.id} onClick={() => toggleCat(c.id)} style={{
                    padding: '14px 12px', borderRadius: 20,
                    background: active ? accent : panelBg,
                    color: active ? '#000' : '#fff',
                    border: `1px solid ${active ? accent : borderSoft}`,
                    textAlign: 'left', cursor: 'pointer', boxShadow: active ? '0 10px 26px rgba(0,0,0,0.22)' : 'none',
                  }}>
                    <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><GlyphIcon name={c.rating === 'spicy' ? 'heart' : normalizeGlyph(c.emoji, 'dice')} size={18} /><span style={{ fontSize: 'var(--fs-label)', fontWeight: 800 }}>{c.title}</span></div>
                      {isCustom && <span style={{ fontSize: 'var(--fs-snap10)', fontWeight: 800, padding: '4px 6px', borderRadius: 999, background: active ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.08)' }}>своя</span>}
                    </div>
                    <div style={{ fontSize: 'var(--fs-caption)', opacity: active ? 0.74 : 0.72 }}>{c.truths.length} правд · {c.dares.length} действий</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={sectionLabelStyle}>Настройки</div>

            <button onClick={() => { haptic.tap(); setHideSpicy(v => !v); }} className="alias-btn-press" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, border: `1px solid ${borderSoft}`, background: panelBg, cursor: 'pointer', marginBottom: 12, textAlign: 'left', color: '#fff' }}>
              <div style={{ color: '#63B9FF', display: 'flex' }}><GlyphIcon name="shield" size={22} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-label)', fontWeight: 800 }}>Скрывать взрослые категории</div>
                <div style={{ fontSize: 'var(--fs-caption)', color: textMuted, marginTop: 2 }}>Оставляет только нейтральные и парные наборы</div>
              </div>
              <div style={{ width: 48, height: 28, borderRadius: 14, background: hideSpicy ? '#63B9FF' : 'rgba(255,255,255,0.2)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 3, left: hideSpicy ? 23 : 3, width: 22, height: 22, borderRadius: 11, background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
              </div>
            </button>

            <div style={{ fontSize: 'var(--fs-caption)', color: textMuted, marginBottom: 6 }}>Таймер на действие</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
              {TIMERS.map(t => (
                <button key={t} onClick={() => { haptic.tap(); setDareTimer(t); }} style={{ padding: '12px 0', borderRadius: 16, border: `1px solid ${dareTimer === t ? '#73F29D' : borderSoft}`, background: dareTimer === t ? 'rgba(115,242,157,0.16)' : panelBg, color: '#fff', fontSize: 'var(--fs-label)', fontWeight: 800, cursor: 'pointer' }}>{t === 0 ? 'Выкл' : t + 'с'}</button>
              ))}
            </div>

            {mode === 'players' && (
              <>
                <div style={{ fontSize: 'var(--fs-caption)', color: textMuted, marginBottom: 6 }}>Порядок хода</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button onClick={() => { haptic.tap(); setRandomOrder(false); }} style={{ padding: '12px 0', borderRadius: 16, border: `1px solid ${!randomOrder ? '#F23CE4' : borderSoft}`, background: !randomOrder ? 'rgba(242,60,228,0.16)' : panelBg, color: '#fff', fontSize: 'var(--fs-label)', fontWeight: 800, cursor: 'pointer' }}>По кругу</button>
                  <button onClick={() => { haptic.tap(); setRandomOrder(true); }} style={{ padding: '12px 0', borderRadius: 16, border: `1px solid ${randomOrder ? '#F23CE4' : borderSoft}`, background: randomOrder ? 'rgba(242,60,228,0.16)' : panelBg, color: '#fff', fontSize: 'var(--fs-label)', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><GlyphIcon name="dice" size={14} /> Случайный</button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="game-setup-footer" style={{ padding: '10px 16px calc(14px + env(safe-area-inset-bottom, 0px))', borderTop: `1px solid ${borderSoft}`, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' }}>
          <button onClick={start} disabled={!canStart} className="alias-btn-press" style={{
            width: '100%', minHeight: 58, padding: '16px 20px', borderRadius: 22, border: 'none',
            background: canStart ? 'linear-gradient(145deg, #B122F2 0%, #63B9FF 100%)' : panelBg,
            color: '#fff', fontSize: 'var(--fs-snap16)', fontWeight: 900, cursor: canStart ? 'pointer' : 'default',
            boxShadow: canStart ? '0 18px 38px rgba(99,185,255,0.22)' : 'none',
          }}>Начать игру</button>
          {!canStart && (
            <div style={{ fontSize: 'var(--fs-caption)', color: textMuted, textAlign: 'center', marginTop: 8 }}>
              {effectiveIds.length === 0 ? 'Выберите хотя бы одну категорию' : mode === 'players' ? 'Нужно минимум 2 игрока' : 'Нужно выбрать режим'}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (spinning || picking) {
    return (
      <div style={{ minHeight: '100vh', background: pageBg, color: textMain, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24, textAlign: 'center' }}>
        <div className="tod-spin" style={{ width: 112, height: 112, borderRadius: 36, background: panelBg, border: `1px solid ${borderStrong}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: spinning ? '#63B9FF' : '#73F29D', boxShadow: '0 24px 60px rgba(0,0,0,0.28)' }}><GlyphIcon name={spinning ? 'dice' : 'bottle'} size={72} strokeWidth={1.35} /></div>
        <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 800 }}>{spinning ? 'Выбираем карточку…' : 'Определяем следующего игрока…'}</div>
        <div style={{ fontSize: 'var(--fs-body)', color: textMuted }}>{spinning ? 'Сейчас выпадет правда или действие' : 'Телефон перейдёт к следующему игроку'}</div>
      </div>
    );
  }

  if (card) {
    const meta = card.kind === 'truth' ? TRUTH : DARE;
    const showTimer = card.kind === 'dare' && dareTimer > 0;
    return (
      <div style={{ minHeight: '100vh', background: pageBg, color: textMain, display: 'flex', flexDirection: 'column', padding: 16, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 'env(safe-area-inset-top, 0px)', marginBottom: 12 }}>
          <button onClick={() => { haptic.tap(); setConfirmExit(true); }} style={{ width: 42, height: 42, borderRadius: 21, border: `1px solid ${borderSoft}`, background: panelBg, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{BackIcon}</button>
          <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 800, letterSpacing: '.12em', color: meta.color }}>{meta.label}</div>
          <div style={{ width: 42 }} />
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16 }}>
          <div style={{ borderRadius: 34, overflow: 'hidden', border: `1px solid ${borderStrong}`, background: '#0a0a0a' }}>
            <div style={{ padding: '14px 18px', background: meta.grad, color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                {mode === 'players' && <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 800, opacity: 0.72 }}>ходит сейчас</div>}
                <div style={{ fontSize: 'clamp(24px, 8vw, 42px)', fontWeight: 900 }}>{mode === 'players' ? player : meta.label}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                {mode === 'players' && <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 800, opacity: 0.78 }}>очки: {currentScore}</div>}
                {ruleset === 'drink' && mode === 'players' && <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 800, opacity: 0.78 }}>пропуск без напитка: {currentPasses}</div>}
              </div>
            </div>
            <div style={{ padding: '26px 20px 28px', background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))' }}>
              <div key={card.text} className="alias-word-in" style={{ fontSize: 'clamp(28px, 8vw, 46px)', fontWeight: 900, lineHeight: 1.12, textAlign: 'center' }}>{card.text}</div>
              {showTimer && (
                <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center' }}>
                  <div className={timeLeft <= 5 && timeLeft > 0 ? 'alias-timer-hot' : undefined} style={{ minWidth: 96, padding: '14px 18px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', border: `1px solid ${borderSoft}`, fontSize: 34, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: timeLeft === 0 ? textMuted : '#fff', textAlign: 'center' }}>
                    {timeLeft > 0 ? timeLeft : '⏰'}
                  </div>
                </div>
              )}
              {ruleset === 'drink' && mode === 'players' && (
                <div style={{ marginTop: 18, fontSize: 'var(--fs-body)', color: textMuted, textAlign: 'center', lineHeight: 1.45 }}>
                  Если не хочешь выполнять или отвечать — выбери <span style={{ color: '#ff7de5', fontWeight: 800 }}>«Пью»</span>.
                  {currentPasses > 0 ? ' Один пропуск без напитка пока ещё доступен.' : ' Бесплатный пропуск уже использован.'}
                </div>
              )}
            </div>
          </div>
        </div>

        {mode === 'players' ? (
          ruleset === 'drink' ? (
            <div style={{ display: 'grid', gridTemplateColumns: currentPasses > 0 ? '1fr 1fr 1.15fr' : '1fr 1.15fr', gap: 10, paddingBottom: 'max(6px, env(safe-area-inset-bottom, 0px))' }}>
              {currentPasses > 0 && (
                <button onClick={usePass} className="alias-btn-press" style={{ padding: '18px 10px', borderRadius: 18, border: `1px solid ${borderSoft}`, background: panelBg, color: '#fff', fontSize: 'var(--fs-label)', fontWeight: 800, cursor: 'pointer' }}>
                  Пропуск ×1
                </button>
              )}
              <button onClick={drinkInstead} className="alias-btn-press" style={{ padding: '18px 10px', borderRadius: 18, border: 'none', background: DRINK.grad, color: '#fff', fontSize: 'var(--fs-label)', fontWeight: 900, cursor: 'pointer', boxShadow: '0 12px 28px rgba(246,55,216,0.18)' }}>
                Пью
              </button>
              <button onClick={done} className="alias-btn-press" style={{ padding: '18px 10px', borderRadius: 18, border: 'none', background: '#fff', color: '#000', fontSize: 'var(--fs-label)', fontWeight: 900, cursor: 'pointer' }}>
                Выполнил(а)
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingBottom: 'max(6px, env(safe-area-inset-bottom, 0px))' }}>
              <button onClick={skipClassic} className="alias-btn-press" style={{ padding: '18px 0', borderRadius: 18, border: `1px solid ${borderSoft}`, background: panelBg, color: '#fff', fontSize: 'var(--fs-label)', fontWeight: 800, cursor: 'pointer' }}>Пропустить</button>
              <button onClick={done} className="alias-btn-press" style={{ padding: '18px 0', borderRadius: 18, border: 'none', background: '#fff', color: '#000', fontSize: 'var(--fs-label)', fontWeight: 900, cursor: 'pointer' }}>Выполнил(а)</button>
            </div>
          )
        ) : (
          <button onClick={done} className="alias-btn-press" style={{ width: '100%', padding: '18px 0', borderRadius: 18, border: 'none', background: '#fff', color: '#000', fontSize: 'var(--fs-label)', fontWeight: 900, cursor: 'pointer' }}>Дальше →</button>
        )}
        {leaderboardModal}
        {exitModal}
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: pageBg, color: textMain, display: 'flex', flexDirection: 'column', padding: 16, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 'env(safe-area-inset-top, 0px)', gap: 8, position: 'relative' }}>
        <button onClick={() => { haptic.tap(); setConfirmExit(true); }} style={{ width: 42, height: 42, borderRadius: 21, border: `1px solid ${borderSoft}`, background: panelBg, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{BackIcon}</button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
          <div style={{ fontSize: 'var(--fs-caption)', color: textMuted, fontWeight: 800 }}>{mode === 'deck' ? 'Карта' : 'Ход'} {turn}</div>
          <div style={{ fontSize: 'var(--fs-snap12)', color: ruleset === 'drink' ? '#ff7de5' : '#63B9FF', fontWeight: 800 }}>{ruleset === 'drink' ? 'Правда или напиток' : 'Классические правила'}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {mode === 'players' && (
            <button onClick={() => { haptic.tap(); setLeaderboardOpen(true); }} style={{ width: 42, height: 42, borderRadius: 21, border: `1px solid ${borderSoft}`, background: panelBg, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GlyphIcon name="trophy" size={18} />
            </button>
          )}
          <button onClick={() => { haptic.tap(); setMenuOpen(o => !o); }} style={{ width: 42, height: 42, borderRadius: 21, border: `1px solid ${borderSoft}`, background: panelBg, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{DotsIcon}</button>
        </div>
        {menuOpen && (
          <>
            <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
            <div className="anim-pop-in" style={{ position: 'absolute', top: 48, right: 0, zIndex: 50, background: '#121212', borderRadius: 16, border: `1px solid ${borderSoft}`, boxShadow: '0 18px 48px rgba(0,0,0,0.4)', overflow: 'hidden', minWidth: 220 }}>
              <button onClick={restartGame} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '13px 16px', background: 'none', border: 'none', color: '#fff', fontSize: 'var(--fs-label)', fontWeight: 700, cursor: 'pointer' }}>Начать заново</button>
              <button onClick={resetUsed} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '13px 16px', background: 'none', border: 'none', borderTop: `1px solid ${borderSoft}`, color: '#fff', fontSize: 'var(--fs-label)', fontWeight: 700, cursor: 'pointer' }}>Сбросить вопросы</button>
              <button onClick={finishGame} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '13px 16px', background: 'none', border: 'none', borderTop: `1px solid ${borderSoft}`, color: '#ff6f8d', fontSize: 'var(--fs-label)', fontWeight: 800, cursor: 'pointer' }}>Завершить игру</button>
            </div>
          </>
        )}
      </div>

      {mode === 'players' ? (
        <div style={{ marginTop: 18, marginBottom: 16, borderRadius: 32, overflow: 'hidden', border: `1px solid ${borderStrong}`, boxShadow: '0 20px 42px rgba(0,0,0,0.28)' }}>
          <div style={{ background: playerColor(current), color: '#000', padding: '18px 18px 20px' }}>
            <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 800, opacity: 0.68, marginBottom: 6 }}>сейчас ходит</div>
            <div key={player + turn} className="alias-word-in" style={{ fontSize: 'clamp(34px, 11vw, 62px)', fontWeight: 900, lineHeight: 0.95 }}>{player}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              <div style={{ padding: '8px 12px', borderRadius: 999, background: 'rgba(0,0,0,0.14)', fontSize: 'var(--fs-caption)', fontWeight: 800 }}>очки: {currentScore}</div>
              {ruleset === 'drink' && <div style={{ padding: '8px 12px', borderRadius: 999, background: 'rgba(0,0,0,0.14)', fontSize: 'var(--fs-caption)', fontWeight: 800 }}>пропуск без напитка: {currentPasses}</div>}
              <div style={{ padding: '8px 12px', borderRadius: 999, background: 'rgba(0,0,0,0.14)', fontSize: 'var(--fs-caption)', fontWeight: 800 }}>{randomOrder ? 'случайный ход' : 'по кругу'}</div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 38, marginBottom: 18 }}>
          <div style={{ width: 118, height: 118, borderRadius: 34, background: panelBg, border: `1px solid ${borderStrong}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#63B9FF', boxShadow: '0 20px 50px rgba(0,0,0,0.24)' }}><GlyphIcon name="cards" size={72} strokeWidth={1.35} /></div>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: 'clamp(24px, 7.5vw, 42px)', fontWeight: 900, textAlign: 'center', marginBottom: 10 }}>Что выбираешь?</div>
        <div style={{ fontSize: 'var(--fs-body)', color: textMuted, textAlign: 'center', maxWidth: 420, margin: '0 auto 24px', lineHeight: 1.5 }}>
          {ruleset === 'drink'
            ? 'Если игрок не готов выполнить задание или сказать правду, он может выпить. Один раз за игру можно пропустить без напитка.'
            : 'Выберите тип карточки или доверьтесь случайному выбору.'}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <button onClick={() => { haptic.tap(); draw('truth'); }} disabled={!truthsAvail} className="alias-btn-press" style={{ padding: '24px 0', borderRadius: 26, border: 'none', background: truthsAvail ? TRUTH.grad : panelBg, color: truthsAvail ? '#00121f' : textMuted, fontSize: 'var(--fs-title)', fontWeight: 900, cursor: truthsAvail ? 'pointer' : 'default', boxShadow: truthsAvail ? '0 18px 34px rgba(33,212,253,0.22)' : 'none' }}>Правда</button>
          <button onClick={() => { haptic.tap(); draw('dare'); }} disabled={!daresAvail} className="alias-btn-press" style={{ padding: '24px 0', borderRadius: 26, border: 'none', background: daresAvail ? DARE.grad : panelBg, color: daresAvail ? '#000' : textMuted, fontSize: 'var(--fs-title)', fontWeight: 900, cursor: daresAvail ? 'pointer' : 'default', boxShadow: daresAvail ? '0 18px 34px rgba(115,242,157,0.22)' : 'none' }}>Действие</button>
        </div>
        <button onClick={drawRandom} className="alias-btn-press" style={{ padding: '18px 0', borderRadius: 24, border: `1px solid ${borderSoft}`, background: panelBg, color: textMain, fontSize: 'var(--fs-label)', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <GlyphIcon name="dice" size={20} /> Случайно
        </button>
      </div>

      {mode === 'players' && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingTop: 8, paddingBottom: 'max(4px, env(safe-area-inset-bottom, 0px))' }}>
          {activeNames.map((name, index) => (
            <div key={name + index} style={{ flex: '0 0 auto', padding: '10px 12px', borderRadius: 999, background: index === current ? playerColor(index) : panelBg, color: index === current ? '#000' : '#fff', border: `1px solid ${index === current ? playerColor(index) : borderSoft}`, minWidth: 76, textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 800, whiteSpace: 'nowrap', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
              <div style={{ fontSize: 'var(--fs-snap10)', opacity: 0.75, marginTop: 2 }}>{scores[index] || 0} очк.</div>
            </div>
          ))}
        </div>
      )}

      {leaderboardModal}
      {exitModal}
    </div>
  );
}
