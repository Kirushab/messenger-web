import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { triggerConfetti } from '@/lib/confetti';
import { useAuthStore } from '@/stores/authStore';
import { hasFlag } from '@/lib/featureFlags';
import {
  GMAT_QUESTIONS, PASSAGES, SECTION_META, GMAT_PASS,
  DIFF_META,
  type GmatQuestion, type GmatSection, type GmatTable, type GmatChart,
} from '@/data/gmatQuestions';

const LS_BEST = 'gmat_best_pct';
const LS_BEST_SECTIONS = 'gmat_best_sections';
const LS_HISTORY = 'gmat_history';
const LS_MISTAKES = 'gmat_mistakes';
const SECONDS_PER_Q = 120; // ~2 мин на вопрос (как на GMAT Focus)
// Примерная шкала GMAT Focus: раздел 60–90, итог 205–805 (с шагом 10).
// Кривая слегка вогнутая (рост точности сильнее влияет в середине, как на адаптивном тесте).
function sectionScaled(pct: number): number {
  const v = 60 + 30 * Math.pow(Math.max(0, Math.min(100, pct)) / 100, 0.85);
  return Math.round(Math.min(90, Math.max(60, v)));
}
function totalFromSections(scores: number[]): number {
  const sum = scores.reduce((a, b) => a + b, 0); // 3 раздела × 60..90 → 180..270
  const raw = 205 + ((sum - 180) / 90) * 600;     // 180→205, 270→805
  return Math.min(805, Math.max(205, Math.round(raw / 10) * 10));
}
function computeFocus(questions: GmatQuestion[], answers: Record<string, number>) {
  const defs = [
    { key: 'quant', label: 'Quant', match: (sec: GmatSection) => sec === 'quant' },
    { key: 'verbal', label: 'Verbal', match: (sec: GmatSection) => sec === 'verbal' },
    { key: 'di', label: 'Data Insights', match: (sec: GmatSection) => sec === 'di' || sec === 'ds' },
  ];
  const focus = defs.map(d => {
    const qs = questions.filter(q => d.match(q.section));
    const fp = qs.length ? Math.round((qs.filter(q => answers[q.id] === q.answer).length / qs.length) * 100) : 0;
    return { key: d.key, label: d.label, n: qs.length, scaled: sectionScaled(fp) };
  }).filter(f => f.n > 0);
  const fullScore = focus.length === 3 ? totalFromSections(focus.map(f => f.scaled)) : null;
  return { focus, fullScore };
}
function fmtTime(s: number): string {
  const m = Math.floor(s / 60), ss = s % 60;
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

function shuffle<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}
const passageById = (id?: string) => (id ? PASSAGES.find(p => p.id === id) : undefined);

type Mode = 'full' | GmatSection;
type Attempt = { ts: number; mode: Mode; exam: boolean; pct: number; correct: number; total: number; score: number | null; qids?: string[]; ans?: Record<string, number>; secs?: number; times?: Record<string, number> };
const MODES: { id: Mode; title: string; desc: string; emoji: string; n: number }[] = [
  { id: 'full',   title: 'Полный тест',      desc: 'Quant · Verbal · Data Sufficiency · Data Insights', emoji: '🎓', n: GMAT_QUESTIONS.length },
  { id: 'quant',  title: 'Quant',            desc: 'Арифметика, алгебра, проценты, задачи', emoji: '🔢', n: GMAT_QUESTIONS.filter(q => q.section === 'quant').length },
  { id: 'verbal', title: 'Verbal',           desc: 'Critical Reasoning · Sentence Correction · Reading', emoji: '📖', n: GMAT_QUESTIONS.filter(q => q.section === 'verbal').length },
  { id: 'ds',     title: 'Data Sufficiency', desc: 'Хватает ли данных, чтобы ответить', emoji: '🧩', n: GMAT_QUESTIONS.filter(q => q.section === 'ds').length },
  { id: 'di',     title: 'Data Insights',    desc: 'Таблицы, источники, графики', emoji: '📊', n: GMAT_QUESTIONS.filter(q => q.section === 'di').length },
];

function scoreLabel(pct: number): string {
  if (pct >= 90) return 'Отличный результат — уровень топовых программ';
  if (pct >= GMAT_PASS) return 'Хороший результат — порог пройден';
  if (pct >= 50) return 'Есть база, но нужно подтянуть';
  return 'Стоит разобрать темы и попробовать снова';
}


