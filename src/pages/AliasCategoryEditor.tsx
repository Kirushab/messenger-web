import { useState, useMemo, useEffect } from 'react';
import { goBack } from '@/lib/nav';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useAliasCategoriesStore, parseWords } from '@/stores/aliasCategoriesStore';
import { haptic } from '@/lib/haptics';
import { toast } from '@/stores/toastStore';
import { GlyphIcon, normalizeGlyph } from '@/components/icons/AppGlyph';

const ICON_CHOICES = ['archive','car','cards','music','sport','pizza','dog','globe','deck','home','star','tool','flame','art','book','relax','plane','puzzle','target','trophy','chili','dice','robot','shield','party','mic'] as const;

function wordsPlural(n: number): string {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return 'слово';
  if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return 'слова';
  return 'слов';
}

export default function AliasCategoryEditor() {
  const nav = useNavigate();
  const { id } = useParams();
  const { session } = useAuthStore();
  const myId = session?.user?.id;
  const { mine, createCategory, updateCategory, deleteCategory } = useAliasCategoriesStore();
  const editing = mine.find(c => c.id === id);

  const [emoji, setEmoji] = useState(normalizeGlyph(editing?.emoji, 'archive'));
  const [title, setTitle] = useState(editing?.title || '');
  const [wordsText, setWordsText] = useState(editing ? editing.words.join('\n') : '');
  const [isPublic, setIsPublic] = useState(editing?.is_public || false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (id && editing) {
      setEmoji(normalizeGlyph(editing.emoji, 'archive'));
      setTitle(editing.title);
      setWordsText(editing.words.join('\n'));
      setIsPublic(editing.is_public);
    }
  }, [id, editing]);

  const words = useMemo(() => parseWords(wordsText), [wordsText]);
  const canSave = title.trim().length > 0 && words.length > 0 && !saving;

  const removeWord = (w: string) => {
    haptic.tap();
    setWordsText(words.filter(x => x !== w).join('\n'));
  };

  const handleSave = async () => {
    if (!canSave || !myId) return;
    setSaving(true);
    haptic.tap();
    if (editing) {
      const { error } = await updateCategory(editing.id, { title, emoji, words, is_public: isPublic });
      setSaving(false);
      if (error) { toast.error('Ошибка: ' + error); return; }
      haptic.success();
      goBack(nav, '/alias/categories');
    } else {
      const { error } = await createCategory({ owner_id: myId, title, emoji, words, is_public: isPublic });
      setSaving(false);
      if (error) { toast.error('Ошибка: ' + error); return; }
      haptic.success();
      goBack(nav, '/alias/categories');
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    haptic.tap();
    const { error } = await deleteCategory(editing.id);
    if (error) { toast.error('Ошибка: ' + error); return; }
    haptic.success();
    goBack(nav, '/alias/categories');
  };

  return (
    <div className="game-create-page" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>
      <header className="safe-top game-create-header" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => { haptic.tap(); goBack(nav, '/alias/categories'); }} className="game-create-back" aria-label="Назад">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--fs-title)', fontWeight: 800, letterSpacing: '-0.02em' }}>{editing ? 'Редактировать категорию' : 'Новая категория'}</h1>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 2 }}>Crocodile · собственный набор слов</div>
        </div>
      </header>

      <div className="page-scroll ce-form" style={{ padding: '18px 16px 30px', flex: 1 }}>
        <div className="game-create-shell" style={{ maxWidth: 760, margin: '0 auto' }}>
          <div className="game-create-hero" style={{ marginBottom: 20 }}>
            <button onClick={() => { haptic.tap(); setEmojiOpen(o => !o); }} className="game-create-iconbtn alias-btn-press" type="button">
              <GlyphIcon name={normalizeGlyph(emoji, 'archive')} size={38} />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title || 'Название категории'}</div>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 4 }}>{words.length} {wordsPlural(words.length)} · {isPublic ? 'доступна в сообществе' : 'только у вас'}</div>
            </div>
          </div>

          {emojiOpen && (
            <div className="game-create-section" style={{ marginBottom: 20 }}>
              <div className="game-create-label">Иконка</div>
              <div className="game-icon-grid">
                {ICON_CHOICES.map(e => (
                  <button key={e} onClick={() => { haptic.select(); setEmoji(e); setEmojiOpen(false); }} className="game-icon-choice" style={{ background: emoji === e ? 'var(--accent)' : 'var(--surface-light)', color: emoji === e ? 'var(--bg)' : 'var(--text)' }}>
                    <GlyphIcon name={e} size={22} />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="game-create-section" style={{ marginBottom: 18 }}>
            <div className="game-create-rowhead"><div className="game-create-label">Название</div></div>
            <input value={title} onChange={e => setTitle(e.target.value)} maxLength={40} placeholder="Например: Машины" className="game-create-input" />
          </div>

          <div className="game-create-section" style={{ marginBottom: 18 }}>
            <div className="game-create-rowhead">
              <div className="game-create-label">Слова</div>
              <div className="game-create-counter" style={{ color: words.length ? 'var(--accent)' : 'var(--muted)' }}>{words.length}</div>
            </div>
            <textarea value={wordsText} onChange={e => setWordsText(e.target.value)} rows={5} className="game-create-textarea"
              placeholder={'Вставьте списком — через запятую, ; или с новой строки:\nФеррари; Ягуар; Мерседес'} />
            {words.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {words.map((w, i) => (
                  <button key={w} onClick={() => removeWord(w)} className="alias-chip game-word-chip" style={{ animationDelay: Math.min(i, 20) * 20 + 'ms' }}>
                    <span>{w}</span>
                    <span style={{ opacity: 0.52, fontSize: 'var(--fs-body)', lineHeight: 1 }}>×</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => { haptic.tap(); setIsPublic(p => !p); }} className="game-create-toggle alias-btn-press" type="button" style={{ marginBottom: 22 }}>
            <div className="game-create-toggleIcon"><GlyphIcon name="globe" size={22} /></div>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <div style={{ fontSize: 'var(--fs-label)', fontWeight: 700, color: 'var(--text)' }}>Опубликовать в Сообществе</div>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 2 }}>Другие игроки смогут найти и добавить себе</div>
            </div>
            <div className="game-create-switch" style={{ background: isPublic ? 'var(--accent)' : 'var(--border)' }}>
              <div className="game-create-switchKnob" style={{ left: isPublic ? 21 : 3 }} />
            </div>
          </button>

          <button onClick={handleSave} disabled={!canSave} className="game-create-primary alias-btn-press">
            {saving ? <><span className="anim-spin" style={{ display: 'inline-block' }}>↻</span> Сохраняем…</> : (editing ? 'Сохранить категорию' : 'Создать категорию')}
          </button>
          {!canSave && !saving && (
            <div className="game-create-hint">{title.trim().length === 0 ? 'Введите название' : 'Добавьте хотя бы одно слово'}</div>
          )}

          {editing && !confirmDel && (
            <button onClick={() => { haptic.tap(); setConfirmDel(true); }} className="game-create-secondary" style={{ marginTop: 12, color: '#ef4444' }}>
              Удалить категорию
            </button>
          )}
          {editing && confirmDel && (
            <div className="anim-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
              <button onClick={() => { haptic.tap(); setConfirmDel(false); }} className="game-create-secondary">Отмена</button>
              <button onClick={handleDelete} className="game-create-danger alias-btn-press">Удалить</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
