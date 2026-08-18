import { useEffect, useMemo, useState } from 'react';
import { haptic } from '@/lib/haptics';
import { useNavigate, useParams } from 'react-router-dom';
import { useGrammarStore, type GrammarItem, type GrammarKind, type GrammarLeaderRow } from '@/stores/grammarStore';
import { triggerConfetti } from '@/lib/confetti';
import { SkeletonCourseCard } from '@/components/Skeleton';
import { supabase } from '@/lib/supabase';

const TOTAL = 12;

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

interface Q { item: GrammarItem; options: string[]; }

function buildSession(items: GrammarItem[]): Q[] {
  if (items.length === 0) return [];
  const byTopic = new Map<string, GrammarItem[]>();
  for (const it of items) {
    if (!byTopic.has(it.topic)) byTopic.set(it.topic, []);
    byTopic.get(it.topic)!.push(it);
  }
  const picked = shuffle(items).slice(0, Math.min(TOTAL, items.length));
  return picked.map(item => {
    let options: string[];
    if (item.options && item.options.length >= 2) {
      options = item.options;
    } else {
      // строим из ответов той же topic-группы
      const pool = (byTopic.get(item.topic) || [])
        .map(i => i.answer)
        .filter(a => a !== item.answer);
      const distractors = shuffle(Array.from(new Set(pool))).slice(0, 3);
      options = [item.answer, ...distractors];
    }
    return { item, options: shuffle(options) };
  });
}

