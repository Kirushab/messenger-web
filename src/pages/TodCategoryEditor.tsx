import { useState, useMemo, useEffect } from 'react';
import { goBack } from '@/lib/nav';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useTodCategoriesStore, parseLines } from '@/stores/todCategoriesStore';
import { haptic } from '@/lib/haptics';
import { toast } from '@/stores/toastStore';
import { GlyphIcon, normalizeGlyph } from '@/components/icons/AppGlyph';

const ICON_CHOICES = ['dice','flame','party','cards','target','users','smile','chili','music','deck','bottle','trophy','globe','heart','random','confetti'] as const;

function plural(n: number, forms: [string, string, string]): string {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return forms[0];
  if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return forms[1];
  return forms[2];
}

const TRUTH_COLOR = '#3B82F6';
const DARE_COLOR = '#F97316';

function PromptField({ label, text, onChange, accent, placeholder }: { label: string; text: string; onChange: (t: string) => void; accent: string; placeholder: string }) {
  const items = parseLines(text);
  const remove = (idx: number) => { haptic.tap(); onChange(items.filter((_, i) => i !== idx).join('\n')); };
  return (
    <div className="game-create-section" style={{ marginBottom: 18 }}>
      <div className="game-create-rowhead">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: accent, boxShadow: `0 0 0 4px ${accent}22` }} />
          <div className="game-create-label">{label}</div>
        </div>
        <div className="game-create-counter" style={{ color: items.length ? accent : 'var(--muted)' }}>{items.length}</div>
      </div>
      <textarea value={text} onChange={e => onChange(e.target.value)} rows={4} placeholder={placeholder} className="game-create-textarea" />
      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {items.map((it, i) => (
            <div key={i} className="tod-line game-prompt-pill" style={{ animationDelay: Math.min(i, 16) * 22 + 'ms' }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-label)', color: 'var(--text)' }}>{it}</span>
              <button onClick={() => remove(i)} style={{ border: 'none', background: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 'var(--fs-body)', lineHeight: 1, padding: 4, flexShrink: 0 }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TodCategoryEditor() {
  const nav = useNavigate();
  const { id } = useParams();
  const { session } = useAuthStore();
  const myId = session?.user?.id;
  const { mine, createCategory, updateCategory, deleteCategory } = useTodCategoriesStore();
  const editing = mine.find(c => c.id === id);

  const [emoji, setEmoji] = useState(normalizeGlyph(editing?.emoji, 'dice'));
  const [title, setTitle] = useState(editing?.title || '');
  const [truthsText, setTruthsText] = useState(editing ? editing.truths.join('\n') : '');
  const [daresText, setDaresText] = useState(editing ? editing.dares.join('\n') : '');
  const [isPublic, setIsPublic] = useState(editing?.is_public || false);
  const [rating, setRating] = useState<'mild' | 'spicy'>(editing?.rating || 'mild');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (id && editing) {
      setEmoji(normalizeGlyph(editing.emoji, 'dice'));
      setTitle(editing.title);
      setTruthsText(editing.truths.join('\n'));
      setDaresText(editing.dares.join('\n'));
      setIsPublic(editing.is_public);
      setRating(editing.rating || 'mild');
    }
  }, [id, editing]);

  const truths = useMemo(() => parseLines(truthsText), [truthsText]);
  const dares = useMemo(() => parseLines(daresText), [daresText]);
  const total = truths.length + dares.length;
  const canSave = title.trim().length > 0 && total > 0 && !saving;

  const handleSave = async () => {
    if (!canSave || !myId) return;
    setSaving(true);
    haptic.tap();
    if (editing) {
      const { error } = await updateCategory(editing.id, { title, emoji, rating, truths, dares, is_public: isPublic });
      setSaving(false);
      if (error) { toast.error('Ошибка: ' + error); return; }
      haptic.success();
      goBack(nav, '/tod/categories');
    } else {
      const { error } = await createCategory({ owner_id: myId, title, emoji, rating, truths, dares, is_public: isPublic });
      setSaving(false);
      if (error) { toast.error('Ошибка: ' + error); return; }
      haptic.success();
      goBack(nav, '/tod/categories');
    }
  };

  const handleDuplicate = async () => {
    if (!editing || !myId) return;
    haptic.tap();
    const { error } = await createCategory({ owner_id: myId, title: editing.title + ' (копия)', emoji: editing.emoji, rating: editing.rating, truths: editing.truths, dares: editing.dares, is_public: false });
    if (error) { toast.error('Ошибка: ' + error); return; }
    haptic.success();
    toast.success('Создана копия');
    goBack(nav, '/tod/categories');
  };

  const handleDelete = async () => {
    if (!editing) return;
    haptic.tap();
    const { error } = await deleteCategory(editing.id);
    if (error) { toast.error('Ошибка: ' + error); return; }
    haptic.success();
    goBack(nav, '/tod/categories');
  };

  return (
    <div className="game-create-page" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>
      <header className="safe-top game-create-header" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => { haptic.tap(); goBack(nav, '/tod/categories'); }} className="game-create-back" aria-label="Назад">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--fs-title)', fontWeight: 800, letterSpacing: '-0.02em' }}>{editing ? 'Редактировать категорию' : 'Новая категория'}</h1>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 2 }}>Truth or Dare · ваша собственная колода</div>
        </div>
      </header>

      <div className="page-scroll ce-form" style={{ padding: '18px 16px 30px', flex: 1 }}>
        <div className="game-create-shell" style={{ maxWidth: 760, margin: '0 auto' }}>
          <div className="game-create-hero game-create-hero-tod" style={{ marginBottom: 20 }}>
            <button onClick={() => { haptic.tap(); setEmojiOpen(o => !o); }} className="game-create-iconbtn alias-btn-press" type="button">
              <GlyphIcon name={normalizeGlyph(emoji, 'dice')} size={38} />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title || 'Название категории'}</div>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 4 }}>{truths.length} {plural(truths.length, ['правда', 'правды', 'правд'])} · {dares.length} {plural(dares.length, ['действие', 'действия', 'действий'])} · {isPublic ? 'в сообществе' : 'только у вас'}</div>
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
            <input value={title} onChange={e => setTitle(e.target.value)} maxLength={40} placeholder="Например: Для своих" className="game-create-input" />
          </div>

          <PromptField label="Правда" text={truthsText} onChange={setTruthsText} accent={TRUTH_COLOR}
            placeholder={'По одному вопросу на строку:\nКто тебе нравится?\nСамый неловкий момент?'} />
          <PromptField label="Действие" text={daresText} onChange={setDaresText} accent={DARE_COLOR}
            placeholder={'По одному заданию на строку:\nСпой припев песни\nИзобрази животное'} />

          <div className="game-create-section" style={{ marginBottom: 18 }}>
            <div className="game-create-label" style={{ marginBottom: 10 }}>Рейтинг</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => { haptic.select(); setRating('mild'); }} className="game-rating-pill" style={{ borderColor: rating === 'mild' ? TRUTH_COLOR : 'var(--border)', background: rating === 'mild' ? 'rgba(59,130,246,0.1)' : 'var(--surface-light)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'center', color: rating === 'mild' ? TRUTH_COLOR : 'var(--text)' }}><GlyphIcon name="smile" size={16} />Мягкая</span>
              </button>
              <button onClick={() => { haptic.select(); setRating('spicy'); }} className="game-rating-pill" style={{ borderColor: rating === 'spicy' ? DARE_COLOR : 'var(--border)', background: rating === 'spicy' ? 'rgba(249,115,22,0.1)' : 'var(--surface-light)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'center', color: rating === 'spicy' ? DARE_COLOR : 'var(--text)' }}><GlyphIcon name="chili" size={16} />Острая</span>
              </button>
            </div>
            <div className="game-create-caption">Острые категории можно скрыть в настройке игры.</div>
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
            <div className="game-create-hint">{title.trim().length === 0 ? 'Введите название' : 'Добавьте хотя бы одну правду или действие'}</div>
          )}

          {editing && (
            <button onClick={handleDuplicate} className="game-create-secondary alias-btn-press" style={{ marginTop: 12 }}>Дублировать</button>
          )}
          {editing && !confirmDel && (
            <button onClick={() => { haptic.tap(); setConfirmDel(true); }} className="game-create-secondary" style={{ marginTop: 12, color: '#ef4444' }}>Удалить категорию</button>
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