// ===== Интерактивная таблица (Table Analysis) =====
function DataTable({ table }: { table: GmatTable }) {
  const [sort, setSort] = useState<{ c: number; dir: number } | null>(null);
  const rows = sort
    ? [...table.rows].sort((a, b) => {
        const x = a[sort.c], y = b[sort.c];
        if (typeof x === 'number' && typeof y === 'number') return (x - y) * sort.dir;
        return String(x) < String(y) ? -sort.dir : String(x) > String(y) ? sort.dir : 0;
      })
    : table.rows;
  const onSort = (c: number) => setSort(prev => (prev && prev.c === c ? { c, dir: -prev.dir } : { c, dir: 1 }));
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {table.columns.map((col, c) => (
              <th key={c} onClick={() => onSort(c)} style={{ textAlign: c === 0 ? 'left' : 'right', padding: '7px 8px', fontSize: 'var(--fs-caption)', fontWeight: 700, color: sort?.c === c ? 'var(--accent)' : 'var(--text2)', cursor: 'pointer', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)', userSelect: 'none' }}>
                {col} <span style={{ fontSize: 'var(--fs-micro)' }}>{sort?.c === c ? (sort.dir > 0 ? '▲' : '▼') : '↕'}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} style={{ borderBottom: ri < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
              {r.map((cell, ci) => (
                <td key={ci} style={{ textAlign: ci === 0 ? 'left' : 'right', padding: '7px 8px', fontSize: 'var(--fs-snap14)', color: sort?.c === ci ? 'var(--accent)' : ci === 0 ? 'var(--text)' : 'var(--text2)', fontWeight: ci === 0 || sort?.c === ci ? 700 : 400, whiteSpace: 'nowrap' }}>
                  {typeof cell === 'number' ? cell.toLocaleString('ru-RU') : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {table.note && <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', marginTop: 6 }}>{table.note}</div>}
    </div>
  );
}

// ===== График (Graphics Interpretation) =====
function DataChart({ chart }: { chart: GmatChart }) {
  const { kind, labels, values, unit } = chart;
  const max = Math.max(...values, 0) || 1;
  const ACC = 'var(--accent)', AX = 'rgba(255,255,255,0.06)', LBL = 'var(--text2)';
  const svgStyle = { width: '100%', height: 'auto', display: 'block' as const };

  if (kind === 'hbar') {
    const W = 320, rowH = 30, padT = 6, padB = unit ? 18 : 6;
    const H = padT + padB + values.length * rowH;
    const labelW = 92, barX = labelW + 8, valW = 36, barMaxW = W - barX - valW;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={svgStyle}>
        {values.map((v, i) => {
          const bh = 14, by = padT + i * rowH + (rowH - bh) / 2, bw = (v / max) * barMaxW;
          return (
            <g key={i}>
              <text x={4} y={by + bh / 2 + 3} fontSize={10} fill={LBL}>{labels[i]}</text>
              <rect x={barX} y={by} width={barMaxW} height={bh} rx={4} fill="rgba(255,255,255,0.05)" />
              <rect x={barX} y={by} width={Math.max(2, bw)} height={bh} rx={4} fill={ACC} />
              <text x={barX + bw + 5} y={by + bh / 2 + 3} fontSize={10} fontWeight={700} fill="var(--text)">{v.toLocaleString('ru-RU')}</text>
            </g>
          );
        })}
        {unit && <text x={4} y={H - 5} fontSize={9} fill="var(--muted)">{unit}</text>}
      </svg>
    );
  }

  const W = 320, H = 180, padL = 30, padR = 12, padT = 14, padB = 26;
  const plotH = H - padT - padB, plotW = W - padL - padR;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ v: Math.round(max * f), y: padT + plotH - f * plotH }));

  if (kind === 'bar') {
    const gap = plotW / values.length, bw = gap * 0.56;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={svgStyle}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} y1={t.y} x2={W - padR} y2={t.y} stroke={AX} strokeWidth={1} />
            <text x={padL - 6} y={t.y + 3} fontSize={9} fill={LBL} textAnchor="end">{t.v}</text>
          </g>
        ))}
        {values.map((v, i) => {
          const x = padL + gap * i + (gap - bw) / 2, h = (v / max) * plotH, y = padT + plotH - h;
          return (
            <g key={i}>
              <rect x={x} y={y} width={bw} height={h} rx={4} fill={ACC} />
              <text x={x + bw / 2} y={y - 5} fontSize={9} fontWeight={700} fill="var(--text)" textAnchor="middle">{v}</text>
              <text x={x + bw / 2} y={H - 9} fontSize={10} fill={LBL} textAnchor="middle">{labels[i]}</text>
            </g>
          );
        })}
        {unit && <text x={W - padR} y={10} fontSize={9} fill="var(--muted)" textAnchor="end">{unit}</text>}
      </svg>
    );
  }

  // line
  const X = (i: number) => padL + (plotW / Math.max(1, values.length - 1)) * i;
  const Y = (v: number) => padT + plotH - (v / max) * plotH;
  const pts = values.map((v, i) => `${X(i)},${Y(v)}`).join(' ');
  const area = `${X(0)},${Y(0)} ${pts} ${X(values.length - 1)},${Y(0)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={svgStyle}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} y1={t.y} x2={W - padR} y2={t.y} stroke={AX} strokeWidth={1} />
          <text x={padL - 6} y={t.y + 3} fontSize={9} fill={LBL} textAnchor="end">{t.v}</text>
        </g>
      ))}
      <polygon points={area} fill="rgba(16,185,129,0.16)" />
      <polyline points={pts} fill="none" stroke={ACC} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => (
        <g key={i}>
          <circle cx={X(i)} cy={Y(v)} r={3.5} fill="#000" stroke={ACC} strokeWidth={2} />
          <text x={X(i)} y={H - 9} fontSize={10} fill={LBL} textAnchor="middle">{labels[i]}</text>
        </g>
      ))}
      {unit && <text x={W - padR} y={10} fontSize={9} fill="var(--muted)" textAnchor="end">{unit}</text>}
    </svg>
  );
}

// ===== Источники с вкладками (Multi-Source Reasoning) =====
function SourceTabs({ sources }: { sources: { label: string; text: string }[] }) {
  const [active, setActive] = useState(0);
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {sources.map((src, i) => (
          <button key={i} onClick={() => setActive(i)} style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 'var(--fs-caption)', fontWeight: 700, background: active === i ? 'var(--accent-soft)' : 'transparent', color: active === i ? 'var(--accent)' : 'var(--text2)' }}>{src.label}</button>
        ))}
      </div>
      <div style={{ fontSize: 'var(--fs-snap14)', color: 'var(--text)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{sources[active].text}</div>
    </div>
  );
}

function answerLabel(q: GmatQuestion, val: number | null | undefined): string {
  if (val == null) return '—';
  if (q.twoPart) {
    const a = Math.floor(val / 100), b = val % 100;
    return `${q.twoPart.colA}: ${q.options[a] ?? '?'}; ${q.twoPart.colB}: ${q.options[b] ?? '?'}`;
  }
  return q.options[val] ?? '—';
}

export default function GmatTest() {
  const { user } = useAuthStore();
  const nav = useNavigate();
  const canOpen = hasFlag(user, 'gmat');

  useEffect(() => {
    if (!canOpen) nav('/languages');
  }, [canOpen, nav]);
  const [mode, setMode] = useState<Mode | null>(null);
  const [questions, setQuestions] = useState<GmatQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [finished, setFinished] = useState(false);
  const [best, setBest] = useState<number | null>(() => {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_BEST) : null;
    return v ? Number(v) : null;
  });
  const [bestSections, setBestSections] = useState<Record<string, number>>(() => {
    try { const v = localStorage.getItem(LS_BEST_SECTIONS); return v ? JSON.parse(v) : {}; } catch { return {}; }
  });
  const [history, setHistory] = useState<Attempt[]>(() => {
    try { const v = localStorage.getItem(LS_HISTORY); return v ? JSON.parse(v) : []; } catch { return []; }
  });
  const [viewAttempt, setViewAttempt] = useState<Attempt | null>(null);
  const [mistakes, setMistakes] = useState<string[]>(() => {
    try { const v = localStorage.getItem(LS_MISTAKES); return v ? JSON.parse(v) : []; } catch { return []; }
  });
  const [examMode, setExamMode] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const tRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishedRef = useRef(false);
  const timesRef = useRef<Record<string, number>>({});
  const qStart = useRef<number>(0);
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [reviewing, setReviewing] = useState(false);
  const [tp, setTp] = useState<[number | null, number | null]>([null, null]);

  const total = questions.length;
  const cur = questions[idx];
  const answered = chosen !== null;

  const start = (m: Mode) => {
    const pool = m === 'full' ? GMAT_QUESTIONS : GMAT_QUESTIONS.filter(q => q.section === m);
    const qs = shuffle(pool);
    setQuestions(qs);
    setMode(m); setIdx(0); setChosen(null); setAnswers({}); setFinished(false);
    setFlagged({}); setReviewing(false); finishedRef.current = false; timesRef.current = {}; setTp([null, null]);
    setSecondsLeft(qs.length * SECONDS_PER_Q);
  };

  const startMistakes = (qs: GmatQuestion[]) => {
    setQuestions(shuffle(qs));
    setIdx(0); setChosen(null); setAnswers({}); setFinished(false);
    setFlagged({}); setReviewing(false); setExamMode(false); finishedRef.current = false; timesRef.current = {}; setTp([null, null]);
    setSecondsLeft(qs.length * SECONDS_PER_Q);
  };

  const clearHistory = () => { setHistory([]); try { localStorage.removeItem(LS_HISTORY); } catch { /* no-op */ } };

  const startMyMistakes = () => {
    const qs = mistakes.map(id => GMAT_QUESTIONS.find(q => q.id === id)).filter(Boolean) as GmatQuestion[];
    if (!qs.length) return;
    startMistakes(qs);
    setMode('full');
  };

  const pick = (i: number) => {
    if (answered && !examMode) return;
    setChosen(i);
    setAnswers(prev => ({ ...prev, [cur.id]: i }));
  };

  const syncTp = (i: number) => {
    const q = questions[i];
    setTp(q && q.twoPart && answers[q.id] != null ? [Math.floor(answers[q.id] / 100), answers[q.id] % 100] : [null, null]);
  };
  const pickTP = (col: 0 | 1, i: number) => {
    if (answered && !examMode) return;
    const nt: [number | null, number | null] = col === 0 ? [i, tp[1]] : [tp[0], i];
    setTp(nt);
    if (nt[0] != null && nt[1] != null) { const enc = nt[0] * 100 + nt[1]; setAnswers(prev => ({ ...prev, [cur.id]: enc })); setChosen(enc); }
  };

  const doFinish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (cur && !reviewing) { timesRef.current[cur.id] = (timesRef.current[cur.id] || 0) + (Date.now() - qStart.current); qStart.current = Date.now(); }
    if (tRef.current) { clearInterval(tRef.current); tRef.current = null; }
    const correct = questions.filter(q => answers[q.id] === q.answer).length;
    const pct = total ? Math.round((correct / total) * 100) : 0;
    const nb = best == null ? pct : Math.max(best, pct);
    setBest(nb);
    try { localStorage.setItem(LS_BEST, String(nb)); } catch { /* no-op */ }
    const secNext: Record<string, number> = { ...bestSections };
    for (const sec of Array.from(new Set(questions.map(q => q.section)))) {
      const qs = questions.filter(q => q.section === sec);
      const sp = qs.length ? Math.round((qs.filter(q => answers[q.id] === q.answer).length / qs.length) * 100) : 0;
      secNext[sec] = secNext[sec] == null ? sp : Math.max(secNext[sec], sp);
    }
    setBestSections(secNext);
    try { localStorage.setItem(LS_BEST_SECTIONS, JSON.stringify(secNext)); } catch { /* no-op */ }
    const timesSecs: Record<string, number> = {};
    let totMs = 0;
    for (const q of questions) { const ms = timesRef.current[q.id] || 0; timesSecs[q.id] = Math.round(ms / 1000); totMs += ms; }
    const rec: Attempt = { ts: Date.now(), mode: mode as Mode, exam: examMode, pct, correct, total, score: computeFocus(questions, answers).fullScore, qids: questions.map(q => q.id), ans: { ...answers }, secs: Math.round(totMs / 1000), times: timesSecs };
    const hist = [rec, ...history].slice(0, 25);
    setHistory(hist);
    try { localStorage.setItem(LS_HISTORY, JSON.stringify(hist)); } catch { /* no-op */ }
    const correctIds = new Set(questions.filter(q => answers[q.id] === q.answer).map(q => q.id));
    const wrongIds = questions.filter(q => answers[q.id] !== q.answer).map(q => q.id);
    const nextMistakes = Array.from(new Set([...mistakes.filter(id => !correctIds.has(id)), ...wrongIds]));
    setMistakes(nextMistakes);
    try { localStorage.setItem(LS_MISTAKES, JSON.stringify(nextMistakes)); } catch { /* no-op */ }
    setFinished(true);
    if (pct >= GMAT_PASS) setTimeout(() => triggerConfetti({ count: 140, power: 13, duration: 2800 }), 300);
  };

  const next = () => {
    if (idx + 1 >= total) doFinish();
    else { setIdx(idx + 1); setChosen(answers[questions[idx + 1].id] ?? null); syncTp(idx + 1); }
  };

  const prev = () => { if (idx > 0) { setIdx(idx - 1); setChosen(answers[questions[idx - 1].id] ?? null); syncTp(idx - 1); } };
  const goTo = (i: number) => { setIdx(i); setChosen(answers[questions[i].id] ?? null); syncTp(i); setReviewing(false); };
  const toggleFlag = () => setFlagged(f => ({ ...f, [cur.id]: !f[cur.id] }));

  // Таймер (только в режиме экзамена)
  useEffect(() => {
    if (!mode || finished || !examMode) return;
    tRef.current = setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000);
    return () => { if (tRef.current) { clearInterval(tRef.current); tRef.current = null; } };
  }, [mode, finished, examMode]);

  // Время вышло → авто-сдача
  useEffect(() => {
    if (examMode && mode && !finished && questions.length > 0 && secondsLeft === 0) doFinish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, examMode, mode, finished]);

  // Замер времени на каждый вопрос
  useEffect(() => {
    if (!mode || finished || reviewing || viewAttempt || !cur) return;
    qStart.current = Date.now();
    const id = cur.id;
    return () => { timesRef.current[id] = (timesRef.current[id] || 0) + (Date.now() - qStart.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, mode, finished, reviewing, viewAttempt]);

  // ---------- Разбор прошлой попытки (из истории) ----------
  if (viewAttempt) {
    const a = viewAttempt;
    const qs = (a.qids || []).map(id => GMAT_QUESTIONS.find(q => q.id === id)).filter(Boolean) as GmatQuestion[];
    const ans = a.ans || {};
    const tot = qs.length;
    const corr = qs.filter(q => ans[q.id] === q.answer).length;
    const pc = tot ? Math.round((corr / tot) * 100) : 0;
    const passed = pc >= GMAT_PASS;
    const wrong = qs.filter(q => ans[q.id] !== q.answer);
    const { focus, fullScore } = computeFocus(qs, ans);
    const dt = new Date(a.ts).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => setViewAttempt(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 'var(--fs-title)', padding: 0 }}>‹</button>
          <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text)' }}>Попытка · {dt}</div>
        </div>
        <div className="page-scroll" style={{ flex: 1, padding: 20 }}>
          <div style={{ textAlign: 'center', marginTop: 4 }}>
            <div style={{ fontSize: 44, fontWeight: 800, color: passed ? '#10B981' : 'var(--accent)' }}>{pc}%</div>
            {fullScore != null ? (
              <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>≈ {fullScore} <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', fontWeight: 500 }}>/ 805</span></div>
            ) : (focus.length > 0 && (
              <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>{focus[0].label}: ≈ {focus[0].scaled} <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', fontWeight: 500 }}>/ 90</span></div>
            ))}
            <div style={{ fontSize: 'var(--fs-snap14)', color: 'var(--muted)', marginTop: 6 }}>{corr} из {tot} верно · {a.exam ? 'экзамен' : 'учёба'}{a.secs ? ' · ' + fmtTime(a.secs) : ''}</div>
            {focus.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
                {focus.map(f => (
                  <div key={f.key} style={{ textAlign: 'center', minWidth: 64 }}>
                    <div style={{ fontSize: 'var(--fs-title)', fontWeight: 800, color: 'var(--text)' }}>{f.scaled}</div>
                    <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)' }}>{f.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {tot === 0 && <div style={{ fontSize: 'var(--fs-snap14)', color: 'var(--muted)', textAlign: 'center', marginTop: 24 }}>Детали этой попытки не сохранены.</div>}

          {wrong.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 'var(--fs-micro)', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>Разбор ошибок ({wrong.length})</div>
              {wrong.map(q => (
                <div key={q.id} style={{ background: 'var(--surface-light)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginBottom: 10 }}>
                  <div style={{ fontSize: 'var(--fs-micro)', color: SECTION_META[q.section].color, fontWeight: 700, marginBottom: 4 }}>{q.type}{q.difficulty ? ' · ' + DIFF_META[q.difficulty].label : ''}</div>
                  <div style={{ fontSize: 'var(--fs-snap14)', color: 'var(--text)', whiteSpace: 'pre-wrap', marginBottom: 8 }}>{q.prompt}</div>
                  <div style={{ fontSize: 'var(--fs-label)', color: '#EF4444' }}>Ваш ответ: {answerLabel(q, ans[q.id])}</div>
                  <div style={{ fontSize: 'var(--fs-label)', color: '#10B981', marginTop: 2 }}>Верно: {answerLabel(q, q.answer)}</div>
                  <div style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>{q.explanation}</div>
                </div>
              ))}
            </div>
          )}
          {tot > 0 && wrong.length === 0 && <div style={{ fontSize: 'var(--fs-snap14)', color: '#10B981', textAlign: 'center', marginTop: 20, fontWeight: 600 }}>Все ответы верны 🎉</div>}
        </div>
        <div style={{ padding: '0 16px 20px', paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))' }}>
          {wrong.length > 0 && (
            <button onClick={() => { startMistakes(wrong); setMode(a.mode); setViewAttempt(null); }} style={{ width: '100%', padding: 14, marginBottom: 8, background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 12, fontSize: 'var(--fs-body)', fontWeight: 700, cursor: 'pointer' }}>🔁 Повторить ошибки ({wrong.length})</button>
          )}
          <button onClick={() => setViewAttempt(null)} style={{ width: '100%', padding: 14, background: 'var(--surface-light)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 'var(--fs-body)', fontWeight: 600, cursor: 'pointer' }}>Назад к истории</button>
        </div>
      </div>
    );
  }

  // ---------- Старт: выбор режима ----------
  if (!mode) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => nav('/languages')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 'var(--fs-title)', padding: 0 }}>‹</button>
          <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text)' }}>Тест MBA / GMAT</div>
        </div>
        <div className="page-scroll" style={{ flex: 1, padding: 16 }}>
          <div style={{ fontSize: 56, textAlign: 'center', marginTop: 4 }}>🎓</div>
          <h2 style={{ fontSize: 'var(--fs-title)', fontWeight: 800, color: 'var(--text)', textAlign: 'center', margin: '6px 0 2px' }}>Подготовка к GMAT</h2>
          <p style={{ fontSize: 'var(--fs-snap14)', color: 'var(--muted)', textAlign: 'center', margin: '0 auto 6px', maxWidth: 320 }}>
            Вопросы в формате GMAT: Quant, Verbal, Data Sufficiency и Data Insights. Выбери учебный режим (с разбором) или экзамен на время.
          </p>
          {best != null && (
            <div style={{ textAlign: 'center', fontSize: 'var(--fs-label)', color: 'var(--muted)', marginBottom: 14 }}>
              Лучший результат: <b style={{ color: best >= GMAT_PASS ? '#10B981' : 'var(--text)' }}>{best}%</b>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, background: 'var(--surface-light)', borderRadius: 12, padding: 4 }}>
            <button onClick={() => setExamMode(false)} style={{ flex: 1, padding: 9, borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 'var(--fs-label)', fontWeight: 700, background: !examMode ? 'var(--accent)' : 'transparent', color: !examMode ? 'var(--bg)' : 'var(--muted)' }}>📚 Учёба</button>
            <button onClick={() => setExamMode(true)} style={{ flex: 1, padding: 9, borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 'var(--fs-label)', fontWeight: 700, background: examMode ? 'var(--accent)' : 'transparent', color: examMode ? 'var(--bg)' : 'var(--muted)' }}>⏱️ Экзамен</button>
          </div>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', textAlign: 'center', marginBottom: 12, lineHeight: 1.45 }}>
            {examMode ? 'На время, без подсказок. Можно пропускать и менять ответы. Разбор — в конце. ~2 мин/вопрос.' : 'Без таймера. Подробный разбор сразу после каждого ответа.'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            {MODES.map(m => {
              const mb = m.id === 'full' ? best : (bestSections[m.id] ?? null);
              return (
              <button key={m.id} onClick={() => start(m.id)} className="tap-effect"
                style={{ display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', background: 'var(--surface-light)', border: '1px solid var(--border)', borderRadius: 16, padding: 14, cursor: 'pointer' }}>
                <div style={{ fontSize: 28, width: 30, textAlign: 'center' }}>{m.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text)' }}>{m.title}</div>
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 1 }}>{m.desc}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', fontWeight: 600 }}>{m.n} вопр.</div>
                  {mb != null && <div style={{ fontSize: 'var(--fs-micro)', color: mb >= GMAT_PASS ? '#10B981' : 'var(--muted)', fontWeight: 700, marginTop: 2 }}>лучший {mb}%</div>}
                </div>
              </button>
              );
            })}
          </div>
          {mistakes.length > 0 && (
            <button onClick={startMyMistakes} className="tap-effect" style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', marginTop: 12, background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: 16, padding: 14, cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ fontSize: 28, width: 30, textAlign: 'center' }}>🔁</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--accent)' }}>Работа над ошибками</div>
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text2)', marginTop: 1 }}>Накопленные неверные · решишь верно — уходят</div>
              </div>
              <div style={{ fontSize: 'var(--fs-body)', fontWeight: 800, color: 'var(--accent)' }}>{mistakes.length}</div>
            </button>
          )}
          {history.length > 0 && (
            <div style={{ marginTop: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 'var(--fs-micro)', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--muted)' }}>История попыток</div>
                <button onClick={clearHistory} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--muted)', fontSize: 'var(--fs-caption)', cursor: 'pointer', textDecoration: 'underline' }}>очистить</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {history.slice(0, 8).map((a, i) => {
                  const title = MODES.find(m => m.id === a.mode)?.title ?? a.mode;
                  return (
                    <div key={i} onClick={() => { if (a.qids && a.qids.length) setViewAttempt(a); }} className={a.qids && a.qids.length ? 'tap-effect' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface-light)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', cursor: a.qids && a.qids.length ? 'pointer' : 'default' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--fs-label)', color: 'var(--text)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· {a.exam ? 'экзамен' : 'учёба'}</span></div>
                        <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)' }}>{new Date(a.ts).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{a.secs ? ' · ' + fmtTime(a.secs) : ''}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 'var(--fs-body)', fontWeight: 800, color: a.pct >= GMAT_PASS ? '#10B981' : 'var(--text)' }}>{a.pct}%</div>
                        {a.score != null && <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)' }}>≈ {a.score}</div>}
                      </div>
                      {a.qids && a.qids.length ? <span style={{ color: 'var(--muted)', fontSize: 'var(--fs-body)', marginLeft: 2 }}>›</span> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <p style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', textAlign: 'center', marginTop: 16 }}>Учебный набор вопросов. Не аффилировано с GMAC.</p>
        </div>
      </div>
    );
  }

  // ---------- Результат ----------
  if (finished) {
    const correct = questions.filter(q => answers[q.id] === q.answer).length;
    const pct = total ? Math.round((correct / total) * 100) : 0;
    const passed = pct >= GMAT_PASS;
    const sections = Array.from(new Set(questions.map(q => q.section))) as GmatSection[];
    const wrong = questions.filter(q => answers[q.id] !== q.answer);
    const { focus, fullScore } = computeFocus(questions, answers);
    const diffStats = (['easy', 'medium', 'hard'] as const).map(d => {
      const qs = questions.filter(q => (q.difficulty ?? 'medium') === d);
      return { d, n: qs.length, c: qs.filter(q => answers[q.id] === q.answer).length };
    }).filter(x => x.n > 0);
    const totalMs = questions.reduce((acc, q) => acc + (timesRef.current[q.id] || 0), 0);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="page-scroll" style={{ flex: 1, padding: 20 }}>
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <div className="anim-bounce-in" style={{ fontSize: 60 }}>{passed ? '🎓' : '📚'}</div>
            <h2 style={{ margin: '6px 0 0', fontSize: 'var(--fs-title)', color: 'var(--text)' }}>{passed ? 'Порог пройден!' : 'Почти получилось'}</h2>
            <div style={{ fontSize: 48, fontWeight: 800, color: passed ? '#10B981' : 'var(--accent)', marginTop: 12 }}>{pct}%</div>
            {fullScore != null ? (
              <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>≈ {fullScore} <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', fontWeight: 500 }}>/ 805 по шкале GMAT</span></div>
            ) : (focus.length > 0 && (
              <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>{focus[0].label}: ≈ {focus[0].scaled} <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', fontWeight: 500 }}>/ 90</span></div>
            ))}
            {focus.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
                {focus.map(f => (
                  <div key={f.key} style={{ textAlign: 'center', minWidth: 64 }}>
                    <div style={{ fontSize: 'var(--fs-title)', fontWeight: 800, color: 'var(--text)' }}>{f.scaled}</div>
                    <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)' }}>{f.label}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', marginTop: 8, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.4 }}>Оценка приблизительная: учебный тест не адаптивный, шкала смоделирована по структуре GMAT Focus.</div>
            <div style={{ fontSize: 'var(--fs-snap14)', color: 'var(--muted)', marginTop: 6 }}>{correct} из {total} верно · порог {GMAT_PASS}%</div>
            {totalMs > 0 && <div style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', marginTop: 6 }}>⏱ Заняло {fmtTime(Math.round(totalMs / 1000))} · в среднем {Math.round(totalMs / total / 1000)}с/вопрос</div>}
            <div style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', marginTop: 8, maxWidth: 300, marginLeft: 'auto', marginRight: 'auto' }}>{scoreLabel(pct)}</div>
            {best != null && <div style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', marginTop: 6 }}>Лучший результат: {best}%</div>}
          </div>

          {sections.length > 1 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 'var(--fs-micro)', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>По разделам</div>
              {sections.map(s => {
                const qs = questions.filter(q => q.section === s);
                const c = qs.filter(q => answers[q.id] === q.answer).length;
                const meta = SECTION_META[s];
                const secMs = qs.reduce((acc, q) => acc + (timesRef.current[q.id] || 0), 0);
                return (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: meta.color }} />
                    <span style={{ fontSize: 'var(--fs-snap14)', color: 'var(--text)', flex: 1 }}>{meta.label}</span>
                    {secMs > 0 && <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)' }}>~{Math.round(secMs / qs.length / 1000)}с/в</span>}
                    <span style={{ fontSize: 'var(--fs-snap14)', color: 'var(--muted)', fontWeight: 600 }}>{c} / {qs.length}</span>
                  </div>
                );
              })}
            </div>
          )}

          {diffStats.length > 1 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 'var(--fs-micro)', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>По сложности</div>
              {diffStats.map(x => (
                <div key={x.d} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: DIFF_META[x.d].color }} />
                  <span style={{ fontSize: 'var(--fs-snap14)', color: 'var(--text)', flex: 1 }}>{DIFF_META[x.d].label}</span>
                  <span style={{ fontSize: 'var(--fs-snap14)', color: 'var(--muted)', fontWeight: 600 }}>{x.c} / {x.n}</span>
                </div>
              ))}
            </div>
          )}

          {wrong.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 'var(--fs-micro)', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>Разбор ошибок ({wrong.length})</div>
              {wrong.map(q => (
                <div key={q.id} style={{ background: 'var(--surface-light)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginBottom: 10 }}>
                  <div style={{ fontSize: 'var(--fs-micro)', color: SECTION_META[q.section].color, fontWeight: 700, marginBottom: 4 }}>{q.type}{q.difficulty ? ' · ' + DIFF_META[q.difficulty].label : ''}</div>
                  <div style={{ fontSize: 'var(--fs-snap14)', color: 'var(--text)', whiteSpace: 'pre-wrap', marginBottom: 8 }}>{q.prompt}</div>
                  <div style={{ fontSize: 'var(--fs-label)', color: '#EF4444' }}>Ваш ответ: {answerLabel(q, answers[q.id])}</div>
                  <div style={{ fontSize: 'var(--fs-label)', color: '#10B981', marginTop: 2 }}>Верно: {answerLabel(q, q.answer)}</div>
                  <div style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>{q.explanation}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ padding: '0 16px 20px', paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))' }}>
          {wrong.length > 0 && (
            <button onClick={() => startMistakes(wrong)} style={{ width: '100%', padding: 14, marginBottom: 8, background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 12, fontSize: 'var(--fs-body)', fontWeight: 700, cursor: 'pointer' }}>🔁 Повторить ошибки ({wrong.length})</button>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setMode(null)} style={{ flex: 1, padding: 14, background: 'var(--surface-light)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 'var(--fs-body)', fontWeight: 600, cursor: 'pointer' }}>К разделам</button>
            <button onClick={() => start(mode)} style={{ flex: 1, padding: 14, background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 12, fontSize: 'var(--fs-body)', fontWeight: 700, cursor: 'pointer' }}>Ещё раз</button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Обзор перед сдачей (только экзамен) ----------
  if (examMode && reviewing) {
    const answeredCount = questions.filter(q => answers[q.id] != null).length;
    const flaggedCount = questions.filter(q => flagged[q.id]).length;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text)' }}>Обзор ответов</div>
          <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-label)', fontWeight: 700, color: secondsLeft <= 60 ? '#EF4444' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>⏱ {fmtTime(secondsLeft)}</span>
        </div>
        <div className="page-scroll" style={{ flex: 1, padding: 16 }}>
          <div style={{ fontSize: 'var(--fs-snap14)', color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>Отвечено {answeredCount} из {total}{flaggedCount > 0 ? ` · отмечено ${flaggedCount}` : ''}. Нажми на номер, чтобы вернуться к вопросу.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            {questions.map((q, i) => {
              const isAns = answers[q.id] != null;
              return (
                <button key={q.id} onClick={() => goTo(i)} className="tap-effect" style={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: 12, cursor: 'pointer', fontSize: 'var(--fs-body)', fontWeight: 700, background: isAns ? 'var(--accent-soft)' : 'var(--surface-light)', border: isAns ? '1px solid var(--accent)' : '1px solid var(--border)', color: isAns ? 'var(--accent)' : 'var(--muted)' }}>
                  {i + 1}
                  {flagged[q.id] && <span style={{ position: 'absolute', top: 2, right: 5, fontSize: 'var(--fs-micro)', color: 'var(--warning)' }}>⚑</span>}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 16, fontSize: 'var(--fs-caption)', color: 'var(--muted)', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 4, background: 'var(--accent-soft)', border: '1px solid var(--accent)' }} /> отвечено</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 4, background: 'var(--surface-light)', border: '1px solid var(--border)' }} /> пусто</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ color: 'var(--warning)' }}>⚑</span> отмечено</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '0 16px 20px', paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))' }}>
          <button onClick={() => setReviewing(false)} style={{ flex: 1, padding: 14, background: 'var(--surface-light)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 'var(--fs-body)', fontWeight: 600, cursor: 'pointer' }}>К вопросам</button>
          <button onClick={doFinish} style={{ flex: 1, padding: 14, background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 12, fontSize: 'var(--fs-body)', fontWeight: 700, cursor: 'pointer' }}>Сдать тест</button>
        </div>
      </div>
    );
  }

  // ---------- Вопрос ----------
  const meta = SECTION_META[cur.section];
  const passage = passageById(cur.passageId);
  const canNext = examMode || answered;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 12px', borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => setMode(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 'var(--fs-title)', padding: 0 }}>‹</button>
        <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text)' }}>Тест MBA / GMAT</div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {examMode && <button onClick={() => setReviewing(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 'var(--fs-label)', fontWeight: 700, padding: 0 }}>Обзор</button>}
          {examMode && <span style={{ fontSize: 'var(--fs-label)', fontWeight: 700, color: secondsLeft <= 60 ? '#EF4444' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>⏱ {fmtTime(secondsLeft)}</span>}
          <span style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)' }}>{idx + 1} / {total}</span>
        </div>
      </div>
      <div style={{ height: 4, background: 'var(--surface-light)' }}><div style={{ height: '100%', width: `${(idx / total) * 100}%`, background: 'var(--accent)', transition: 'width 0.3s' }} /></div>

      <div className="page-scroll" style={{ flex: 1, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-micro)', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: '#fff', background: meta.color, padding: '3px 9px', borderRadius: 999 }}>{cur.type}</span>
          {cur.difficulty && <span style={{ fontSize: 'var(--fs-micro)', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: DIFF_META[cur.difficulty].color, border: `1px solid ${DIFF_META[cur.difficulty].color}`, padding: '3px 8px', borderRadius: 999 }}>{DIFF_META[cur.difficulty].label}</span>}
        </div>

        {passage && (
          <div style={{ background: 'var(--surface-light)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', marginBottom: 14, maxHeight: 220, overflowY: 'auto', position: 'sticky', top: 0, zIndex: 1 }}>
            <div style={{ fontSize: 'var(--fs-micro)', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{passage.title}</div>
            {passage.sources
              ? <SourceTabs key={passage.id} sources={passage.sources} />
              : passage.table
              ? <DataTable key={passage.id} table={passage.table} />
              : passage.chart
              ? <DataChart chart={passage.chart} />
              : <div style={{ fontSize: 'var(--fs-snap14)', color: 'var(--text)', lineHeight: 1.55, whiteSpace: passage.mono ? 'pre' : 'pre-wrap', fontFamily: passage.mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit', overflowX: passage.mono ? 'auto' : 'visible' }}>{passage.text}</div>}
          </div>
        )}

        <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 600, color: 'var(--text)', lineHeight: 1.45, whiteSpace: 'pre-wrap', marginBottom: 14 }}>{cur.prompt}</div>

        {cur.twoPart ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ flex: 1 }} />
              <div style={{ width: 76, textAlign: 'center', fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--text2)' }}>{cur.twoPart.colA}</div>
              <div style={{ width: 76, textAlign: 'center', fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--text2)' }}>{cur.twoPart.colB}</div>
            </div>
            {cur.options.map((o, i) => {
              const ansA = Math.floor(cur.answer / 100), ansB = cur.answer % 100;
              const reveal = !examMode && answered;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, fontSize: 'var(--fs-snap14)', color: 'var(--text)' }}>{o}</div>
                  {([0, 1] as const).map(col => {
                    const sel = tp[col] === i;
                    const isCorrectCell = col === 0 ? i === ansA : i === ansB;
                    let bd = 'var(--border)', dotc = 'var(--accent)';
                    if (sel) bd = 'var(--accent)';
                    if (reveal) { if (isCorrectCell) { bd = '#10B981'; dotc = '#10B981'; } else if (sel) { bd = '#EF4444'; dotc = '#EF4444'; } }
                    const dis = answered && !examMode;
                    return (
                      <button key={col} onClick={() => pickTP(col, i)} disabled={dis} style={{ width: 76, display: 'flex', justifyContent: 'center', background: 'none', border: 'none', cursor: dis ? 'default' : 'pointer', padding: 4 }}>
                        <span style={{ width: 22, height: 22, borderRadius: 999, border: `2px solid ${bd}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {sel && <span style={{ width: 10, height: 10, borderRadius: 999, background: dotc }} />}
                          {reveal && isCorrectCell && !sel && <span style={{ width: 8, height: 8, borderRadius: 999, background: '#10B981' }} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {cur.options.map((o, i) => {
            const isCorrect = i === cur.answer, isChosen = i === chosen;
            let bg = 'var(--surface-light)', border = '1px solid var(--border)', color = 'var(--text)';
            if (examMode) {
              if (isChosen) { bg = 'var(--accent-soft)'; border = '1px solid var(--accent)'; color = 'var(--text)'; }
            } else if (answered) {
              if (isCorrect) { bg = 'rgba(16,185,129,0.16)'; border = '1px solid #10B981'; color = '#10B981'; }
              else if (isChosen) { bg = 'rgba(239,68,68,0.14)'; border = '1px solid #EF4444'; color = '#EF4444'; }
              else color = 'var(--muted)';
            }
            const optDisabled = answered && !examMode;
            return (
              <button key={i} onClick={() => pick(i)} disabled={optDisabled} className="tap-effect"
                style={{ display: 'flex', gap: 10, textAlign: 'left', background: bg, border, color, borderRadius: 12, padding: '13px 14px', fontSize: 'var(--fs-snap14)', fontWeight: 500, lineHeight: 1.4, cursor: optDisabled ? 'default' : 'pointer' }}>
                <span style={{ fontWeight: 700, opacity: 0.85 }}>{String.fromCharCode(65 + i)}</span>
                <span style={{ flex: 1 }}>{o}</span>
              </button>
            );
          })}
        </div>
        )}

        {answered && !examMode && (
          <div className="anim-fade-in" style={{ marginTop: 14, background: chosen === cur.answer ? 'rgba(16,185,129,0.10)' : 'rgba(59,130,246,0.08)', border: `1px solid ${chosen === cur.answer ? 'rgba(16,185,129,0.4)' : 'var(--border)'}`, borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 'var(--fs-label)', fontWeight: 700, color: chosen === cur.answer ? '#10B981' : 'var(--text)', marginBottom: 4 }}>{chosen === cur.answer ? '✓ Верно' : '✗ Разбор'}</div>
            <div style={{ fontSize: 'var(--fs-label)', color: 'var(--text)', lineHeight: 1.55 }}>{cur.explanation}</div>
          </div>
        )}
      </div>

      <div style={{ padding: '0 16px 20px', paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))' }}>
        {examMode ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
            <button onClick={prev} disabled={idx === 0} style={{ flexShrink: 0, padding: '0 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-light)', color: idx === 0 ? 'var(--muted)' : 'var(--text)', fontSize: 'var(--fs-title)', fontWeight: 600, cursor: idx === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
            <button onClick={toggleFlag} aria-label="Отметить вопрос" style={{ flexShrink: 0, padding: '0 16px', borderRadius: 12, border: `1px solid ${flagged[cur.id] ? 'var(--warning)' : 'var(--border)'}`, background: flagged[cur.id] ? 'rgba(251,191,36,0.14)' : 'var(--surface-light)', color: flagged[cur.id] ? 'var(--warning)' : 'var(--text)', fontSize: 'var(--fs-heading)', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg></button>
            <button onClick={() => { if (idx + 1 >= total) setReviewing(true); else next(); }} style={{ flex: 1, padding: 16, borderRadius: 12, border: 'none', background: 'var(--accent)', color: 'var(--bg)', fontSize: 'var(--fs-snap16)', fontWeight: 700, cursor: 'pointer' }}>{idx + 1 >= total ? 'К обзору' : (chosen === null ? 'Пропустить' : 'Дальше')}</button>
          </div>
        ) : (
          <button onClick={next} disabled={!canNext} style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', background: canNext ? 'var(--accent)' : 'var(--surface-light)', color: canNext ? 'var(--bg)' : 'var(--muted)', fontSize: 'var(--fs-snap16)', fontWeight: 700, cursor: canNext ? 'pointer' : 'default' }}>{idx + 1 >= total ? 'Завершить' : 'Дальше'}</button>
        )}
      </div>
    </div>
  );
}
