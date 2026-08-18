import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { goBack } from '@/lib/nav';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguagesStore, type Language } from '@/stores/languagesStore';
import { supabase } from '@/lib/supabase';
import { haptic } from '@/lib/haptics';
import { GlyphIcon } from '@/components/icons/AppGlyph';
import { triggerConfetti } from '@/lib/confetti';

const IcoPractice: ReactNode = (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="7" x2="7" y2="17"/><line x1="4" y1="9.5" x2="4" y2="14.5"/><line x1="17" y1="7" x2="17" y2="17"/><line x1="20" y1="9.5" x2="20" y2="14.5"/><line x1="7" y1="12" x2="17" y2="12"/></svg>);
const IcoMatch: ReactNode = (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>);
const IcoBuild: ReactNode = (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>);

interface W { id: string; word: string; tr: string; }

function shuffle<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

export default function PracticeGames() {
  const nav = useNavigate();
  const { lang } = useParams<{ lang: string }>();
  const language = (lang as Language) || 'en';
  const { loadCourses } = useLanguagesStore();
  const [words, setWords] = useState<W[]>([]);
  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState<'menu' | 'match' | 'build'>('menu');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      await loadCourses();
      const ids = useLanguagesStore.getState().courses.filter(c => c.language === language).map(c => c.id);
      if (!ids.length) { if (alive) { setWords([]); setLoading(false); } return; }
      const { data } = await supabase.from('language_words').select('id, word, translation_ru').in('course_id', ids);
      const list = ((data || []) as any[]).filter(x => x.word && x.translation_ru).map(x => ({ id: x.id, word: x.word, tr: x.translation_ru }));
      if (alive) { setWords(list); setLoading(false); }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const Header = (title: string, onBack: () => void, icon?: ReactNode) => (
    <header className="safe-top" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
      <button onClick={() => { haptic.tap(); onBack(); }} style={{ width: 36, height: 36, borderRadius: 18, border: 'none', background: 'var(--surface-light)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 'var(--fw-semibold, 600)', display: 'flex', alignItems: 'center', gap: 8 }}>{icon}{title}</div>
    </header>
  );

  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>{Header('Тренировки', () => goBack(nav, '/languages'), IcoPractice)}<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}><span className="anim-spin" style={{ display: 'inline-block', fontSize: 'var(--fs-snap24)' }}>↻</span></div></div>;

  if (words.length < 4) return <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>{Header('Тренировки', () => goBack(nav, '/languages'), IcoPractice)}<div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24, gap: 8 }}><div style={{ fontSize: 50 }}>🌱</div><div style={{ fontSize: 'var(--fs-snap16)', fontWeight: 600, color: 'var(--text)' }}>Маловато слов</div><div style={{ fontSize: 'var(--fs-snap14)', color: 'var(--muted)', maxWidth: 280 }}>Пройди несколько тем в курсе — и тренировки откроются.</div></div></div>;

  if (game === 'match') return <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>{Header('Соедини пары', () => setGame('menu'), IcoMatch)}<MatchPairs words={words} /></div>;
  if (game === 'build') return <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>{Header('Собери слово', () => setGame('menu'), IcoBuild)}<WordBuild words={words} /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {Header('Тренировки', () => goBack(nav, '/languages'), IcoPractice)}
      <div className="page-scroll" style={{ padding: 16 }}>
        <div className="edu-cascade" style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <GameCard icon={IcoMatch} title="Соедини пары" desc="Сопоставь слова и переводы на скорость" onClick={() => { haptic.tap(); setGame('match'); }} />
          <GameCard icon={IcoBuild} title="Собери слово" desc="Составь слово из перемешанных букв по переводу" onClick={() => { haptic.tap(); setGame('build'); }} />
        </div>
      </div>
    </div>
  );
}

function GameCard({ icon, title, desc, onClick }: { icon: ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="tap-effect edu-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface-2)', boxShadow: 'var(--shadow-1)', cursor: 'pointer', textAlign: 'left' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--surface-light)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text)' }}>{title}</div>
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 2 }}>{desc}</div>
      </div>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
    </button>
  );
}

