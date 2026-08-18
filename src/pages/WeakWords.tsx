import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { triggerConfetti } from '@/lib/confetti';
import { SkeletonCourseCard } from '@/components/Skeleton';
import { haptic } from '@/lib/haptics';
import { GlyphIcon } from '@/components/icons/AppGlyph';

const TOTAL = 15;

function shuffle<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

interface Q { wordId: string; prompt: string; answer: string; options: string[]; level: number; wrong: number; }

export default function WeakWords() {
  const nav = useNavigate();
  const { lang } = useParams<{ lang: string }>();
  const language = lang || 'it';

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const uid = (await supabase.auth.getUser()).data.user?.id;
      if (!uid) { if (alive) { setQuestions([]); setLoading(false); } return; }

      // слова языка → карта id→{word,translation}
      const { data: courses } = await supabase.from('language_courses').select('id').eq('language', language);
      const courseIds = (courses || []).map((c: any) => c.id);
      const wordMap = new Map<string, { word: string; tr: string }>();
      const pool: string[] = [];
      if (courseIds.length) {
        const { data: words } = await supabase.from('language_words')
          .select('id, word, translation_ru').in('course_id', courseIds);
        for (const w of (words || []) as any[]) {
          wordMap.set(w.id, { word: w.word, tr: w.translation_ru });
          if (w.translation_ru) pool.push(w.translation_ru);
        }
      }

      // память пользователя
      const { data: mem } = await supabase.from('user_word_memory')
        .select('word_id, level, wrong_count, correct_count').eq('user_id', uid);

      const weak = (mem || [] as any[])
        .filter((m: any) => wordMap.has(m.word_id))
        .filter((m: any) => m.wrong_count > 0 || m.level <= 1)
        .sort((a: any, b: any) => (b.wrong_count - a.wrong_count) || (a.level - b.level));

      const picked = shuffle(weak.slice(0, Math.max(TOTAL * 2, 20))).slice(0, TOTAL);
      const qs: Q[] = picked.map((m: any) => {
        const w = wordMap.get(m.word_id)!;
        const distract = shuffle(pool.filter(t => t !== w.tr)).slice(0, 3);
        return { wordId: m.word_id, prompt: w.word, answer: w.tr, options: shuffle([w.tr, ...distract]), level: m.level, wrong: m.wrong_count };
      });

      if (!alive) return;
      setQuestions(qs);
      setLoading(false);
      setIdx(0); setChosen(null); setCorrect(0); setFinished(false);
    })();
    return () => { alive = false; };
  }, [language]);

  const total = questions.length;
  const cur = questions[idx];

  const pick = async (o: string) => {
    if (chosen || !cur) return;
    setChosen(o);
    const ok = o === cur.answer;
    if (ok) { setCorrect(c => c + 1); haptic.success(); }
    else haptic.error();
    // пишем ответ обратно в интервальное повторение
    try { await supabase.rpc('record_word_answer', { word_id_param: cur.wordId, correct_param: ok }); } catch { /* ignore */ }
  };

  const next = () => {
    if (idx + 1 >= total) {
      setFinished(true);
      const pct = total ? Math.round((correct / total) * 100) : 0;
      if (pct === 100) setTimeout(() => triggerConfetti({ count: 130, power: 12, duration: 2600 }), 300);
    } else { setIdx(idx + 1); setChosen(null); }
  };

  const Header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 12px', borderBottom: '1px solid var(--border)' }}>
      <button onClick={() => nav(`/languages/${language}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 'var(--fs-title)', padding: 0 }}>‹</button>
      <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}><GlyphIcon name="random" size={18} />Слабые слова</div>
      {!loading && total > 0 && !finished && <div style={{ marginLeft: 'auto', fontSize: 'var(--fs-label)', color: 'var(--muted)' }}>{idx + 1} / {total}</div>}
    </div>
  );

  if (loading) return (<div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>{Header}<div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}><SkeletonCourseCard /><SkeletonCourseCard /><SkeletonCourseCard /><SkeletonCourseCard /></div></div>);

  if (total === 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>{Header}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24, gap: 8 }}>
        <div style={{ color: 'var(--accent)' }}><GlyphIcon name="confetti" size={50} strokeWidth={1.4} /></div>
        <div style={{ fontSize: 'var(--fs-snap16)', fontWeight: 600, color: 'var(--text)' }}>Слабых слов нет!</div>
        <div style={{ fontSize: 'var(--fs-snap14)', color: 'var(--muted)', maxWidth: 280 }}>Позанимайся темами в курсе — слова, в которых ошибёшься, появятся здесь для повторения.</div>
        <button onClick={() => nav(`/languages/${language}`)} style={{ marginTop: 12, padding: '12px 20px', background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 10, fontSize: 'var(--fs-body)', fontWeight: 600, cursor: 'pointer' }}>В курс</button>
      </div>
    </div>
  );

  if (finished) {
    const pct = Math.round((correct / total) * 100);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 20 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <div className="anim-bounce-in" style={{ marginBottom: 8, color: 'var(--accent)' }}><GlyphIcon name={pct === 100 ? 'confetti' : pct >= 70 ? 'smile' : 'workout'} size={56} strokeWidth={1.5} /></div>
          <h2 style={{ margin: 0, fontSize: 'var(--fs-title)', color: 'var(--text)' }}>Повторено!</h2>
          <div style={{ fontSize: 48, fontWeight: 700, color: 'var(--accent)', marginTop: 14 }}>{correct}/{total}</div>
          <div style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', marginTop: 8, maxWidth: 280 }}>Результаты учтены в интервальном повторении.</div>
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
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', textAlign: 'center', marginBottom: 8 }}>Перевод?{cur.wrong > 0 ? ` · ошибок: ${cur.wrong}` : ''}</div>
        <div style={{ textAlign: 'center', fontSize: 30, fontWeight: 700, color: 'var(--text)', margin: '8px 0 18px' }}>{cur.prompt}</div>
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
