import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useVocabSetsStore, type VocabSet, type VocabPair } from '@/stores/vocabSetsStore';
import { haptic } from '@/lib/haptics';
import { speak, hasVoiceFor, type SpeechLang } from '@/lib/speech';
import { triggerConfetti } from '@/lib/confetti';
import { GlyphIcon, normalizeGlyph } from '@/components/icons/AppGlyph';

function shuffle<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

export default function VocabSetStudy() {
  const nav = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { getSet } = useVocabSetsStore();
  const [set, setSet] = useState<VocabSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'cards' | 'quiz'>('cards');

  useEffect(() => {
    let alive = true;
    (async () => { const s = await getSet(id!); if (alive) { setSet(s); setLoading(false); } })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const canSpeak = !!set && hasVoiceFor(set.language);
  const say = (t: string) => { if (canSpeak && set) { haptic.tap(); speak(t, set.language as SpeechLang); } };

  const Header = (
    <header className="safe-top" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
      <button onClick={() => { haptic.tap(); nav(-1); }} style={{ width: 36, height: 36, borderRadius: 18, border: 'none', background: 'var(--surface-light)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 'var(--fw-semibold, 600)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 8 }}>{set ? <><GlyphIcon name={normalizeGlyph(set.emoji)} size={19} /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{set.title}</span></> : 'Набор'}</div>
    </header>
  );

  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>{Header}<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}><span className="anim-spin" style={{ display: 'inline-block', fontSize: 'var(--fs-snap24)' }}>↻</span></div></div>;
  if (!set || set.pairs.length === 0) return <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>{Header}<div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24, gap: 8 }}><div style={{ color: 'var(--muted)' }}><GlyphIcon name="folder" size={50} strokeWidth={1.4} /></div><div style={{ fontSize: 'var(--fs-snap16)', fontWeight: 600, color: 'var(--text)' }}>В наборе нет слов</div></div></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {Header}
      <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
        {([['cards', 'cards', 'Карточки'], ['quiz', 'checklist', 'Квиз']] as [typeof mode, string, string][]).map(([m, iconName, label]) => (
          <button key={m} onClick={() => { haptic.tap(); setMode(m); }} style={{
            flex: 1, padding: '8px 0', borderRadius: 10, cursor: 'pointer', fontSize: 'var(--fs-label)', fontWeight: 600,
            border: '1px solid', borderColor: mode === m ? 'var(--accent)' : 'var(--border)',
            background: mode === m ? 'var(--accent)' : 'var(--surface-light)', color: mode === m ? 'var(--bg)' : 'var(--text)',
          }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}><GlyphIcon name={iconName} size={15} />{label}</span></button>
        ))}
      </div>
      {mode === 'cards'
        ? <CardsMode key="c" pairs={set.pairs} canSpeak={canSpeak} say={say} />
        : <QuizMode key="q" pairs={set.pairs} canSpeak={canSpeak} say={say} />}
    </div>
  );
}