export default function GrammarTrainer() {
  const nav = useNavigate();
  const { lang } = useParams<{ lang: string }>();
  const language = lang || 'it';
  const { loadGrammar, loadGrammarProgress, saveGrammarResult, progress, loadGrammarLeaderboard, leaderboard, loadGrammarKinds, availableKinds } = useGrammarStore();

  const [kind, setKind] = useState<GrammarKind>('conjugation');
  const [items, setItems] = useState<GrammarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState(0);

  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [showRef, setShowRef] = useState(false);
  const [showLb, setShowLb] = useState(false);
  const [lessonFor, setLessonFor] = useState<GrammarKind | null>(null);

  useEffect(() => { loadGrammarProgress(language); loadGrammarKinds(language); }, [language]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadGrammar(language, kind).then(res => {
      if (!alive) return;
      setItems(res);
      setLoading(false);
      setIdx(0); setChosen(null); setCorrectCount(0); setFinished(false);
    });
    return () => { alive = false; };
  }, [language, kind, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const session = useMemo(() => buildSession(items), [items, sessionId]);
  const total = session.length;
  const current = session[idx];

  const pick = (opt: string) => {
    if (chosen || !current) return;
    setChosen(opt);
    if (opt === current.item.answer) { setCorrectCount(c => c + 1); haptic.success(); }
    else haptic.error();
  };

  const next = () => {
    if (!current) return;
    const ni = idx + 1;
    if (ni >= total) {
      setFinished(true);
      saveGrammarResult(language, kind, correctCount, total);
      if (correctCount === total && total > 0) {
        setTimeout(() => triggerConfetti({ count: 120, power: 12, duration: 2600 }), 300);
      }
    } else {
      setIdx(ni); setChosen(null);
    }
  };

  const restart = () => setSessionId(s => s + 1);

  const TOPICS: { kind: GrammarKind; label: string }[] = [
    { kind: 'conjugation', label: 'Настоящее' },
    { kind: 'past', label: 'Прошедшее' },
    { kind: 'participle', label: 'Причастия' },
    { kind: 'imperfetto', label: 'Imperfetto' },
    { kind: 'futuro', label: 'Будущее' },
    { kind: 'condizionale', label: 'Условное' },
    { kind: 'congiuntivo', label: 'Сослагат.' },
    { kind: 'imperativo', label: 'Повелит.' },
    { kind: 'modal', label: 'Модальные' },
    { kind: 'reflexive', label: 'Возвратные' },
    { kind: 'pronoun', label: 'Местоимения' },
    { kind: 'cine', label: 'ci / ne' },
    { kind: 'relative', label: 'Относит.' },
    { kind: 'comparative', label: 'Сравнения' },
    { kind: 'plural', label: 'Мн. число' },
    { kind: 'adjective', label: 'Прилагательные' },
    { kind: 'preposition', label: 'Предлоги' },
    { kind: 'possessive', label: 'Притяжательные' },
    { kind: 'article', label: 'Артикли' },
  ];
  const HINTS: Record<string, string> = {
    conjugation: 'Выбери правильную форму глагола',
    past: 'Выбери вспомогательный глагол (essere / avere)',
    participle: 'Выбери правильное причастие (participio passato)',
    imperfetto: 'Выбери форму прошедшего (imperfetto)',
    futuro: 'Выбери форму будущего времени',
    condizionale: 'Выбери форму условного наклонения',
    congiuntivo: 'Выбери форму сослагательного (congiuntivo)',
    imperativo: 'Выбери форму повелительного наклонения',
    modal: 'Выбери правильную форму модального глагола',
    reflexive: 'Выбери возвратное местоимение',
    pronoun: 'Выбери местоимение-дополнение',
    cine: 'Выбери правильную частицу/местоимение',
    relative: 'Выбери относительное слово (che / cui / chi)',
    comparative: 'Выбери правильное слово для сравнения',
    plural: 'Выбери форму множественного числа',
    adjective: 'Выбери правильную форму прилагательного',
    preposition: 'Выбери правильный предлог',
    possessive: 'Выбери правильную притяжательную форму',
    article: 'Выбери правильный артикль',
  };
  const HINTS_EN: Record<string, string> = {
    conjugation: 'Выбери правильную форму глагола (Present Simple)',
    past: 'Выбери форму прошедшего времени (Past Simple)',
    futuro: 'Выбери форму будущего времени (will)',
    article: 'Выбери правильный артикль (a / an / the)',
  };
  const HINTS_ES: Record<string, string> = {
    conjugation: 'Выбери форму глагола (presente)',
    past: 'Выбери форму прошедшего (pretérito)',
    futuro: 'Выбери форму будущего (futuro)',
    article: 'Выбери артикль (el / la / los / las)',
  };
  const HINTS_DE: Record<string, string> = {
    conjugation: 'Выбери форму глагола (Präsens)',
    past: 'Выбери вспомогательный глагол (haben / sein)',
    article: 'Выбери артикль (der / die / das)',
  };
  const HINTS_FR: Record<string, string> = {
    conjugation: 'Выбери форму глагола (présent)',
    past: 'Выбери вспомогательный глагол (avoir / être)',
    article: 'Выбери артикль (le / la / les)',
  };
  const HINT_MAPS: Record<string, Record<string, string>> = { en: HINTS_EN, es: HINTS_ES, de: HINTS_DE, fr: HINTS_FR, it: HINTS };

  const visibleTopics = availableKinds.length ? TOPICS.filter(t => availableKinds.includes(t.kind)) : TOPICS;
  useEffect(() => {
    if (availableKinds.length && !availableKinds.includes(kind)) {
      const first = TOPICS.find(t => availableKinds.includes(t.kind));
      if (first) setKind(first.kind);
    }
  }, [availableKinds]); // eslint-disable-line react-hooks/exhaustive-deps

  const KindTabs = (
    <div style={{ display: 'flex', gap: 8, padding: '10px 16px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      {visibleTopics.map(({ kind: k, label }) => {
        const pr = progress[k];
        const mastered = pr && pr.best_total > 0 && pr.best_correct === pr.best_total;
        const tried = pr && pr.attempts > 0;
        return (
        <button key={k} onClick={() => { if (k !== kind) setKind(k); }} style={{
          flexShrink: 0, padding: '8px 14px', borderRadius: 20, cursor: 'pointer',
          border: '1px solid var(--border)',
          background: kind === k ? 'var(--accent)' : 'var(--surface-light)',
          color: kind === k ? 'var(--bg)' : 'var(--text)',
          fontSize: 'var(--fs-label)', fontWeight: 600, whiteSpace: 'nowrap',
        }}>{mastered ? '✓ ' : tried ? '• ' : ''}{label}</button>
        );
      })}
    </div>
  );

  const Header = (
    <>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 12px', borderBottom: '1px solid var(--border)',
    }}>
      <button onClick={() => nav(`/languages/${language}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 'var(--fs-title)', padding: 0 }}>‹</button>
      <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text)' }}>Грамматика</div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        {!loading && total > 0 && !finished && (
          <span style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)' }}>{idx + 1} / {total}</span>
        )}
        <button onClick={() => { setShowLb(true); loadGrammarLeaderboard(language); }} style={{ background: 'var(--surface-light)', border: '1px solid var(--border)', borderRadius: 16, padding: '5px 11px', cursor: 'pointer', color: 'var(--text)', fontSize: 'var(--fs-label)', fontWeight: 600 }}>🏆</button>
        <button onClick={() => setShowRef(true)} style={{ background: 'var(--surface-light)', border: '1px solid var(--border)', borderRadius: 16, padding: '5px 11px', cursor: 'pointer', color: 'var(--text)', fontSize: 'var(--fs-label)', fontWeight: 600 }}>📖</button>
      </div>
    </div>
    {showRef && <GrammarReference onClose={() => setShowRef(false)} />}
    {showLb && <GrammarLeaderboard rows={leaderboard} onClose={() => setShowLb(false)} />}
    </>
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {Header}{KindTabs}
        <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}><SkeletonCourseCard /><SkeletonCourseCard /><SkeletonCourseCard /><SkeletonCourseCard /></div>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {Header}{KindTabs}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
          Для этого раздела пока нет заданий.
        </div>
      </div>
    );
  }

  if (finished) {
    const pct = Math.round((correctCount / total) * 100);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 20 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <div className="anim-bounce-in" style={{ fontSize: 56, marginBottom: 8 }}>
            {pct === 100 ? '🎉' : pct >= 80 ? '👏' : pct >= 60 ? '👍' : '💪'}
          </div>
          <h2 style={{ margin: 0, fontSize: 'var(--fs-title)', color: 'var(--text)' }}>
            {pct === 100 ? 'Идеально!' : pct >= 80 ? 'Отлично!' : pct >= 60 ? 'Хорошо' : 'Тренируйся!'}
          </h2>
          <div style={{ fontSize: 48, fontWeight: 700, color: 'var(--accent)', marginTop: 16 }}>{correctCount}/{total}</div>
          {progress[kind] && progress[kind].best_total > 0 && (
            <div style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', marginTop: 8 }}>
              Лучший результат: {progress[kind].best_correct}/{progress[kind].best_total}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => nav(`/languages/${language}`)} style={{ flex: 1, padding: 14, background: 'var(--surface-light)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 'var(--fs-body)', fontWeight: 600, cursor: 'pointer' }}>В курс</button>
          <button onClick={restart} style={{ flex: 1, padding: 14, background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 10, fontSize: 'var(--fs-body)', fontWeight: 600, cursor: 'pointer' }}>Ещё раз</button>
        </div>
      </div>
    );
  }

  // Мини-урок перед практикой темы: примеры из реальных заданий + объяснения.
  if (lessonFor !== kind) {
    const withEx = items.filter(i => i.explain_ru);
    const examples = (withEx.length >= 1 ? withEx : items).slice(0, 3);
    const hint = HINT_MAPS[language]?.[kind] || HINTS[kind] || 'Выбери правильный вариант';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {Header}
        {KindTabs}
        <div className="page-scroll" style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
          <div style={{ maxWidth: 480, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-display)', flexShrink: 0 }}>📘</div>
              <div>
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Мини-урок</div>
                <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 700, color: 'var(--text)' }}>{hint}</div>
              </div>
            </div>
            <div style={{ fontSize: 'var(--fs-snap14)', color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5 }}>Посмотри примеры, потом потренируйся. Полный справочник — по кнопке 📖 вверху.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
              {examples.map((it, i) => (
                <div key={i} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text)' }}>{it.prompt}</span>
                    <span style={{ color: 'var(--muted)' }}>→</span>
                    <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--accent)' }}>{it.answer}</span>
                  </div>
                  {it.explain_ru && <div style={{ fontSize: 'var(--fs-snap14)', color: 'var(--muted)', marginTop: 6 }}>{it.explain_ru}</div>}
                </div>
              ))}
            </div>
            <button onClick={() => { haptic.tap(); setLessonFor(kind); }} style={{ width: '100%', padding: 14, background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 12, fontSize: 'var(--fs-body)', fontWeight: 700, cursor: 'pointer' }}>Начать тренировку</button>
          </div>
        </div>
      </div>
    );
  }

  const answered = chosen !== null;
  const isCorrect = answered && chosen === current.item.answer;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {Header}
      {KindTabs}
      <div style={{ height: 4, background: 'var(--surface-light)' }}>
        <div style={{ height: '100%', width: `${(idx / total) * 100}%`, background: 'var(--accent)', transition: 'width 0.3s' }} />
      </div>

      <div key={idx} className={`page-scroll lt-q ${answered ? (isCorrect ? 'lt-correct' : 'lt-wrong') : ''}`} style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', textAlign: 'center', marginBottom: 6 }}>
          {HINT_MAPS[language]?.[kind] || HINTS[kind] || 'Выбери правильный вариант'}
        </div>
        <div style={{ textAlign: 'center', fontSize: 30, fontWeight: 700, color: 'var(--text)', margin: '10px 0 4px' }}>{current.item.prompt}</div>
        {current.item.prompt_ru && (
          <div style={{ textAlign: 'center', fontSize: 'var(--fs-snap14)', color: 'var(--muted)', marginBottom: 18 }}>{current.item.prompt_ru}</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          {current.options.map((opt, i) => {
            const isThisCorrect = opt === current.item.answer;
            const isChosen = opt === chosen;
            let bg = 'var(--surface-light)', border = '1px solid transparent', color = 'var(--text)';
            if (answered) {
              if (isThisCorrect) { bg = 'rgba(16,185,129,0.18)'; border = '1px solid #10B981'; color = '#10B981'; }
              else if (isChosen) { bg = 'rgba(239,68,68,0.15)'; border = '1px solid #EF4444'; color = '#EF4444'; }
              else { color = 'var(--muted)'; }
            }
            return (
              <button key={i} onClick={() => pick(opt)} disabled={answered} className="tap-effect" style={{
                background: bg, border, color, borderRadius: 12, padding: '14px 16px',
                fontSize: 'var(--fs-heading)', fontWeight: 600, cursor: answered ? 'default' : 'pointer',
                transition: 'all 0.15s',
              }}>{opt}</button>
            );
          })}
        </div>

        {answered && (
          <div style={{
            marginTop: 16, padding: 12, borderRadius: 10,
            background: isCorrect ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.10)',
            color: 'var(--text)', fontSize: 'var(--fs-snap14)',
          }}>
            <div style={{ fontWeight: 700, color: isCorrect ? '#10B981' : '#EF4444', marginBottom: current.item.explain_ru ? 4 : 0 }}>
              {isCorrect ? 'Верно!' : `Правильно: ${current.item.answer}`}
            </div>
            {current.item.explain_ru && <div style={{ color: 'var(--muted)' }}>{current.item.explain_ru}</div>}
          </div>
        )}
      </div>

      <div style={{ padding: '0 16px 20px', paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))' }}>
        <button onClick={() => { haptic.tap(); next(); }} disabled={!answered} className="alias-btn-press" style={{
          width: '100%', padding: 16, borderRadius: 12, border: 'none',
          background: answered ? 'var(--accent)' : 'var(--surface-light)',
          color: answered ? 'var(--bg)' : 'var(--muted)',
          fontSize: 'var(--fs-snap16)', fontWeight: 700, cursor: answered ? 'pointer' : 'default',
        }}>{idx + 1 >= total ? 'Завершить' : 'Дальше'}</button>
      </div>
    </div>
  );
}

// ===== Справочник грамматики (статичная теория, без прогресса) =====
const PRONOUNS = ['io', 'tu', 'lui/lei', 'noi', 'voi', 'loro'];

function ConjTable({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 'var(--fs-snap14)', fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{title}</div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        {rows.map(([p, f], i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 12px', background: i % 2 ? 'transparent' : 'var(--surface-light)', fontSize: 'var(--fs-snap14)' }}>
            <span style={{ color: 'var(--muted)' }}>{p}</span>
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{f}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function zip(forms: string[]): [string, string][] {
  return PRONOUNS.map((p, i) => [p, forms[i]] as [string, string]);
}

function GrammarReference({ onClose }: { onClose: () => void }) {
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 800, color: 'var(--accent)', marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 'var(--fs-snap16)', fontWeight: 700, color: 'var(--text)' }}>📖 Справочник</div>
        <button onClick={onClose} style={{ marginLeft: 'auto', background: 'var(--surface-light)', border: '1px solid var(--border)', borderRadius: 16, padding: '6px 14px', cursor: 'pointer', color: 'var(--text)', fontSize: 'var(--fs-snap14)', fontWeight: 600 }}>Закрыть</button>
      </div>
      <div className="page-scroll" style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        <Section title="Настоящее время (presente)">
          <ConjTable title="essere (быть)" rows={zip(['sono', 'sei', 'è', 'siamo', 'siete', 'sono'])} />
          <ConjTable title="avere (иметь)" rows={zip(['ho', 'hai', 'ha', 'abbiamo', 'avete', 'hanno'])} />
          <ConjTable title="-are (parlare)" rows={zip(['parlo', 'parli', 'parla', 'parliamo', 'parlate', 'parlano'])} />
          <ConjTable title="-ere (prendere)" rows={zip(['prendo', 'prendi', 'prende', 'prendiamo', 'prendete', 'prendono'])} />
          <ConjTable title="-ire (dormire)" rows={zip(['dormo', 'dormi', 'dorme', 'dormiamo', 'dormite', 'dormono'])} />
          <ConjTable title="-ire тип -isco (capire)" rows={zip(['capisco', 'capisci', 'capisce', 'capiamo', 'capite', 'capiscono'])} />
        </Section>

        <Section title="Модальные глаголы">
          <ConjTable title="potere (мочь)" rows={zip(['posso', 'puoi', 'può', 'possiamo', 'potete', 'possono'])} />
          <ConjTable title="volere (хотеть)" rows={zip(['voglio', 'vuoi', 'vuole', 'vogliamo', 'volete', 'vogliono'])} />
          <ConjTable title="dovere (быть должным)" rows={zip(['devo', 'devi', 'deve', 'dobbiamo', 'dovete', 'devono'])} />
        </Section>

        <Section title="Прошедшее (passato prossimo)">
          <div style={{ fontSize: 'var(--fs-snap14)', color: 'var(--text)', lineHeight: 1.5, marginBottom: 10 }}>
            Образуется: <b>avere/essere</b> (в наст. времени) + причастие.<br />
            • Большинство глаголов → <b>avere</b> (ho mangiato).<br />
            • Движение/состояние/возвратные → <b>essere</b>, причастие согласуется: andato/andata/andati/andate.
          </div>
          <ConjTable title="Причастия (искл.)" rows={[['fare', 'fatto'], ['vedere', 'visto'], ['leggere', 'letto'], ['scrivere', 'scritto'], ['prendere', 'preso'], ['venire', 'venuto']]} />
        </Section>

        <Section title="Imperfetto (-are / -ere / -ire)">
          <ConjTable title="parlare" rows={zip(['parlavo', 'parlavi', 'parlava', 'parlavamo', 'parlavate', 'parlavano'])} />
          <ConjTable title="essere (искл.)" rows={zip(['ero', 'eri', 'era', 'eravamo', 'eravate', 'erano'])} />
        </Section>

        <Section title="Будущее (futuro semplice)">
          <ConjTable title="parlare" rows={zip(['parlerò', 'parlerai', 'parlerà', 'parleremo', 'parlerete', 'parleranno'])} />
          <ConjTable title="essere" rows={zip(['sarò', 'sarai', 'sarà', 'saremo', 'sarete', 'saranno'])} />
          <ConjTable title="avere" rows={zip(['avrò', 'avrai', 'avrà', 'avremo', 'avrete', 'avranno'])} />
        </Section>

        <Section title="Условное (condizionale)">
          <ConjTable title="parlare" rows={zip(['parlerei', 'parleresti', 'parlerebbe', 'parleremmo', 'parlereste', 'parlerebbero'])} />
          <ConjTable title="volere (vorrei…)" rows={zip(['vorrei', 'vorresti', 'vorrebbe', 'vorremmo', 'vorreste', 'vorrebbero'])} />
        </Section>

        <Section title="Артикли">
          <div style={{ fontSize: 'var(--fs-snap14)', color: 'var(--text)', lineHeight: 1.6 }}>
            <b>Определённый:</b> il (м., согл.), lo (м., s+согл./z), l’ (перед гласной), la (ж., согл.).<br />
            Мн.: i (м.), gli (м., гласн./s+согл./z), le (ж.).<br />
            <b>Неопределённый:</b> un (м.), uno (м., s+согл./z), una (ж.), un’ (ж., гласн.).
          </div>
        </Section>

        <Section title="Множественное число">
          <ConjTable title="Окончания" rows={[['-o', '-i (libro→libri)'], ['-a (ж.)', '-e (casa→case)'], ['-e', '-i (cane→cani)'], ['-co/-go', '-chi/-ghi'], ['-io', '-i (figlio→figli)'], ['искл.', 'uomo→uomini']]} />
        </Section>

        <Section title="Сравнения">
          <div style={{ fontSize: 'var(--fs-snap14)', color: 'var(--text)', lineHeight: 1.6 }}>
            più … <b>di</b> — больше, чем (перед именем): <i>Marco è più alto di Luca.</i><br />
            più … <b>che</b> — между двумя элементами при одном глаголе.<br />
            <b>come / quanto</b> — равенство.<br />
            <b>il più …</b> — превосходная степень.
          </div>
        </Section>

        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}

// ===== Лидерборд грамматики =====
function GrammarLeaderboard({ rows, onClose }: { rows: GrammarLeaderRow[]; onClose: () => void }) {
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(r => setUid(r.data.user?.id ?? null)); }, []);

  const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`);
  const myIndex = uid ? rows.findIndex(r => r.user_id === uid) : -1;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 'var(--fs-snap16)', fontWeight: 700, color: 'var(--text)' }}>🏆 Рейтинг грамматики</div>
        <button onClick={onClose} style={{ marginLeft: 'auto', background: 'var(--surface-light)', border: '1px solid var(--border)', borderRadius: 16, padding: '6px 14px', cursor: 'pointer', color: 'var(--text)', fontSize: 'var(--fs-snap14)', fontWeight: 600 }}>Закрыть</button>
      </div>
      <div style={{ padding: '10px 16px 0', fontSize: 'var(--fs-caption)', color: 'var(--muted)' }}>Сортировка: сколько тем пройдено на 100%, затем сумма верных ответов.</div>
      <div className="page-scroll" style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {rows.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 30 }}>Пока никто не проходил грамматику. Будь первым!</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((r, i) => {
              const me = r.user_id === uid;
              const initial = (r.display_name || '?').trim().charAt(0).toUpperCase();
              return (
                <div key={r.user_id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12,
                  background: me ? 'rgba(168,85,247,0.15)' : 'var(--surface-light)',
                  border: me ? '1px solid rgba(168,85,247,0.4)' : '1px solid transparent',
                }}>
                  <div style={{ width: 28, textAlign: 'center', fontSize: i < 3 ? 20 : 14, fontWeight: 700, color: 'var(--muted)', flexShrink: 0 }}>{medal(i)}</div>
                  {r.avatar_url
                    ? <img src={r.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: 18, objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 36, height: 36, borderRadius: 18, background: 'var(--accent)', color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-snap16)', fontWeight: 700, flexShrink: 0 }}>{initial}</div>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--fs-snap14)', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.display_name}{me ? ' (ты)' : ''}</div>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)' }}>{r.total_correct} верных ответов</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 'var(--fs-snap16)', fontWeight: 700, color: 'var(--accent)' }}>{r.mastered}</div>
                    <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)' }}>тем 100%</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {uid && myIndex === -1 && rows.length > 0 && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--fs-label)', marginTop: 14 }}>
            Тебя ещё нет в топ-50 — пройди темы на 100%, чтобы попасть в рейтинг.
          </div>
        )}
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}
