import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { triggerConfetti } from '@/lib/confetti';
import { SkeletonCourseCard } from '@/components/Skeleton';
import { haptic } from '@/lib/haptics';

const PASS = 75; // порог сдачи, %
const TOTAL = 15;

function shuffle<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

interface Q { prompt: string; promptRu?: string | null; answer: string; options: string[]; tag: string; }

export default function LevelTest() {
  const nav = useNavigate();
  const { lang, level } = useParams<{ lang: string; level: string }>();
  const language = lang || 'it';
  const lvl = level || 'A1';

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);
  const [best, setBest] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      // лучший результат
      const uid = (await supabase.auth.getUser()).data.user?.id;
      if (uid) {
        const { data: r } = await supabase.from('level_test_results')
          .select('best_pct').eq('user_id', uid).eq('language', language).eq('level', lvl).maybeSingle();
        if (alive && r) setBest(r.best_pct);
      }
      // слова уровня
      const { data: courses } = await supabase.from('language_courses')
        .select('id').eq('language', language).eq('level', lvl);
      const ids = (courses || []).map((c: any) => c.id);
      let words: { word: string; translation_ru: string }[] = [];
      if (ids.length) {
        const { data: w } = await supabase.from('language_words')
          .select('word, translation_ru').in('course_id', ids);
        words = (w || []) as any[];
      }
      // грамматика языка (для it)
      const { data: g } = await supabase.from('grammar_items')
        .select('prompt, prompt_ru, answer, options, topic, kind').eq('language', language);
      const grammar = (g || []) as any[];

      const pool = words.map(w => w.translation_ru).filter(Boolean);
      const wordQ: Q[] = shuffle(words).slice(0, Math.ceil(TOTAL * 0.7)).map(w => {
        const distract = shuffle(pool.filter(t => t !== w.translation_ru)).slice(0, 3);
        return { prompt: w.word, promptRu: 'Перевод?', answer: w.translation_ru, options: shuffle([w.translation_ru, ...distract]), tag: 'слово' };
      });

      const byTopic = new Map<string, any[]>();
      for (const it of grammar) { if (!byTopic.has(it.topic)) byTopic.set(it.topic, []); byTopic.get(it.topic)!.push(it); }
      const grammarQ: Q[] = shuffle(grammar).slice(0, TOTAL - wordQ.length).map(it => {
        let options: string[];
        if (it.options && it.options.length >= 2) options = it.options;
        else {
          const sib = (byTopic.get(it.topic) || []).map((s: any) => s.answer).filter((a: string) => a !== it.answer);
          options = [it.answer, ...shuffle(Array.from(new Set(sib))).slice(0, 3)];
        }
        return { prompt: it.prompt, promptRu: it.prompt_ru, answer: it.answer, options: shuffle(options), tag: 'грамматика' };
      });

      const all = shuffle([...wordQ, ...grammarQ]).slice(0, TOTAL);
      if (!alive) return;
      setQuestions(all);
      setLoading(false);
      setIdx(0); setChosen(null); setCorrect(0); setFinished(false);
    })();
    return () => { alive = false; };
  }, [language, lvl]);

  const total = questions.length;
  const cur = questions[idx];

  const pick = (o: string) => {
    if (chosen || !cur) return;
    setChosen(o);
    if (o === cur.answer) { setCorrect(c => c + 1); haptic.success(); }
    else haptic.error();
  };

  const saveResult = async (pct: number) => {
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return;
    const newBest = best == null ? pct : Math.max(best, pct);
    setBest(newBest);
    await supabase.from('level_test_results').upsert({
      user_id: uid, language, level: lvl,
      best_pct: newBest, passed: newBest >= PASS, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,language,level' });
  };

  const next = () => {
    if (idx + 1 >= total) {
      setFinished(true);
      const pct = total ? Math.round((correct / total) * 100) : 0;
      saveResult(pct);
      if (pct >= PASS) setTimeout(() => triggerConfetti({ count: 140, power: 13, duration: 2800 }), 300);
    } else { setIdx(idx + 1); setChosen(null); }
  };

  const Header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 12px', borderBottom: '1px solid var(--border)' }}>
      <button onClick={() => nav(`/languages/${language}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 'var(--fs-title)', padding: 0 }}>‹</button>
      <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text)' }}>Тест уровня {lvl}</div>
      {!loading && total > 0 && !finished && <div style={{ marginLeft: 'auto', fontSize: 'var(--fs-label)', color: 'var(--muted)' }}>{idx + 1} / {total}</div>}
    </div>
  );

  if (loading) return (<div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>{Header}<div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}><SkeletonCourseCard /><SkeletonCourseCard /><SkeletonCourseCard /><SkeletonCourseCard /></div></div>);

  if (total === 0) return (<div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>{Header}<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24, color: 'var(--muted)' }}>Для уровня {lvl} пока нет материала для теста.</div></div>);

  if (finished) {
    const pct = Math.round((correct / total) * 100);
    const passed = pct >= PASS;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 20 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <div className="anim-bounce-in" style={{ fontSize: 60, marginBottom: 8 }}>{passed ? '🎓' : '📚'}</div>
          <h2 style={{ margin: 0, fontSize: 'var(--fs-title)', color: 'var(--text)' }}>{passed ? `Уровень ${lvl} сдан!` : 'Почти получилось'}</h2>
          <div style={{ fontSize: 48, fontWeight: 800, color: passed ? '#10B981' : 'var(--accent)', marginTop: 14 }}>{pct}%</div>
          <div style={{ fontSize: 'var(--fs-snap14)', color: 'var(--muted)', marginTop: 6 }}>{correct} из {total} верно · порог {PASS}%</div>
          {best != null && <div style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', marginTop: 8 }}>Лучший результат: {best}%</div>}
          {!passed && <div style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', marginTop: 10, maxWidth: 280 }}>Повтори слова и грамматику уровня и попробуй снова.</div>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => nav(`/languages/${language}`)} style={{ flex: 1, padding: 14, background: 'var(--surface-light)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 'var(--fs-body)', fontWeight: 600, cursor: 'pointer' }}>В курс</button>
          <button onClick={() => { setIdx(0); setChosen(null); setCorrect(0); setFinished(false); setQuestions(q => shuffle(q)); }} style={{ flex: 1, padding: 14, background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 10, fontSize: 'var(--fs-body)', fontWeight: 600, cursor: 'pointer' }}>Ещё раз</button>
        </div>
      </div>
    );
  }

  const answered = chosen !== null;
  const wasCorrect = answered && chosen === cur.answer;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {Header}
      <div style={{ height: 4, background: 'var(--surface-light)' }}><div style={{ height: '100%', width: `${(idx / total) * 100}%`, background: 'var(--accent)', transition: 'width 0.3s' }} /></div>
      <div key={idx} className={`page-scroll lt-q ${answered ? (wasCorrect ? 'lt-correct' : 'lt-wrong') : ''}`} style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>{cur.tag}</div>
        <div style={{ textAlign: 'center', fontSize: 28, fontWeight: 700, color: 'var(--text)', margin: '6px 0 2px' }}>{cur.prompt}</div>
        {cur.promptRu && <div style={{ textAlign: 'center', fontSize: 'var(--fs-snap14)', color: 'var(--muted)', marginBottom: 16 }}>{cur.promptRu}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          {cur.options.map((o, i) => {
            const isCorrect = o === cur.answer, isChosen = o === chosen;
            let bg = 'var(--surface-light)', border = '1px solid transparent', color = 'var(--text)';
            if (answered) {
              if (isCorrect) { bg = 'rgba(16,185,129,0.18)'; border = '1px solid #10B981'; color = '#10B981'; }
              else if (isChosen) { bg = 'rgba(239,68,68,0.15)'; border = '1px solid #EF4444'; color = '#EF4444'; }
              else color = 'var(--muted)';
            }
            return <button key={i} onClick={() => pick(o)} disabled={answered} className="tap-effect" style={{ background: bg, border, color, borderRadius: 12, padding: '14px 16px', fontSize: 'var(--fs-heading)', fontWeight: 600, cursor: answered ? 'default' : 'pointer' }}>{o}</button>;
          })}
        </div>
      </div>
      <div style={{ padding: '0 16px 20px', paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))' }}>
        <button onClick={() => { haptic.tap(); next(); }} disabled={!answered} className="alias-btn-press" style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', background: answered ? 'var(--accent)' : 'var(--surface-light)', color: answered ? 'var(--bg)' : 'var(--muted)', fontSize: 'var(--fs-snap16)', fontWeight: 700, cursor: answered ? 'pointer' : 'default' }}>{idx + 1 >= total ? 'Завершить' : 'Дальше'}</button>
      </div>
    </div>
  );
}
