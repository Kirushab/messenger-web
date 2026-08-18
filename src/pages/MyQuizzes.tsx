import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { goBack } from '@/lib/nav';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { haptic } from '@/lib/haptics';
import { toast } from '@/stores/toastStore';

export interface QuizQuestion { q: string; options: string[]; correct: number; image?: string | null }
export interface UserQuiz { id: string; owner: string; title: string; questions: QuizQuestion[]; created_at: string }

export default function MyQuizzes() {
  const nav = useNavigate();
  const { user } = useAuthStore();
  const [quizzes, setQuizzes] = useState<UserQuiz[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data, error } = await supabase.from('user_quizzes').select('*').eq('owner', user.id).order('created_at', { ascending: false });
    if (error) { toast.error('Не удалось загрузить тесты'); }
    setQuizzes((data as UserQuiz[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user?.id]);

  const remove = async (q: UserQuiz) => {
    if (!confirm(`Удалить тест «${q.title}»?`)) return;
    const { error } = await supabase.from('user_quizzes').delete().eq('id', q.id);
    if (error) { toast.error(error.message); return; }
    haptic.success();
    setQuizzes(prev => prev.filter(x => x.id !== q.id));
  };

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'max(12px, env(safe-area-inset-top, 12px)) 16px 10px' }}>
        <button className="dt-hide" onClick={() => goBack(nav, '/languages')} style={{ background: 'var(--surface-light)', border: 'none', width: 36, height: 36, borderRadius: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', flexShrink: 0 }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h1 style={{ margin: 0, flex: 1, fontSize: 'var(--fs-title)', fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--text)' }}>Мои тесты</h1>
        <button onClick={() => { haptic.tap(); nav('/quizzes/new'); }} aria-label="Создать тест" style={{ width: 36, height: 36, borderRadius: 18, background: 'var(--text)', color: 'var(--bg)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>

      <div style={{ padding: '6px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && [0, 1, 2].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 76, borderRadius: 16 }} />)}

        {!loading && quizzes.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '64px 24px', textAlign: 'center' }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--muted)', opacity: 0.6 }}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 12l2 2 4-4"/></svg>
            <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 700, color: 'var(--text)' }}>Пока нет тестов</div>
            <div style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', maxWidth: 280 }}>Скорми нейросети любой текст — и собери из её ответа тест за минуту</div>
            <button onClick={() => nav('/quizzes/new')} style={{ marginTop: 6, background: 'var(--text)', color: 'var(--bg)', border: 'none', borderRadius: 14, padding: '13px 22px', fontSize: 'var(--fs-label)', fontWeight: 700, cursor: 'pointer' }}>Создать тест</button>
          </div>
        )}

        {quizzes.map(q => (
          <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface-2)', borderRadius: 16, padding: 12, boxShadow: 'var(--shadow-1)' }}>
            <button onClick={() => { haptic.tap(); nav('/quizzes/' + q.id); }} style={{ width: 44, height: 44, borderRadius: 22, background: 'var(--text)', color: 'var(--bg)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} aria-label="Пройти">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l2 2 4-4"/><path d="M9 3h6l1 2h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2l1-2Z"/></svg>
            </button>
            <div onClick={() => nav('/quizzes/' + q.id)} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
              <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.title}</div>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 2 }}>{q.questions.length} вопр. · {new Date(q.created_at).toLocaleDateString('ru-RU')}</div>
            </div>
            <button onClick={() => nav('/quizzes/' + q.id + '/edit')} aria-label="Редактировать" style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface-light)', border: 'none', color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
            </button>
            <button onClick={() => remove(q)} aria-label="Удалить" style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(239,68,68,0.10)', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
