import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useTodCategoriesStore, type TodCategoryRow } from '@/stores/todCategoriesStore';
import { haptic } from '@/lib/haptics';
import { toast } from '@/stores/toastStore';
import { GlyphIcon, normalizeGlyph } from '@/components/icons/AppGlyph';

type Tab = 'mine' | 'community';
type Sort = 'new' | 'size' | 'az';
const HIDDEN_KEY = 'tod-hidden-cats';

function plural(n: number, forms: [string, string, string]): string {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return forms[0];
  if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return forms[1];
  return forms[2];
}

function counts(c: TodCategoryRow): string {
  return `${c.truths.length} ${plural(c.truths.length, ['правда', 'правды', 'правд'])} · ${c.dares.length} ${plural(c.dares.length, ['действие', 'действия', 'действий'])}`;
}

export default function TodCategories() {
  const nav = useNavigate();
  const { session } = useAuthStore();
  const myId = session?.user?.id;
  const { mine, community, loadingMine, loadingCommunity, loadMine, loadCommunity, addFromCommunity, subscribeRealtime, unsubscribeRealtime } = useTodCategoriesStore();
  const [tab, setTab] = useState<Tab>('mine');
  const [adding, setAdding] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('new');
  const [hidden, setHidden] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]')); } catch { return new Set(); }
  });
  const [showHidden, setShowHidden] = useState(false);

  useEffect(() => {
    if (myId) loadMine(myId);
    loadCommunity();
    subscribeRealtime(myId);
    return () => unsubscribeRealtime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId]);

  const addedSourceIds = useMemo(() => new Set(mine.map(c => c.source_id).filter(Boolean) as string[]), [mine]);

  const handleAdd = async (cat: TodCategoryRow) => {
    if (!myId) return;
    haptic.tap();
    setAdding(cat.id);
    const { error } = await addFromCommunity(cat, myId);
    setAdding(null);
    if (error) { toast.error('Ошибка: ' + error); return; }
    haptic.success();
    toast.success('Категория добавлена');
  };

  const hide = (cid: string) => {
    haptic.tap();
    setHidden(prev => {
      const n = new Set(prev); n.add(cid);
      try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...n])); } catch { /* noop */ }
      return n;
    });
    toast.success('Скрыто. Спасибо за обратную связь');
  };
  const unhideAll = () => {
    haptic.tap();
    setHidden(new Set());
    try { localStorage.removeItem(HIDDEN_KEY); } catch { /* noop */ }
    setShowHidden(false);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'mine', label: 'Мои' },
    { id: 'community', label: 'Сообщество' },
  ];
  const sorts: { id: Sort; label: string }[] = [
    { id: 'new', label: 'Новые' },
    { id: 'size', label: 'По размеру' },
    { id: 'az', label: 'А–Я' },
  ];

  const baseList = tab === 'mine' ? mine : community;
  const loading = tab === 'mine' ? loadingMine : loadingCommunity;

  const display = useMemo(() => {
    let arr = baseList;
    if (tab === 'community' && !showHidden) arr = arr.filter(c => !hidden.has(c.id));
    const q = query.trim().toLowerCase();
    if (q) arr = arr.filter(c => c.title.toLowerCase().includes(q));
    const sorted = arr.slice();
    if (sort === 'size') sorted.sort((a, b) => (b.truths.length + b.dares.length) - (a.truths.length + a.dares.length));
    else if (sort === 'az') sorted.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
    return sorted;
  }, [baseList, tab, showHidden, hidden, query, sort]);

  const hiddenCount = useMemo(() => (tab === 'community' ? community.filter(c => hidden.has(c.id)).length : 0), [tab, community, hidden]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>
      <header className="safe-top" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => { haptic.tap(); nav(-1); }} style={{ width: 36, height: 36, borderRadius: 18, border: 'none', background: 'var(--surface-light)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h1 style={{ margin: 0, fontSize: 'var(--fs-heading)', fontWeight: 700, flex: 1 }}>Категории</h1>
        <button onClick={() => { haptic.tap(); nav('/tod/category/new'); }} className="alias-btn-press" style={{ height: 36, padding: '0 14px', borderRadius: 18, border: 'none', background: 'var(--accent)', color: 'var(--bg)', fontSize: 'var(--fs-label)', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Создать
        </button>
      </header>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => { haptic.tap(); setTab(t.id); }} style={{
            flex: 1, padding: '12px 0', background: 'transparent', border: 'none',
            borderBottom: '2px solid', borderBottomColor: tab === t.id ? 'var(--accent)' : 'transparent',
            color: tab === t.id ? 'var(--text)' : 'var(--muted)', fontSize: 'var(--fs-label)', fontWeight: 600,
            cursor: 'pointer', transition: 'color .2s, border-color .2s',
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: '12px 14px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', display: 'flex' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </span>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Поиск категории"
            style={{ width: '100%', padding: '11px 12px 11px 36px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: 'var(--fs-label)', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {sorts.map(o => (
            <button key={o.id} onClick={() => { haptic.tap(); setSort(o.id); }} style={{
              padding: '6px 12px', borderRadius: 20, border: '1px solid', cursor: 'pointer',
              borderColor: sort === o.id ? 'var(--accent)' : 'var(--border)',
              background: sort === o.id ? 'var(--accent)' : 'transparent',
              color: sort === o.id ? 'var(--bg)' : 'var(--muted)',
              fontSize: 'var(--fs-caption)', fontWeight: 600,
            }}>{o.label}</button>
          ))}
        </div>
      </div>

      <div className="page-scroll" style={{ padding: 14, flex: 1 }}>
        {tab === 'community' && hiddenCount > 0 && (
          <button onClick={() => { if (showHidden) unhideAll(); else { haptic.tap(); setShowHidden(true); } }} style={{ width: '100%', marginBottom: 10, padding: '8px', borderRadius: 10, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 'var(--fs-caption)', cursor: 'pointer' }}>
            {showHidden ? 'Вернуть скрытые в общий список' : `Скрыто: ${hiddenCount} · показать`}
          </button>
        )}

        {loading && display.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
            <span className="anim-spin" style={{ display: 'inline-block', fontSize: 'var(--fs-snap24)' }}>↻</span>
          </div>
        )}

        {!loading && display.length === 0 && (
          <div className="anim-fade-in" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--muted)' }}>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>{query ? <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.55 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> : (tab === 'mine' ? <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.55 }}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg> : <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.55 }}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>)}</div>
            <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
              {query ? 'Ничего не найдено' : (tab === 'mine' ? 'Пока нет своих категорий' : 'В сообществе пусто')}
            </div>
            {!query && (
              <div style={{ fontSize: 'var(--fs-label)', marginBottom: 20 }}>
                {tab === 'mine' ? 'Создай свой набор правд и действий' : 'Опубликуй свою — она появится здесь'}
              </div>
            )}
            {tab === 'mine' && !query && (
              <button onClick={() => { haptic.tap(); nav('/tod/category/new'); }} className="alias-btn-press" style={{ padding: '12px 24px', borderRadius: 100, border: 'none', background: 'var(--accent)', color: 'var(--bg)', fontSize: 'var(--fs-label)', fontWeight: 700, cursor: 'pointer' }}>
                Создать категорию
              </button>
            )}
          </div>
        )}

        {display.map((c, i) => {
          const isMineOwn = c.owner_id === myId;
          const already = !c.source_id && addedSourceIds.has(c.id);
          return (
            <div key={c.id} className="alias-cat-card" style={{ animationDelay: Math.min(i, 14) * 35 + 'ms', display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, background: 'var(--surface-light)', border: '1px solid var(--border)', marginBottom: 10 }}>
              <div style={{ width: 50, height: 50, borderRadius: 14, background: 'var(--bg)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><GlyphIcon name={normalizeGlyph(c.emoji, 'dice')} size={28} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.title}{c.rating === 'spicy' ? <span style={{ display: 'inline-flex', marginLeft: 5, color: 'var(--accent)' }}><GlyphIcon name="chili" size={13} /></span> : null}
                </div>
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {counts(c)}
                  {tab === 'community' && c.owner?.display_name ? ' · ' + c.owner.display_name : ''}
                </div>
              </div>
              {tab === 'mine' ? (
                <button onClick={() => { haptic.tap(); nav('/tod/category/' + c.id); }} className="alias-btn-press" style={{ width: 38, height: 38, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {isMineOwn ? (
                    <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', fontWeight: 600, padding: '0 6px' }}>ваша</span>
                  ) : already ? (
                    <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--accent)', fontWeight: 700, padding: '0 6px', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      есть
                    </span>
                  ) : (
                    <button onClick={() => handleAdd(c)} disabled={adding === c.id} className="alias-btn-press" style={{ padding: '9px 14px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: 'var(--bg)', fontSize: 'var(--fs-label)', fontWeight: 700, cursor: 'pointer' }}>
                      {adding === c.id ? '…' : '+ Себе'}
                    </button>
                  )}
                  {!isMineOwn && (
                    <button onClick={() => hide(c.id)} title="Скрыть / пожаловаться" className="alias-btn-press" style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
