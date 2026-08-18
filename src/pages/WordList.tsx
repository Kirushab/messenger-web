import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguagesStore, type Language } from '@/stores/languagesStore';
import { supabase } from '@/lib/supabase';
import { haptic } from '@/lib/haptics';
import { toast } from '@/stores/toastStore';
import { GlyphIcon } from '@/components/icons/AppGlyph';
import { speak, speechSupported, hasVoiceFor } from '@/lib/speech';

interface Item { id: string; word: string; tr: string; level: number; }

type Tab = 'all' | 'learning' | 'mastered' | 'new';

function statusOf(level: number): { label: string; color: string; tab: Tab } {
  if (level >= 5) return { label: 'Освоено', color: '#10B981', tab: 'mastered' };
  if (level >= 1) return { label: 'Учу', color: '#F59E0B', tab: 'learning' };
  return { label: 'Новое', color: 'var(--muted)', tab: 'new' };
}

export default function WordList() {
  const nav = useNavigate();
  const { lang } = useParams<{ lang: string }>();
  const language = (lang as Language) || 'en';
  const { loadCourses, recordWordAnswer } = useLanguagesStore();

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      await loadCourses();
      const ids = useLanguagesStore.getState().courses.filter(c => c.language === language).map(c => c.id);
      if (!ids.length) { if (alive) { setItems([]); setLoading(false); } return; }
      const { data: w } = await supabase.from('language_words').select('id, word, translation_ru').in('course_id', ids);
      const words = ((w || []) as any[]).filter(x => x.word && x.translation_ru);
      const { data: mem } = await supabase.from('user_word_memory').select('word_id, level');
      const lvl: Record<string, number> = {};
      for (const m of ((mem || []) as any[])) lvl[m.word_id] = m.level ?? 0;
      const list: Item[] = words.map(x => ({ id: x.id, word: x.word, tr: x.translation_ru, level: lvl[x.id] ?? 0 }))
        .sort((a, b) => a.level - b.level || a.word.localeCompare(b.word));
      if (alive) { setItems(list); setLoading(false); }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const counts = useMemo(() => {
    let learning = 0, mastered = 0, fresh = 0;
    for (const it of items) { const t = statusOf(it.level).tab; if (t === 'learning') learning++; else if (t === 'mastered') mastered++; else fresh++; }
    return { all: items.length, learning, mastered, new: fresh };
  }, [items]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return items.filter(it => {
      if (tab !== 'all' && statusOf(it.level).tab !== tab) return false;
      if (t && !it.word.toLowerCase().includes(t) && !it.tr.toLowerCase().includes(t)) return false;
      return true;
    });
  }, [items, tab, q]);

  const TABS: [Tab, string, number][] = [
    ['all', 'Все', counts.all], ['learning', 'Учу', counts.learning], ['mastered', 'Освоено', counts.mastered], ['new', 'Новые', counts.new],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header className="safe-top" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <button onClick={() => { haptic.tap(); nav(-1); }} style={{ width: 36, height: 36, borderRadius: 18, border: 'none', background: 'var(--surface-light)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 'var(--fw-semibold, 600)', display: 'flex', alignItems: 'center', gap: 8 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>Мои слова</div>
      </header>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {TABS.map(([id, label, n]) => (
          <button key={id} onClick={() => { haptic.tap(); setTab(id); }} style={{
            flex: '1 0 auto', padding: '11px 14px', background: 'none', border: 'none',
            color: tab === id ? 'var(--accent)' : 'var(--muted)',
            borderBottom: tab === id ? '2px solid var(--accent)' : '2px solid transparent',
            fontSize: 'var(--fs-snap14)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>{label} {n > 0 && <span style={{ opacity: 0.7 }}>{n}</span>}</button>
        ))}
      </div>

      <div className="page-scroll" style={{ padding: 16 }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          {!loading && items.length > 0 && (
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', display: 'flex' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </span>
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск слова"
                style={{ width: '100%', padding: '11px 12px 11px 36px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: 'var(--fs-label)', boxSizing: 'border-box' }} />
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>
              <span className="anim-spin" style={{ display: 'inline-block', fontSize: 'var(--fs-snap24)' }}>↻</span>
            </div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>
              <div style={{ marginBottom: 8, color: 'var(--muted)' }}><GlyphIcon name="seedling" size={50} strokeWidth={1.4} /></div>
              <div style={{ fontSize: 'var(--fs-snap16)', fontWeight: 600, color: 'var(--text)' }}>Пока нет слов</div>
              <div style={{ fontSize: 'var(--fs-snap14)', marginTop: 4 }}>Пройди темы в курсе — слова появятся здесь.</div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)', fontSize: 'var(--fs-label)' }}>Ничего не найдено</div>
          ) : (
            filtered.map((it, i) => {
              const st = statusOf(it.level);
              return (
                <div key={it.id} className="edu-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--surface-light)', borderRadius: 12, marginBottom: 8, animationDelay: Math.min(i, 15) * 30 + 'ms' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text)' }}>{it.word}</div>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.tr}</div>
                    <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
                      {[0, 1, 2, 3, 4].map(b => (
                        <div key={b} style={{ width: 18, height: 4, borderRadius: 2, background: b < it.level ? st.color : 'var(--border)' }} />
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                    <div style={{ fontSize: 'var(--fs-micro)', color: st.color, fontWeight: 700 }}>{st.label}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {st.tab !== 'mastered' && (
                        <button onClick={() => { haptic.success(); recordWordAnswer(it.id, true); setItems(prev => prev.map(x => x.id === it.id ? { ...x, level: Math.min(5, x.level + 1) } : x)); toast.success('Запомнено'); }} aria-label="Знаю это слово" style={{ height: 32, padding: '0 10px', borderRadius: 16, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--accent)', cursor: 'pointer', fontSize: 'var(--fs-micro)', fontWeight: 700 }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><GlyphIcon name="checklist" size={13} />Знаю</span></button>
                      )}
                      {hasVoiceFor(language) && (
                        <button onClick={() => { haptic.tap(); speak(it.word, language); }} aria-label="Произнести" style={{ width: 32, height: 32, borderRadius: 16, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg></button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