// ===== Соедини пары =====
function MatchPairs({ words }: { words: W[] }) {
  const PER = 5;
  const rounds = useMemo(() => {
    const pool = shuffle(words);
    const out: W[][] = [];
    for (let i = 0; i + 1 < pool.length && out.length < 6; i += PER) out.push(pool.slice(i, i + PER));
    return out.filter(r => r.length >= 2);
  }, [words]);

  const [round, setRound] = useState(0);
  const cur = rounds[round] || [];
  const left = useMemo(() => shuffle(cur), [cur]);
  const right = useMemo(() => shuffle(cur), [cur]);
  const [selL, setSelL] = useState<string | null>(null);
  const [selR, setSelR] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  const tryMatch = (l: string | null, r: string | null) => {
    if (!l || !r) return;
    if (l === r) {
      const nm = new Set(matched); nm.add(l); setMatched(nm); haptic.success();
      setSelL(null); setSelR(null);
      if (nm.size >= cur.length) {
        if (round + 1 >= rounds.length) { setTimeout(() => { setFinished(true); triggerConfetti({ count: 90, power: 11, duration: 2200 }); }, 350); }
      }
    } else {
      haptic.error(); setWrong(l + '|' + r);
      setTimeout(() => { setWrong(null); setSelL(null); setSelR(null); }, 550);
    }
  };

  const pickL = (id: string) => { if (matched.has(id) || wrong) return; haptic.tap(); setSelL(id); tryMatch(id, selR); };
  const pickR = (id: string) => { if (matched.has(id) || wrong) return; haptic.tap(); setSelR(id); tryMatch(selL, id); };

  const nextRound = () => { haptic.tap(); setRound(r => r + 1); setMatched(new Set()); setSelL(null); setSelR(null); };
  const restart = () => { haptic.tap(); setRound(0); setMatched(new Set()); setSelL(null); setSelR(null); setFinished(false); };

  if (finished) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
      <div className="anim-bounce-in" style={{ marginBottom: 8, color: 'var(--accent)' }}><GlyphIcon name="confetti" size={56} strokeWidth={1.5} /></div>
      <div style={{ fontSize: 'var(--fs-title)', fontWeight: 700, color: 'var(--text)' }}>Все пары собраны!</div>
      <button onClick={restart} className="alias-btn-press" style={{ marginTop: 18, padding: '12px 24px', borderRadius: 22, border: 'none', background: 'var(--accent)', color: 'var(--bg)', fontSize: 'var(--fs-body)', fontWeight: 700, cursor: 'pointer' }}>Ещё раз</button>
    </div>
  );

  const roundDone = matched.size >= cur.length && cur.length > 0;
  const cell = (id: string, label: string, side: 'l' | 'r') => {
    const isMatched = matched.has(id);
    const isSel = (side === 'l' ? selL : selR) === id;
    const isWrong = wrong ? wrong.split('|')[side === 'l' ? 0 : 1] === id : false;
    let bg = 'var(--surface-light)', bd = '1px solid var(--border)', col = 'var(--text)';
    if (isMatched) { bg = 'rgba(16,185,129,0.14)'; bd = '1px solid rgba(16,185,129,0.4)'; col = '#10B981'; }
    else if (isWrong) { bg = 'rgba(239,68,68,0.15)'; bd = '1px solid #EF4444'; col = '#EF4444'; }
    else if (isSel) { bg = 'rgba(59,130,246,0.15)'; bd = '1px solid #3B82F6'; col = '#3B82F6'; }
    return (
      <button key={id + side} onClick={() => side === 'l' ? pickL(id) : pickR(id)} disabled={isMatched}
        className={isWrong ? 'lt-wrong' : ''}
        style={{ padding: '14px 10px', borderRadius: 12, border: bd, background: bg, color: col, fontSize: 'var(--fs-snap14)', fontWeight: 600, cursor: isMatched ? 'default' : 'pointer', opacity: isMatched ? 0.7 : 1, transition: 'background .15s', minHeight: 52 }}>
        {label}
      </button>
    );
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16, overflow: 'hidden' }}>
      <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', textAlign: 'center', marginBottom: 12 }}>Раунд {round + 1} / {rounds.length} · нажми слово и его перевод</div>
      <div className="page-scroll" style={{ flex: 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxWidth: 480, margin: '0 auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{left.map(p => cell(p.id, p.word, 'l'))}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{right.map(p => cell(p.id, p.tr, 'r'))}</div>
        </div>
      </div>
      {roundDone && round + 1 < rounds.length && (
        <button onClick={nextRound} className="alias-btn-press" style={{ marginTop: 12, width: '100%', padding: 14, borderRadius: 12, border: 'none', background: 'var(--accent)', color: 'var(--bg)', fontSize: 'var(--fs-body)', fontWeight: 700, cursor: 'pointer' }}>Следующий раунд</button>
      )}
    </div>
  );
}

