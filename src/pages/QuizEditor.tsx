import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { goBack } from '@/lib/nav';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { uploadMapPointPhoto } from '@/lib/storage';
import { haptic } from '@/lib/haptics';
import { toast } from '@/stores/toastStore';
import type { QuizQuestion } from '@/pages/MyQuizzes';

const AI_PROMPT = `Составь тест по материалу ниже. Верни СТРОГО один JSON без пояснений, без markdown и без \`\`\`:
{"title":"Короткое название теста","questions":[{"q":"Текст вопроса","options":["Вариант 1","Вариант 2","Вариант 3","Вариант 4"],"correct":0,"image":null}]}
Правила: 5–10 вопросов; ровно 4 варианта у каждого; "correct" — индекс правильного (0–3); всё на русском.

Материал:
<вставь сюда свой текст>`;

function parseAiAnswer(raw: string): { title: string; questions: QuizQuestion[] } {
  let t = raw.trim();
  // Срезаем ```json ... ``` и любой текст вокруг JSON
  t = t.replace(/```(json)?/gi, '');
  const a = t.indexOf('{'); const b = t.lastIndexOf('}');
  if (a === -1 || b === -1 || b <= a) throw new Error('В ответе не найден JSON');
  const obj = JSON.parse(t.slice(a, b + 1));
  const qs = Array.isArray(obj.questions) ? obj.questions : [];
  const questions: QuizQuestion[] = qs.map((q: any) => {
    const options = Array.isArray(q.options) ? q.options.map((o: any) => String(o)).slice(0, 6) : [];
    let correct = Number(q.correct);
    if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) correct = 0;
    return { q: String(q.q || '').trim(), options, correct, image: typeof q.image === 'string' ? q.image : null };
  }).filter((q: QuizQuestion) => q.q && q.options.length >= 2);
  if (questions.length === 0) throw new Error('Не найдено ни одного корректного вопроса');
  return { title: String(obj.title || '').trim(), questions };
}

export default function QuizEditor() {
  const nav = useNavigate();
  const { id } = useParams();
  const { user } = useAuthStore();
  const isEdit = !!id;

  const [title, setTitle] = useState('');
  const [raw, setRaw] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase.from('user_quizzes').select('*').eq('id', id).single().then(({ data, error }) => {
      if (error || !data) { toast.error('Тест не найден'); return; }
      setTitle(data.title || '');
      setQuestions((data.questions as QuizQuestion[]) || []);
    });
  }, [id]);

  const copyPrompt = async () => {
    try { await navigator.clipboard.writeText(AI_PROMPT); haptic.success(); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    catch { toast.error('Не удалось скопировать'); }
  };

  const build = () => {
    try {
      const { title: t, questions: qs } = parseAiAnswer(raw);
      setQuestions(qs);
      if (!title.trim() && t) setTitle(t);
      haptic.success();
      toast.success(`Собрано вопросов: ${qs.length}`);
    } catch (e: any) {
      toast.error(e?.message || 'Не удалось разобрать ответ');
    }
  };

  const pickImage = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file || !user) return;
    if (file.size > 8 * 1024 * 1024) { toast.error('Фото слишком большое (макс 8 МБ)'); return; }
    setUploadingIdx(idx);
    const { url, error } = await uploadMapPointPhoto(user.id, file);
    setUploadingIdx(null);
    if (error || !url) { toast.error('Не удалось загрузить фото'); return; }
    haptic.tap();
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, image: url } : q));
  };

  const save = async () => {
    if (!user || saving) return;
    if (!title.trim()) { toast.error('Введи название теста'); return; }
    if (questions.length === 0) { toast.error('Сначала собери вопросы из ответа нейросети'); return; }
    setSaving(true);
    const payload = { title: title.trim(), questions };
    const res = isEdit
      ? await supabase.from('user_quizzes').update(payload).eq('id', id!)
      : await supabase.from('user_quizzes').insert({ ...payload, owner: user.id });
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    haptic.success();
    toast.success(isEdit ? 'Тест обновлён' : 'Тест создан');
    nav('/quizzes', { replace: true });
  };

  const field: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'var(--surface-light)', border: '1.5px solid transparent', borderRadius: 14, padding: '13px 14px', fontSize: 'var(--fs-body)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' };

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'max(12px, env(safe-area-inset-top, 12px)) 16px 10px' }}>
        <button className="dt-hide" onClick={() => goBack(nav, '/quizzes')} style={{ background: 'var(--surface-light)', border: 'none', width: 36, height: 36, borderRadius: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', flexShrink: 0 }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h1 style={{ margin: 0, flex: 1, fontSize: 'var(--fs-title)', fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--text)' }}>{isEdit ? 'Редактор теста' : 'Новый тест'}</h1>
        <button onClick={save} disabled={saving} style={{ background: 'var(--text)', color: 'var(--bg)', border: 'none', borderRadius: 12, padding: '9px 16px', fontSize: 'var(--fs-label)', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.5 : 1, flexShrink: 0 }}>{saving ? '…' : 'Сохранить'}</button>
      </div>

      <div style={{ padding: '4px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Название теста" style={field} />

        {/* Шаг 1: промпт для нейросети */}
        <div style={{ background: 'var(--surface-2)', borderRadius: 16, padding: 14, boxShadow: 'var(--shadow-1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 26, height: 26, borderRadius: 13, background: 'var(--text)', color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-caption)', fontWeight: 800, flexShrink: 0 }}>1</span>
            <div style={{ flex: 1, fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text)' }}>Скопируй промпт</div>
            <button onClick={copyPrompt} style={{ display: 'flex', alignItems: 'center', gap: 7, background: copied ? 'var(--accent-soft)' : 'var(--surface-light)', color: copied ? 'var(--accent)' : 'var(--text)', border: 'none', borderRadius: 11, padding: '8px 13px', fontSize: 'var(--fs-caption)', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
              {copied
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
              {copied ? 'Скопирован' : 'Скопировать'}
            </button>
          </div>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>Вставь его в любую нейросеть (Claude, ChatGPT…), добавь свой материал вместо «вставь сюда свой текст» — она вернёт готовый JSON.</div>
        </div>

        {/* Шаг 2: вставка ответа */}
        <div style={{ background: 'var(--surface-2)', borderRadius: 16, padding: 14, boxShadow: 'var(--shadow-1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ width: 26, height: 26, borderRadius: 13, background: 'var(--text)', color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-caption)', fontWeight: 800, flexShrink: 0 }}>2</span>
            <div style={{ flex: 1, fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text)' }}>Вставь ответ нейросети</div>
          </div>
          <textarea value={raw} onChange={e => setRaw(e.target.value)} placeholder='{"title":"…","questions":[…]}' rows={5} style={{ ...field, resize: 'vertical', minHeight: 110, fontSize: 'var(--fs-label)', fontFamily: 'ui-monospace, monospace' }} />
          <button onClick={build} disabled={!raw.trim()} style={{ marginTop: 10, width: '100%', background: 'var(--text)', color: 'var(--bg)', border: 'none', borderRadius: 13, padding: 13, fontSize: 'var(--fs-label)', fontWeight: 700, cursor: 'pointer', opacity: raw.trim() ? 1 : 0.4 }}>Собрать тест</button>
        </div>

        {/* Шаг 3: превью вопросов */}
        {questions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: 12, boxShadow: 'var(--shadow-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, position: 'sticky', top: 0, zIndex: 1, background: 'var(--surface)', paddingBottom: 4 }}>
              <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>Вопросы <span style={{ color: 'var(--muted)', fontWeight: 600 }}>{questions.length}</span></div>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)' }}>Панель можно пролистывать</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 'min(58dvh, 640px)', overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', paddingRight: 4 }}>
            {questions.map((q, i) => (
              <div key={i} style={{ background: 'var(--surface-2)', borderRadius: 16, padding: 13, boxShadow: 'var(--shadow-1)' }}>
                {q.image && <img src={q.image} alt="" style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 12, marginBottom: 10 }} />}
                <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text)', lineHeight: 1.35 }}>{i + 1}. {q.q}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 9 }}>
                  {q.options.map((o, oi) => (
                    <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-label)', color: oi === q.correct ? 'var(--accent)' : 'var(--text2)', fontWeight: oi === q.correct ? 700 : 400 }}>
                      {oi === q.correct
                        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>
                        : <span style={{ width: 14, flexShrink: 0 }} />}
                      {o}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
                  <label style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: 'var(--surface-light)', borderRadius: 11, padding: '9px 0', fontSize: 'var(--fs-caption)', fontWeight: 600, color: 'var(--text2)', cursor: 'pointer' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                    {uploadingIdx === i ? 'Загрузка…' : (q.image ? 'Заменить фото' : 'Фото')}
                    <input type="file" accept="image/*" onChange={e => pickImage(i, e)} style={{ display: 'none' }} />
                  </label>
                  {q.image && (
                    <button onClick={() => setQuestions(prev => prev.map((x, xi) => xi === i ? { ...x, image: null } : x))} style={{ background: 'var(--surface-light)', border: 'none', borderRadius: 11, padding: '9px 12px', fontSize: 'var(--fs-caption)', fontWeight: 600, color: 'var(--text2)', cursor: 'pointer' }}>Убрать фото</button>
                  )}
                  <button onClick={() => setQuestions(prev => prev.filter((_, xi) => xi !== i))} aria-label="Удалить вопрос" style={{ background: 'rgba(239,68,68,0.10)', border: 'none', borderRadius: 11, padding: '9px 12px', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>
            ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
