import { useEffect, useMemo, useState } from 'react';
import { goBack } from '@/lib/nav';
import { useNavigate, useParams } from 'react-router-dom';
import { useVocabSetsStore, type VocabPair } from '@/stores/vocabSetsStore';
import { haptic } from '@/lib/haptics';
import { toast } from '@/stores/toastStore';
import { GlyphIcon, normalizeGlyph } from '@/components/icons/AppGlyph';

const ICON_CHOICES = [
  ['folder', 'Общее'], ['book', 'Учёба'], ['apple', 'Еда'], ['plane', 'Путешествие'],
  ['briefcase', 'Работа'], ['home', 'Дом'], ['numbers', 'Числа'], ['hand', 'Фразы'],
  ['heart', 'Чувства'], ['music', 'Музыка'], ['sport', 'Спорт'], ['art', 'Искусство'],
  ['pizza', 'Кафе'], ['dog', 'Животные'], ['globe', 'Мир'], ['laptop', 'Технологии'],
] as const;
const LANGS: [string, string][] = [['en', 'EN'], ['it', 'IT'], ['es', 'ES'], ['de', 'DE'], ['fr', 'FR']];

function parsePairs(text: string): VocabPair[] {
  const out: VocabPair[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.split(/\s+[-—=]\s+|\t/);
    const term = (m[0] || '').trim();
    const tr = (m[1] || '').trim();
    if (term && tr) out.push({ term, tr });
  }
  return out;
}

export default function VocabSetEditor() {
  const nav = useNavigate();
  const { id } = useParams<{ id: string }>();
  const editing = !!id;
  const { getSet, createSet, updateSet } = useVocabSetsStore();

  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('folder');
  const [language, setLanguage] = useState('en');
  const [text, setText] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    let alive = true;
    (async () => {
      const s = await getSet(id!);
      if (!alive || !s) { if (alive) setLoading(false); return; }
      setTitle(s.title); setIcon(normalizeGlyph(s.emoji)); setLanguage(s.language); setIsPublic(s.is_public);
      setText(s.pairs.map(p => `${p.term} - ${p.tr}`).join('\n'));
      setLoading(false);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const pairs = useMemo(() => parsePairs(text), [text]);
  const canSave = title.trim().length > 0 && pairs.length > 0 && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    haptic.tap();
    if (editing) {
      await updateSet(id!, { title: title.trim(), emoji: icon, language, pairs, is_public: isPublic });
      toast.success('Сохранено');
    } else {
      const r = await createSet({ title: title.trim(), emoji: icon, language, pairs, is_public: isPublic });
      if (!r) { setSaving(false); toast.error('Не удалось сохранить'); return; }
      toast.success('Набор создан');
    }
    goBack(nav, '/languages');
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)' }}>
      <span className="anim-spin" style={{ display: 'inline-block', fontSize: 'var(--fs-snap24)' }}>↻</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header className="safe-top" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <button onClick={() => { haptic.tap(); goBack(nav, '/languages'); }} style={{ width: 36, height: 36, borderRadius: 18, border: 'none', background: 'var(--surface-light)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 'var(--fw-semibold, 600)' }}>{editing ? 'Изменить набор' : 'Новый набор'}</div>
        <button onClick={save} disabled={!canSave} style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 18, border: 'none', background: canSave ? 'var(--accent)' : 'var(--surface-light)', color: canSave ? 'var(--bg)' : 'var(--muted)', cursor: canSave ? 'pointer' : 'default', fontSize: 'var(--fs-snap14)', fontWeight: 700, flexShrink: 0 }}>Сохранить</button>
      </header>

      <div className="page-scroll" style={{ padding: 16 }}>
        <div className="ce-form" style={{ maxWidth: 520, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="ce-block">
            <label style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Название</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Например: Еда в ресторане" maxLength={60}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: 'var(--fs-body)', boxSizing: 'border-box' }} />
          </div>

          <div className="ce-block">
            <label style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', display: 'block', marginBottom: 8 }}>Иконка</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {ICON_CHOICES.map(([name, label]) => (
                <button key={name} onClick={() => { haptic.select(); setIcon(name); }} style={{
                  minHeight: 58, borderRadius: 14, cursor: 'pointer',
                  border: '2px solid', borderColor: icon === name ? 'var(--accent)' : 'transparent',
                  background: icon === name ? 'rgba(16,185,129,0.12)' : 'var(--surface-light)',
                  color: icon === name ? 'var(--accent)' : 'var(--text)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}>
                  <GlyphIcon name={name} size={22} />
                  <span style={{ fontSize: 'var(--fs-micro)', fontWeight: 700 }}>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="ce-block">
            <label style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', display: 'block', marginBottom: 8 }}>Язык (для озвучки)</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {LANGS.map(([code, label]) => (
                <button key={code} onClick={() => { haptic.select(); setLanguage(code); }} style={{
                  padding: '8px 14px', borderRadius: 12, cursor: 'pointer', fontSize: 'var(--fs-label)', fontWeight: 600,
                  border: '2px solid', borderColor: language === code ? 'var(--accent)' : 'var(--border)',
                  background: language === code ? 'rgba(16,185,129,0.12)' : 'var(--surface-light)', color: 'var(--text)',
                }}>{label}</button>
              ))}
            </div>
          </div>

          <div className="ce-block">
            <label style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
              Слова — по одному в строке: <b style={{ color: 'var(--text)' }}>слово - перевод</b>
            </label>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={8}
              placeholder={'casa - дом\nacqua - вода\ngrazie - спасибо'}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: 'var(--fs-body)', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5 }} />
            <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', marginTop: 6 }}>Распознано пар: <b style={{ color: pairs.length > 0 ? 'var(--accent)' : 'var(--muted)' }}>{pairs.length}</b></div>
          </div>

          <button onClick={() => { haptic.tap(); setIsPublic(p => !p); }} className="ce-block" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ color: 'var(--text2)', display: 'flex', alignItems: 'center' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text)' }}>Опубликовать в «Сообщество»</div>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 2 }}>Другие смогут найти и скопировать набор</div>
            </div>
            <div style={{ width: 46, height: 28, borderRadius: 14, background: isPublic ? 'var(--accent)' : 'var(--border)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 3, left: isPublic ? 21 : 3, width: 22, height: 22, borderRadius: 11, background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