// ===== Собери слово =====
function WordBuild({ words }: { words: W[] }) {
  const deck = useMemo(() => shuffle(words.filter(w => /^[\p{L}]{2,12}$/u.test(w.word))).slice(0, 10), [words]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number[]>([]); // индексы плиток
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(false);
  const [done, setDone] = useState(false);
  const cur = deck[idx];

  const tiles = useMemo(() => cur ? shuffle(cur.word.split('').map((ch, i) => ({ ch, i }))) : [], [cur]);

  if (!cur || deck.length === 0) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24, gap: 8 }}>
      <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{opacity:0.5}}><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 15V9l2.5 4L12 9v6"/><path d="M15.5 15v-6h2a1.8 1.8 0 0 1 0 3.6h-2"/></svg>
      <div style={{ fontSize: 'var(--fs-snap16)', fontWeight: 600, color: 'var(--text)' }}>Нет подходящих слов</div>
      <div style={{ fontSize: 'var(--fs-snap14)', color: 'var(--muted)', maxWidth: 280 }}>Для этой игры нужны односложные слова без пробелов.</div>
    </div>
  );

  if (done) {
    const pct = Math.round((correct / deck.length) * 100);
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
        <div className="anim-bounce-in" style={{ marginBottom: 8, color: 'var(--accent)' }}><GlyphIcon name={pct >= 80 ? 'confetti' : pct >= 50 ? 'smile' : 'workout'} size={56} strokeWidth={1.5} /></div>
        <div style={{ fontSize: 'var(--fs-title)', fontWeight: 700, color: 'var(--text)' }}>Готово</div>
        <div style={{ fontSize: 48, fontWeight: 700, color: 'var(--accent)', marginTop: 12 }}>{correct}/{deck.length}</div>
        <button onClick={() => { haptic.tap(); setIdx(0); setPicked([]); setCorrect(0); setDone(false); }} className="alias-btn-press" style={{ marginTop: 18, padding: '12px 24px', borderRadius: 22, border: 'none', background: 'var(--accent)', color: 'var(--bg)', fontSize: 'var(--fs-body)', fontWeight: 700, cursor: 'pointer' }}>Заново</button>
      </div>
    );
  }

  const built = picked.map(pi => tiles.find(t => t.i === pi)?.ch || '').join('');
  const usedSet = new Set(picked);

  const tap = (ti: number) => {
    if (usedSet.has(ti) || wrong) return;
    haptic.tap();
    const np = [...picked, ti];
    setPicked(np);
    if (np.length === cur.word.length) {
      const guess = np.map(pi => tiles.find(t => t.i === pi)?.ch || '').join('');
      if (guess.toLowerCase() === cur.word.toLowerCase()) {
        haptic.success(); setCorrect(c => c + 1);
        setTimeout(() => { if (idx + 1 >= deck.length) setDone(true); else { setIdx(idx + 1); setPicked([]); } }, 500);
      } else {
        haptic.error(); setWrong(true);
        setTimeout(() => { setWrong(false); setPicked([]); }, 600);
      }
    }
  };
  const backspace = () => { if (wrong) return; haptic.tap(); setPicked(p => p.slice(0, -1)); };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16 }}>
      <div style={{ height: 4, background: 'var(--surface-light)', borderRadius: 2, marginBottom: 16 }}><div style={{ height: '100%', width: `${(idx / deck.length) * 100}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.3s' }} /></div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Собери слово</div>
          <div style={{ fontSize: 'var(--fs-title)', fontWeight: 700, color: 'var(--text)' }}>{cur.tr}</div>
        </div>

        {/* собранное слово */}
        <div className={wrong ? 'lt-wrong' : ''} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', minHeight: 52 }}>
          {Array.from({ length: cur.word.length }).map((_, i) => (
            <div key={i} style={{ width: 40, height: 48, borderRadius: 10, border: '2px solid', borderColor: built[i] ? (wrong ? '#EF4444' : 'var(--accent)') : 'var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-title)', fontWeight: 700, color: wrong ? '#EF4444' : 'var(--text)' }}>{built[i] || ''}</div>
          ))}
        </div>

        {/* плитки букв */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 360 }}>
          {tiles.map(t => (
            <button key={t.i} onClick={() => tap(t.i)} disabled={usedSet.has(t.i)} className="tap-effect" style={{ width: 44, height: 52, borderRadius: 10, border: '1px solid var(--border)', background: usedSet.has(t.i) ? 'var(--surface)' : 'var(--surface-light)', color: usedSet.has(t.i) ? 'var(--border)' : 'var(--text)', fontSize: 'var(--fs-heading)', fontWeight: 700, cursor: usedSet.has(t.i) ? 'default' : 'pointer' }}>{t.ch}</button>
          ))}
        </div>
      </div>

      <button onClick={backspace} disabled={picked.length === 0} style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-light)', color: picked.length ? 'var(--text)' : 'var(--muted)', fontSize: 'var(--fs-body)', fontWeight: 600, cursor: picked.length ? 'pointer' : 'default' }}>⌫ Стереть</button>
    </div>
  );
}
