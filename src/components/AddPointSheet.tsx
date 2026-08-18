import { useState } from 'react';
import { useMapPointsStore, POINT_CATEGORIES, categoryColor, type MapPoint } from '@/stores/mapPointsStore';
import { avatarColor } from '@/lib/utils';
import { uploadMapPointPhoto } from '@/lib/storage';
import { haptic } from '@/lib/haptics';
import { CategoryIcon } from '@/lib/categoryIcons';

interface UserLite { id: string; display_name: string; avatar_url: string | null; }

interface Props {
  coords: { lng: number; lat: number };
  myId: string;
  users: UserLite[];
  editPoint?: MapPoint | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function AddPointSheet({ coords, myId, users, editPoint, onClose, onSaved }: Props) {
  const { create, update } = useMapPointsStore();
  const isEdit = !!editPoint;
  const [title, setTitle] = useState(editPoint?.title ?? '');
  const [icon, setIcon] = useState(editPoint?.icon ?? editPoint?.category ?? 'place');
  const [category, setCategory] = useState<string>(editPoint?.category ?? 'place');
  const [visibility, setVisibility] = useState<'all' | 'custom'>(editPoint?.visibility ?? 'all');
  const [selected, setSelected] = useState<Set<string>>(new Set(editPoint?.allowed_ids ?? []));
  const [note, setNote] = useState(editPoint?.note ?? '');
  const [photoUrl, setPhotoUrl] = useState<string | null>(editPoint?.photo_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { alert('Фото слишком большое (макс 8 МБ)'); return; }
    setUploading(true);
    const { url, error } = await uploadMapPointPhoto(myId, file);
    setUploading(false);
    if (error) { alert('Не удалось загрузить фото: ' + error); return; }
    haptic.tap();
    setPhotoUrl(url);
  };

  const others = users.filter(u => u.id !== myId);
  const toggle = (id: string) => setSelected(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const pickCategory = (key: string) => {
    setCategory(key);
    const c = POINT_CATEGORIES.find(c => c.key === key);
    if (c) setIcon(c.key);
  };

  const save = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    const payload = { title: title.trim(), icon, visibility, allowed_ids: Array.from(selected), category, photo_url: photoUrl, note: note.trim() || null };
    const { error } = isEdit
      ? await update(editPoint!.id, payload)
      : await create({ created_by: myId, lng: coords.lng, lat: coords.lat, ...payload });
    setSaving(false);
    if (error) { alert('Не удалось сохранить: ' + error); return; }
    haptic.success();
    onSaved();
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} className="share-sheet-enter" style={{
        width: '100%', maxHeight: '85vh', overflowY: 'auto',
        background: 'var(--bg)', color: 'var(--text)',
        borderRadius: 'var(--r-xl) var(--r-xl) 0 0',
        padding: 'var(--sp-3) var(--sp-4) max(var(--sp-5), env(safe-area-inset-bottom, 20px))',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--sp-3)' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)' }} />
        </div>

        <h3 style={{ margin: '0 0 var(--sp-4)', fontSize: 'var(--fs-title)', fontWeight: 'var(--fw-bold)' }}>{isEdit ? 'Изменить точку' : 'Новая точка'}</h3>

        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Название"
          autoFocus={!isEdit}
          style={{ marginBottom: 'var(--sp-4)' }}
        />

