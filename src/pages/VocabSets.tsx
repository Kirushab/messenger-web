import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVocabSetsStore, type VocabSet } from '@/stores/vocabSetsStore';
import { haptic } from '@/lib/haptics';
import { toast } from '@/stores/toastStore';
import ErrorRetry from '@/components/ErrorRetry';
import { GlyphIcon, normalizeGlyph } from '@/components/icons/AppGlyph';

const LANG_LABEL: Record<string, string> = { en: 'EN', it: 'IT', es: 'ES', de: 'DE', fr: 'FR' };

export default function VocabSets() {
  const nav = useNavigate();
  const { mine, community, loadingMine, loadingCommunity, errorMine, loadMine, loadCommunity, copySet, deleteSet } = useVocabSetsStore();
  const [tab, setTab] = useState<'mine' | 'community'>('mine');

  useEffect(() => { loadMine(); loadCommunity(); /* eslint-disable-next-line */ }, []);

  const doCopy = async (s: VocabSet) => {
    haptic.tap();
    const r = await copySet(s);
    if (r) { toast.success('Набор скопирован в «Мои»'); setTab('mine'); }
    else toast.error('Не удалось скопировать');
  };

  const doDelete = async (s: VocabSet) => {
    if (!confirm(`Удалить набор «${s.title}»?`)) return;
    haptic.tap();
    await deleteSet(s.id);
    toast.info('Набор удалён');
  };

  const list = tab === 'mine' ? mine : community;
  const loading = tab === 'mine' ? loadingMine : loadingCommunity;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header className="safe-top" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <button onClick={() => { haptic.tap(); nav(-1); }} style={{ width: 36, height: 36, borderRadius: 18, border: 'none', background: 'var(--surface-light)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 'var(--fw-semibold, 600)', display: 'flex', alignItems: 'center', gap: 8 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z"/></svg>Свои наборы</div>
        <button onClick={() => { haptic.tap(); nav('/vocab/new'); }} aria-label="Создать" style={{ marginLeft: 'auto', width: 36, height: 36, borderRadius: 18, border: 'none', background: 'var(--accent)', color: 'var(--bg)', cursor: 'pointer', fontSize: 'var(--fs-title)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg></button>
      </header>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {([['mine', 'Мои'], ['community', 'Сообщество']] as [typeof tab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => { haptic.tap(); setTab(id); }} style={{
            flex: 1, padding: '12px 8px', background: 'none', border: 'none',
            color: tab === id ? 'var(--accent)' : 'var(--muted)',
            borderBottom: tab === id ? '2px solid var(--accent)' : '2px solid transparent',
            fontSize: 'var(--fs-snap14)', fontWeight: 600, cursor: 'pointer',
          }}>{label}</button>
        ))}
      </div>

      <div className="page-scroll" style={{ padding: 16 }}>
        <div className="edu-cascade" style={{ maxWidth: 520, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tab === 'mine' && errorMine && mine.length === 0 ? (
            <ErrorRetry onRetry={loadMine} text="Не удалось загрузить наборы" />
          ) : loading && list.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>
              <span className="anim-spin" style={{ display: 'inline-block', fontSize: 'var(--fs-snap24)' }}>↻</span>
            </div>
          ) : list.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center', color: 'var(--muted)' }}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z"/></svg></div>
              <div style={{ fontSize: 'var(--fs-snap16)', fontWeight: 600, color: 'var(--text)' }}>
                {tab === 'mine' ? 'Пока нет своих наборов' : 'В сообществе пусто'}
              </div>
              <div style={{ fontSize: 'var(--fs-snap14)', marginTop: 4 }}>
                {tab === 'mine' ? 'Создай набор кнопкой + вверху.' : 'Поделись своим — он появится здесь.'}
              </div>
            </div>
          ) : (
            list.map(s => (
              <div key={s.id} className="edu-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface-2)', boxShadow: 'var(--shadow-1)' }}>
                <button onClick={() => { haptic.tap(); nav(`/vocab/${s.id}`); }} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 14, background: 'var(--surface-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><GlyphIcon name={normalizeGlyph(s.emoji)} size={24} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 2 }}>
                      {LANG_LABEL[s.language] || 'LANG'} · {s.pairs.length} {s.pairs.length === 1 ? 'слово' : s.pairs.length < 5 ? 'слова' : 'слов'}
                      {tab === 'mine' && s.is_public && <span style={{ color: 'var(--accent)', marginLeft: 6 }}>· опубликован</span>}
                    </div>
                  </div>
                </button>
                {tab === 'mine' ? (
                  <>
                    <button onClick={() => { haptic.tap(); nav(`/vocab/${s.id}/edit`); }} aria-label="Изменить" style={{ width: 34, height: 34, borderRadius: 17, border: '1px solid var(--border)', background: 'var(--surface-light)', color: 'var(--text)', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
                    <button onClick={() => doDelete(s)} aria-label="Удалить" style={{ width: 34, height: 34, borderRadius: 17, border: '1px solid var(--border)', background: 'var(--surface-light)', color: '#EF4444', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                  </>
                ) : (
                  <button onClick={() => doCopy(s)} aria-label="Скопировать" className="alias-btn-press" style={{ padding: '8px 12px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: 'var(--bg)', cursor: 'pointer', flexShrink: 0, fontSize: 'var(--fs-label)', fontWeight: 700 }}>Копировать</button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
