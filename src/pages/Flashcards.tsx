import { useState, useEffect } from 'react';
import { goBack } from '@/lib/nav';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguagesStore, type Language } from '@/stores/languagesStore';
import { supabase } from '@/lib/supabase';
import { haptic } from '@/lib/haptics';
import { speak, speechSupported } from '@/lib/speech';
import { GlyphIcon } from '@/components/icons/AppGlyph';

interface Card { id: string; word: string; tr: string; example: string | null; }

const SESSION = 20;

function shuffle<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

export default function Flashcards() {
  const nav = useNavigate();
  const { lang } = useParams<{ lang: string }>();
  const language = (lang as Language) || 'en';
  const { courses, loadCourses, recordWordAnswer } = useLanguagesStore();

  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [knew, setKnew] = useState(0);
  const [finished, setFinished] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      await loadCourses();
      const courseIds = useLanguagesStore.getState().courses.filter(c => c.language === language).map(c => c.id);
      if (!courseIds.length) { if (alive) { setCards([]); setLoading(false); } return; }
      const { data: w } = await supabase.from('language_words').select('id, word, translation_ru, example').in('course_id', courseIds);
      const words = ((w || []) as any[]).filter(x => x.word && x.translation_ru);
      // приоритет: слова на повторение (due_at ≤ сейчас) → новые → остальные
      const { data: mem } = await supabase.from('user_word_memory').select('word_id, level, due_at, wrong_count');
      const memMap: Record<string, { level: number; due_at: string; wrong_count: number }> = {};
      for (const m of ((mem || []) as any[])) memMap[m.word_id] = { level: m.level, due_at: m.due_at, wrong_count: m.wrong_count ?? 0 };
      const now = Date.now();
      // адаптивно: слабые (с большим числом ошибок) — раньше, равные случайно
      const due = words.filter(x => memMap[x.id] && new Date(memMap[x.id].due_at).getTime() <= now)
        .sort((a, b) => ((memMap[b.id]?.wrong_count || 0) - (memMap[a.id]?.wrong_count || 0)) || (Math.random() - 0.5));
      const fresh = shuffle(words.filter(x => !memMap[x.id]));
      const rest = shuffle(words.filter(x => memMap[x.id] && new Date(memMap[x.id].due_at).getTime() > now));
      const picked = [...due, ...fresh, ...rest].slice(0, SESSION)
        .map(x => ({ id: x.id, word: x.word, tr: x.translation_ru, example: x.example || null }));
      if (alive) {
        setCards(picked);
        setIdx(0); setFlipped(false); setKnew(0); setFinished(false);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, reloadKey]);

  const total = cards.length;
  const cur = cards[idx];

  const grade = (didKnow: boolean) => {
    if (!cur) return;
    if (didKnow) { setKnew(k => k + 1); haptic.success(); } else haptic.error();
    recordWordAnswer(cur.id, didKnow);
    const ni = idx + 1;
    if (ni >= total) setFinished(true);
    else { setIdx(ni); setFlipped(false); }
  };

  const Header = (label: string) => (
    <header className="safe-top" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
      <button onClick={() => { haptic.tap(); goBack(nav, '/languages'); }} style={{ width: 36, height: 36, borderRadius: 18, border: 'none', background: 'var(--surface-light)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 'var(--fw-semibold, 600)' }}>{label}</div>
    </header>
  );

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>{Header('Карточки')}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
        <span className="anim-spin" style={{ display: 'inline-block', fontSize: 'var(--fs-snap24)' }}>↻</span>
      </div>
    </div>
  );

  if (total === 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>{Header('Карточки')}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24, gap: 8 }}>
        <div style={{ color: 'var(--accent)' }}><GlyphIcon name="seedling" size={50} /></div>
        <div style={{ fontSize: 'var(--fs-snap16)', fontWeight: 600, color: 'var(--text)' }}>Пока нет слов</div>
        <div style={{ fontSize: 'var(--fs-snap14)', color: 'var(--muted)', maxWidth: 280 }}>Пройди темы в курсе — слова появятся здесь для повторения.</div>
      </div>
    </div>
  );

  if (finished) {
    const pct = Math.round((knew / total) * 100);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 20 }}>{Header('Карточки')}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <div className="anim-bounce-in" style={{ color: 'var(--accent)', marginBottom: 8 }}><GlyphIcon name={pct >= 80 ? 'confetti' : pct >= 50 ? 'smile' : 'workout'} size={56} /></div>
          <h2 style={{ margin: 0, fontSize: 'var(--fs-title)', color: 'var(--text)' }}>Колода пройдена</h2>
          <div style={{ fontSize: 48, fontWeight: 700, color: 'var(--accent)', marginTop: 14 }}>{knew}/{total}</div>
          <div style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', marginTop: 8, maxWidth: 280 }}>Результаты учтены в интервальном повторении.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { haptic.tap(); goBack(nav, '/languages'); }} style={{ flex: 1, padding: 14, background: 'var(--surface-light)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 'var(--fs-body)', fontWeight: 600, cursor: 'pointer' }}>В курс</button>
          <button onClick={() => { haptic.tap(); setReloadKey(k => k + 1); }} className="alias-btn-press" style={{ flex: 1, padding: 14, background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 12, fontSize: 'var(--fs-body)', fontWeight: 700, cursor: 'pointer' }}>Ещё колода</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>{Header('Карточки')}
      <div style={{ height: 4, background: 'var(--surface-light)' }}>
        <div style={{ height: '100%', width: `${(idx / total) * 100}%`, background: 'var(--accent)', transition: 'width 0.3s' }} />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 18 }}>
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)' }}>{idx + 1} / {total}</div>

        <div className="fc-scene" style={{ width: '100%', maxWidth: 420 }} onClick={() => { haptic.tap(); setFlipped(f => !f); }}>
          <div className={`fc-card ${flipped ? 'flipped' : ''}`} style={{ height: 'min(46vh, 320px)' }}>
            {/* Лицо: слово */}
            <div className="fc-face" style={{ position: 'absolute', inset: 0, borderRadius: 20, background: 'var(--surface-2)', boxShadow: 'var(--shadow-1)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Слово</div>
              <div style={{ fontSize: 'clamp(28px, 8vw, 46px)', fontWeight: 800, color: 'var(--text)', lineHeight: 1.15 }}>{cur.word}</div>
              {speechSupported() && (
                <button onClick={e => { e.stopPropagation(); haptic.tap(); speak(cur.word, language); }} style={{ marginTop: 14, background: 'none', border: 'none', cursor: 'pointer', color: '#3B82F6', padding: 6 }} aria-label="Произнести">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
                </button>
              )}
              <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', marginTop: 14 }}>Нажми, чтобы перевернуть</div>
            </div>
            {/* Оборот: перевод */}
            <div className="fc-face fc-back" style={{ position: 'absolute', inset: 0, borderRadius: 20, background: 'var(--surface-2)', boxShadow: 'var(--shadow-1)', border: '1px solid var(--accent)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Перевод</div>
              <div style={{ fontSize: 'clamp(24px, 6.5vw, 38px)', fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>{cur.tr}</div>
              {cur.example && <div style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', marginTop: 14, fontStyle: 'italic' }}>{cur.example}</div>}
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