        {/* Категория (задаёт цвет пина) */}
        <div style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', marginBottom: 'var(--sp-2)' }}>Категория</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
          {POINT_CATEGORIES.map(c => {
            const on = category === c.key;
            return (
              <button key={c.key} onClick={() => pickCategory(c.key)} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 'var(--pill)', cursor: 'pointer',
                fontSize: 'var(--fs-label)', fontWeight: 600,
                border: '2px solid ' + (on ? c.color : 'var(--border)'),
                background: on ? c.color + '22' : 'var(--surface-light)',
                color: 'var(--text)',
              }}><CategoryIcon category={c.key} size={15} color={c.color} />{c.label}</button>
            );
          })}
        </div>

        {/* Фото и заметка */}
        <div style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', marginBottom: 'var(--sp-2)' }}>Фото и заметка</div>
        {photoUrl ? (
          <div style={{ position: 'relative', marginBottom: 'var(--sp-3)' }}>
            <img src={photoUrl} alt="" style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 'var(--r-lg)', display: 'block' }} />
            <button onClick={() => setPhotoUrl(null)} aria-label="Убрать фото" style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-body)' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button>
          </div>
        ) : (
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 64, marginBottom: 'var(--sp-3)', borderRadius: 'var(--r-lg)', border: '1px dashed var(--border)', background: 'var(--surface-light)', color: 'var(--muted)', cursor: 'pointer', fontSize: 'var(--fs-label)', fontWeight: 600 }}>
            {uploading ? 'Загрузка…' : (<><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>Добавить фото</>)}
            <input type="file" accept="image/*" onChange={onPickPhoto} disabled={uploading} style={{ display: 'none' }} />
          </label>
        )}
        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Заметка (необязательно)" rows={2} style={{ width: '100%', resize: 'none', marginBottom: 'var(--sp-4)', fontFamily: 'inherit', background: 'var(--surface-light)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '10px 12px', color: 'var(--text)', fontSize: 'var(--fs-body)' }} />

        {/* Видимость */}
        <div style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', marginBottom: 'var(--sp-2)' }}>Кому видно</div>
        <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
          {([['all', 'Всем'], ['custom', 'Выбрать людей']] as const).map(([v, label]) => (
            <button key={v} onClick={() => setVisibility(v)} style={{
              flex: 1, padding: '10px', borderRadius: 'var(--r-md)', cursor: 'pointer',
              fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-semibold)',
              border: '1px solid ' + (visibility === v ? 'transparent' : 'var(--border)'),
              background: visibility === v ? 'var(--text)' : 'var(--surface-light)',
              color: visibility === v ? 'var(--bg)' : 'var(--text)',
            }}>{label}</button>
          ))}
        </div>

        {visibility === 'custom' && (
          <div style={{ marginBottom: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
            {others.length === 0 && <div style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', padding: 'var(--sp-2)' }}>Нет пользователей</div>}
            {others.map(u => {
              const on = selected.has(u.id);
              return (
                <button key={u.id} onClick={() => toggle(u.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-2)',
                  borderRadius: 'var(--r-md)', border: 'none', cursor: 'pointer',
                  background: on ? 'var(--surface-light)' : 'transparent', textAlign: 'left',
                }}>
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt="" style={{ width: 34, height: 34, borderRadius: 17, objectFit: 'cover' }} />
                    : <div style={{ width: 34, height: 34, borderRadius: 17, background: avatarColor(u.id), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-snap14)', fontWeight: 600 }}>{u.display_name?.[0]?.toUpperCase()}</div>}
                  <span style={{ flex: 1, fontSize: 'var(--fs-body)', color: 'var(--text)' }}>{u.display_name}</span>
                  <span style={{
                    width: 22, height: 22, borderRadius: 11, flexShrink: 0,
                    border: '2px solid ' + (on ? 'var(--text)' : 'var(--border)'),
                    background: on ? 'var(--text)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {on && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <button onClick={save} disabled={!title.trim() || saving} style={{
          width: '100%', padding: 14, borderRadius: 'var(--r-lg)', border: 'none',
          background: title.trim() ? 'var(--accent)' : 'var(--surface-light)',
          color: title.trim() ? 'var(--bg)' : 'var(--muted)',
          fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-bold)',
          cursor: title.trim() ? 'pointer' : 'default', opacity: saving ? 0.6 : 1,
        }}>{saving ? 'Сохранение…' : (isEdit ? 'Сохранить' : 'Добавить точку')}</button>
      </div>
    </div>
  );
}