function CardsMode({ pairs, canSpeak, say }: { pairs: VocabPair[]; canSpeak: boolean; say: (t: string) => void }) {
  const deck = useMemo(() => shuffle(pairs), [pairs]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [knew, setKnew] = useState(0);
  const [done, setDone] = useState(false);
  const cur = deck[idx];

  const grade = (k: boolean) => {
    if (k) { setKnew(x => x + 1); haptic.success(); } else haptic.error();
    if (idx + 1 >= deck.length) setDone(true); else { setIdx(idx + 1); setFlipped(false); }
  };

  if (done) {
    const pct = Math.round((knew / deck.length) * 100);
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
        <div className="anim-bounce-in" style={{ marginBottom: 8, color: 'var(--accent)' }}><GlyphIcon name={pct >= 80 ? 'confetti' : pct >= 50 ? 'smile' : 'workout'} size={56} strokeWidth={1.5} /></div>
        <div style={{ fontSize: 'var(--fs-title)', fontWeight: 700, color: 'var(--text)' }}>Готово</div>
        <div style={{ fontSize: 48, fontWeight: 700, color: 'var(--accent)', marginTop: 12 }}>{knew}/{deck.length}</div>
        <button onClick={() => { haptic.tap(); setIdx(0); setFlipped(false); setKnew(0); setDone(false); }} className="alias-btn-press" style={{ marginTop: 18, padding: '12px 24px', borderRadius: 22, border: 'none', background: 'var(--accent)', color: 'var(--bg)', fontSize: 'var(--fs-body)', fontWeight: 700, cursor: 'pointer' }}>Заново</button>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 4, background: 'var(--surface-light)' }}><div style={{ height: '100%', width: `${(idx / deck.length) * 100}%`, background: 'var(--accent)', transition: 'width 0.3s' }} /></div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 16 }}>
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)' }}>{idx + 1} / {deck.length}</div>
        <div className="fc-scene" style={{ width: '100%', maxWidth: 420 }} onClick={() => { haptic.tap(); setFlipped(f => !f); }}>
          <div className={`fc-card ${flipped ? 'flipped' : ''}`} style={{ height: 'min(44vh, 300px)' }}>
            <div className="fc-face" style={{ position: 'absolute', inset: 0, borderRadius: 20, background: 'var(--surface-2)', boxShadow: 'var(--shadow-1)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 'clamp(26px, 7vw, 42px)', fontWeight: 800, color: 'var(--text)' }}>{cur.term}</div>
              {canSpeak && <button onClick={e => { e.stopPropagation(); say(cur.term); }} aria-label="Произнести" style={{ marginTop: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#3B82F6', fontSize: 'var(--fs-title)' }}><GlyphIcon name="speaker" size={22} /></button>}
              <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', marginTop: 12 }}>Нажми, чтобы перевернуть</div>
            </div>
            <div className="fc-face fc-back" style={{ position: 'absolute', inset: 0, borderRadius: 20, background: 'var(--surface-2)', boxShadow: 'var(--shadow-1)', border: '1px solid var(--accent)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 'clamp(22px, 6vw, 34px)', fontWeight: 800, color: 'var(--text)' }}>{cur.tr}</div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 16px 20px', paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))' }}>
        <button onClick={() => grade(false)} className="alias-btn-press" style={{ padding: '18px 0', borderRadius: 16, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.10)', color: '#EF4444', fontSize: 'var(--fs-heading)', fontWeight: 700, cursor: 'pointer' }}>Не знал</button>
        <button onClick={() => grade(true)} className="alias-btn-press" style={{ padding: '18px 0', borderRadius: 16, border: 'none', background: '#10B981', color: '#fff', fontSize: 'var(--fs-heading)', fontWeight: 700, cursor: 'pointer' }}>Знал</button>
      </div>
    </div>
  );
}

function QuizMode({ pairs, canSpeak, say }: { pairs: VocabPair[]; canSpeak: boolean; say: (t: string) => void }) {
  const questions = useMemo(() => {
    const allTr = pairs.map(p => p.tr);
    return shuffle(pairs).map(p => {
      const distractors = shuffle(allTr.filter(t => t !== p.tr)).slice(0, 3);
      return { term: p.term, answer: p.tr, options: shuffle([p.tr, ...distractors]) };
    });
  }, [pairs]);
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);
  const cur = questions[idx];
  const answered = chosen !== null;
  const wasCorrect = answered && chosen === cur.answer;

  const pick = (o: string) => {
    if (answered) return;
    setChosen(o);
    if (o === cur.answer) { setCorrect(c => c + 1); haptic.success(); } else haptic.error();
  };
  const next = () => {
    haptic.tap();
    if (idx + 1 >= questions.length) {
      setDone(true);
      if (correct + (wasCorrect ? 1 : 0) === questions.length) setTimeout(() => triggerConfetti({ count: 120, power: 12, duration: 2600 }), 200);
    } else { setIdx(idx + 1); setChosen(null); }
  };

  if (done) {
    const pct = Math.round((correct / questions.length) * 100);
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
        <div className="anim-bounce-in" style={{ marginBottom: 8, color: 'var(--accent)' }}><GlyphIcon name={pct >= 80 ? 'confetti' : pct >= 50 ? 'smile' : 'workout'} size={56} strokeWidth={1.5} /></div>
        <div style={{ fontSize: 'var(--fs-title)', fontWeight: 700, color: 'var(--text)' }}>Квиз пройден</div>
        <div style={{ fontSize: 48, fontWeight: 700, color: 'var(--accent)', marginTop: 12 }}>{correct}/{questions.length}</div>
        <button onClick={() => { haptic.tap(); setIdx(0); setChosen(null); setCorrect(0); setDone(false); }} className="alias-btn-press" style={{ marginTop: 18, padding: '12px 24px', borderRadius: 22, border: 'none', background: 'var(--accent)', color: 'var(--bg)', fontSize: 'var(--fs-body)', fontWeight: 700, cursor: 'pointer' }}>Заново</button>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 4, background: 'var(--surface-light)' }}><div style={{ height: '100%', width: `${(idx / questions.length) * 100}%`, background: 'var(--accent)', transition: 'width 0.3s' }} /></div>
      <div key={idx} className={`page-scroll lt-q ${answered ? (wasCorrect ? 'lt-correct' : 'lt-wrong') : ''}`} style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', textAlign: 'center', marginBottom: 8 }}>{idx + 1} / {questions.length} · выбери перевод</div>
        <div style={{ textAlign: 'center', fontSize: 30, fontWeight: 700, color: 'var(--text)', margin: '8px 0' }}>
          {cur.term}
          {canSpeak && <button onClick={() => say(cur.term)} aria-label="Произнести" style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#3B82F6', fontSize: 'var(--fs-title)', verticalAlign: 'middle' }}><GlyphIcon name="speaker" size={22} /></button>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          {cur.options.map((o, i) => {
            const isCorrect = o === cur.answer, isChosen = o === chosen;
            let bg = 'var(--surface-light)', border = '1px solid transparent', color = 'var(--text)';
            if (answered) {
              if (isCorrect) { bg = 'rgba(16,185,129,0.18)'; border = '1px solid #10B981'; color = '#10B981'; }
              else if (isChosen) { bg = 'rgba(239,68,68,0.15)'; border = '1px solid #EF4444'; color = '#EF4444'; }
              else color = 'var(--muted)';
            }
            return <button key={i} onClick={() => pick(o)} disabled={answered} className="tap-effect" style={{ background: bg, border, color, borderRadius: 12, padding: '14px 16px', fontSize: 'var(--fs-heading)', fontWeight: 600, cursor: answered ? 'default' : 'pointer', textAlign: 'left' }}>{o}</button>;
          })}
        </div>
      </div>
      <div style={{ padding: '0 16px 20px', paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))' }}>
        <button onClick={next} disabled={!answered} className="alias-btn-press" style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', background: answered ? 'var(--accent)' : 'var(--surface-light)', color: answered ? 'var(--bg)' : 'var(--muted)', fontSize: 'var(--fs-snap16)', fontWeight: 700, cursor: answered ? 'pointer' : 'default' }}>{idx + 1 >= questions.length ? 'Завершить' : 'Дальше'}</button>
      </div>
    </div>
  );
}
