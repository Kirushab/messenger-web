import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useAliasCategoriesStore, type AliasCategory } from '@/stores/aliasCategoriesStore';
import { haptic } from '@/lib/haptics';
import { toast } from '@/stores/toastStore';
import { GlyphIcon, normalizeGlyph } from '@/components/icons/AppGlyph';

type Tab = 'mine' | 'community';

function wordsPlural(n: number): string {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return 'слово';
  if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return 'слова';
  return 'слов';
}

export default function AliasCategories() {
  const nav = useNavigate();
  const { session } = useAuthStore();
  const myId = session?.user?.id;
  const { mine, community, loadingMine, loadingCommunity, loadMine, loadCommunity, addFromCommunity } = useAliasCategoriesStore();
  const [tab, setTab] = useState<Tab>('mine');
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    if (myId) loadMine(myId);
    loadCommunity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId]);

  // id оригиналов, уже добавленных к себе
  const addedSourceIds = useMemo(() => new Set(mine.map(c => c.source_id).filter(Boolean) as string[]), [mine]);

  const handleAdd = async (cat: AliasCategory) => {
    if (!myId) return;
    haptic.tap();
    setAdding(cat.id);
    const { error } = await addFromCommunity(cat, myId);
    setAdding(null);
    if (error) { toast.error('Ошибка: ' + error); return; }
    haptic.success();
    toast.success('Категория добавлена');
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'mine', label: 'Мои' },
    { id: 'community', label: 'Сообщество' },
  ];

  const list = tab === 'mine' ? mine : community;
  const loading = tab === 'mine' ? loadingMine : loadingCommunity;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>
      <header className="safe-top" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => { haptic.tap(); nav(-1); }} style={{ width: 36, height: 36, borderRadius: 18, border: 'none', background: 'var(--surface-light)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h1 style={{ margin: 0, fontSize: 'var(--fs-heading)', fontWeight: 700, flex: 1 }}>Категории слов</h1>
        <button onClick={() => { haptic.tap(); nav('/alias/category/new'); }} className="alias-btn-press" style={{ height: 36, padding: '0 14px', borderRadius: 18, border: 'none', background: 'var(--accent)', color: 'var(--bg)', fontSize: 'var(--fs-label)', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Создать
        </button>
      </header>

      {/* Вкладки */}
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

      <div className="page-scroll" style={{ padding: 16, flex: 1 }}>
        {loading && list.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
            <span className="anim-spin" style={{ display: 'inline-block', fontSize: 'var(--fs-snap24)' }}>↻</span>
          </div>
        )}

        {!loading && list.length === 0 && (
          <div className="anim-fade-in" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--muted)' }}>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>{tab === 'mine' ? <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.55 }}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg> : <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.55 }}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>}</div>
            <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
              {tab === 'mine' ? 'Пока нет своих категорий' : 'В сообществе пусто'}
            </div>
            <div style={{ fontSize: 'var(--fs-label)', marginBottom: 20 }}>
              {tab === 'mine' ? 'Создай категорию с любыми словами' : 'Опубликуй свою — она появится здесь'}
            </div>
            {tab === 'mine' && (
              <button onClick={() => { haptic.tap(); nav('/alias/category/new'); }} className="alias-btn-press" style={{ padding: '12px 24px', borderRadius: 100, border: 'none', background: 'var(--accent)', color: 'var(--bg)', fontSize: 'var(--fs-label)', fontWeight: 700, cursor: 'pointer' }}>
                Создать категорию
              </button>
            )}
          </div>
        )}

        {list.map((c, i) => {
          const isMineOwn = c.owner_id === myId;
          const already = !!c.source_id ? false : addedSourceIds.has(c.id);
          return (
            <div key={c.id} className="alias-cat-card" style={{ animationDelay: Math.min(i, 14) * 35 + 'ms', display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, background: 'var(--surface-light)', border: '1px solid var(--border)', marginBottom: 10 }}>
              <div style={{ width: 50, height: 50, borderRadius: 14, background: 'var(--bg)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><GlyphIcon name={normalizeGlyph(c.emoji, 'archive')} size={28} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.words.length} {wordsPlural(c.words.length)}
                  {tab === 'mine' && (c.is_public ? ' · опубликована' : ' · приватная')}
                  {tab === 'community' && c.owner?.display_name ? ' · ' + c.owner.display_name : ''}
                </div>
              </div>
              {tab === 'mine' ? (
                <button onClick={() => { haptic.tap(); nav('/alias/category/' + c.id); }} className="alias-btn-press" style={{ width: 38, height: 38, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                </button>
              ) : isMineOwn ? (
                <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', fontWeight: 600, padding: '0 6px', flexShrink: 0 }}>ваша</span>
              ) : already ? (
                <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--accent)', fontWeight: 700, padding: '0 6px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  есть
                </span>
              ) : (
                <button onClick={() => handleAdd(c)} disabled={adding === c.id} className="alias-btn-press" style={{ padding: '9px 14px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: 'var(--bg)', fontSize: 'var(--fs-label)', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                  {adding === c.id ? '…' : '+ Себе'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
