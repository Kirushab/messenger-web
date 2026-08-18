import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { goBack } from '@/lib/nav';
import { supabase } from '@/lib/supabase';
import { haptic } from '@/lib/haptics';
import { toast } from '@/stores/toastStore';
import type { QuizQuestion, UserQuiz } from '@/pages/MyQuizzes';

export default function QuizPlay() {
  const nav = useNavigate();
  const { id } = useParams();
  const [quiz, setQuiz] = useState<UserQuiz | null>(null);
  const [i, setI] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase.from('user_quizzes').select('*').eq('id', id).single().then(({ data, error }) => {
      if (error || !data) { toast.error('Тест не найден'); goBack(nav, '/quizzes'); return; }
      setQuiz(data as UserQuiz);
    });
  }, [id]);

  const q: QuizQuestion | undefined = quiz?.questions[i];
  const total = quiz?.questions.length || 0;

  const pick = (oi: number) => {
    if (chosen != null || !q) return;
    setChosen(oi);
    if (oi === q.correct) { setScore(s => s + 1); haptic.success(); }
    else haptic.select();
  };

  const next = () => {
    if (i + 1 >= total) { setDone(true); haptic.success(); }
    else { setI(i + 1); setChosen(null); }
  };

  const restart = () => { setI(0); setChosen(null); setScore(0); setDone(false); };

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'max(12px, env(safe-area-inset-top, 12px)) 16px 8px' }}>
        <button onClick={() => goBack(nav, '/quizzes')} style={{ background: 'var(--surface-light)', border: 'none', width: 36, height: 36, borderRadius: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', flexShrink: 0 }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{quiz?.title || 'Тест'}</div>
          {!done && total > 0 && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)' }}>Вопрос {i + 1} из {total}</div>}
        </div>
      </div>

      {/* Прогресс */}
      {!done && total > 0 && (
        <div style={{ margin: '2px 16px 14px', height: 5, background: 'var(--surface-light)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${((i + (chosen != null ? 1 : 0)) / total) * 100}%`, height: '100%', background: 'var(--accent)', transition: 'width .35s cubic-bezier(0.22,1,0.36,1)' }} />
        </div>
      )}

      {!quiz && <div style={{ padding: 16 }}><div className="skeleton-shimmer" style={{ height: 220, borderRadius: 18 }} /></div>}

      {quiz && !done && q && (
        <div key={i} className="page-fade-in" style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
          {q.image && <img src={q.image} alt="" style={{ width: '100%', maxHeight: 210, objectFit: 'cover', borderRadius: 16 }} />}
          <div style={{ fontSize: 'var(--fs-title)', fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, letterSpacing: '-0.2px' }}>{q.q}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 4 }}>
            {q.options.map((o, oi) => {
              const isCorrect = chosen != null && oi === q.correct;
              const isWrongPick = chosen === oi && oi !== q.correct;
              return (
                <button key={oi} onClick={() => pick(oi)} style={{
                  textAlign: 'left', padding: '14px 15px', borderRadius: 14, cursor: chosen == null ? 'pointer' : 'default',
                  border: '1.5px solid ' + (isCorrect ? 'var(--accent)' : isWrongPick ? 'var(--danger)' : 'transparent'),
                  background: isCorrect ? 'var(--accent-soft)' : isWrongPick ? 'rgba(239,68,68,0.10)' : 'var(--surface-light)',
                  color: isCorrect ? 'var(--accent)' : isWrongPick ? 'var(--danger)' : 'var(--text)',
                  fontSize: 'var(--fs-body)', fontWeight: isCorrect ? 700 : 500,
                  transition: 'background .18s ease, border-color .18s ease',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ flex: 1 }}>{o}</span>
                  {isCorrect && <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>}
                  {isWrongPick && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{ flexShrink: 0 }}><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>}
                </button>
              );
            })}
          </div>
          {chosen != null && (
            <button onClick={next} style={{ marginTop: 'auto', background: 'var(--text)', color: 'var(--bg)', border: 'none', borderRadius: 14, padding: 15, fontSize: 'var(--fs-body)', fontWeight: 700, cursor: 'pointer' }}>
              {i + 1 >= total ? 'Результат' : 'Дальше'}
            </button>
          )}
        </div>
      )}

      {quiz && done && (
        <div className="page-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '0 24px', textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: 28, background: score / total >= 0.8 ? 'var(--accent)' : 'var(--surface-light)', color: score / total >= 0.8 ? '#fff' : 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-card)' }}><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 6.8H22l-6 4.4 2.3 6.8L12 15.8 5.7 20 8 13.2 2 8.8h7.6L12 2Z"/></svg></div>
          <div style={{ fontSize: 'var(--fs-display)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>{score} из {total}</div>
          <div style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)' }}>{score / total >= 0.8 ? 'Отличный результат!' : score / total >= 0.5 ? 'Неплохо — можно закрепить' : 'Стоит повторить материал'}</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button onClick={restart} style={{ background: 'var(--surface-light)', color: 'var(--text)', border: 'none', borderRadius: 13, padding: '13px 18px', fontSize: 'var(--fs-label)', fontWeight: 700, cursor: 'pointer' }}>Ещё раз</button>
            <button onClick={() => nav('/quizzes', { replace: true })} style={{ background: 'var(--text)', color: 'var(--bg)', border: 'none', borderRadius: 13, padding: '13px 18px', fontSize: 'var(--fs-label)', fontWeight: 700, cursor: 'pointer' }}>К тестам</button>
          </div>
        </div>
      )}
    </div>
  );
}
