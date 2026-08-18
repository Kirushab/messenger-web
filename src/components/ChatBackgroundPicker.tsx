import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/stores/toastStore';
import {
  BACKGROUND_PRESETS,
  resolveChatBackgroundPreview,
} from '@/lib/chatBackgrounds';

interface Props {
  // Текущее значение (builtin:xxx | URL | null)
  current: string | null;
  // Контекст — для глобального или для конкретного чата
  // Влияет только на текст подсказок и название кнопки "по умолчанию"
  context: 'global' | 'chat';
  userId: string;
  onClose: () => void;
  // Сохранение нового значения (null = убрать кастом, использовать default темы или global)
  onSave: (value: string | null) => Promise<void>;
}

export default function ChatBackgroundPicker({ current, context, userId, onClose, onSave }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingValue, setPendingValue] = useState<string | null>(current);
  const [saving, setSaving] = useState(false);

  const handleUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Файл слишком большой (макс 5 МБ)');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('chat-backgrounds')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (upErr) {
        setError(upErr.message);
        setUploading(false);
        return;
      }
      const { data } = supabase.storage.from('chat-backgrounds').getPublicUrl(path);
      setPendingValue(data.publicUrl);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const timeoutPromise = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 15000)
      );
      await Promise.race([onSave(pendingValue), timeoutPromise]);
      onClose();
    } catch (e) {
      toast.error('Не удалось применить фон. Попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} className="sheet-backdrop" style={{
      position:'fixed', inset:0, zIndex:60,
      background:'rgba(0,0,0,0.6)',
      display:'flex', alignItems:'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} className="sheet-content" style={{
        width:'100%',
        maxHeight:'90vh',
        background:'var(--surface)',
        borderRadius:'16px 16px 0 0',
        padding:'12px 16px max(20px, env(safe-area-inset-bottom, 20px))',
        overflowY:'auto',
        display:'flex',
        flexDirection:'column',
        WebkitOverflowScrolling: 'touch',
      }}>
        <div style={{display:'flex',justifyContent:'center',marginBottom:12}}>
          <div style={{width:36, height:4, borderRadius:2, background:'var(--border)'}} />
        </div>

        <h3 style={{fontSize: 'var(--fs-heading)', fontWeight:600, margin:'0 0 4px', color:'var(--text)'}}>
          {context === 'global' ? 'Фон по умолчанию' : 'Фон этого чата'}
        </h3>
        <p style={{fontSize: 'var(--fs-caption)', color:'var(--muted)', margin:'0 0 16px', lineHeight:1.4}}>
          Только вы видите этот фон. Собеседники видят свои.
          {context === 'chat' && ' Если выбрать «По умолчанию» — будет использован глобальный фон.'}
        </p>

        {/* Превью */}
        <div style={{
          width:'100%',
          aspectRatio:'16/10',
          borderRadius:14,
          background: resolveChatBackgroundPreview(pendingValue) || 'var(--bg)',
          marginBottom:16,
          position:'relative',
          overflow:'hidden',
          display:'flex',
          alignItems:'center',
          justifyContent:'center',
        }}>
          {/* Имитация двух пузырей */}
          <div style={{position:'absolute', inset:0, padding:16, display:'flex', flexDirection:'column', justifyContent:'flex-end', gap:6}}>
            <div style={{alignSelf:'flex-start', maxWidth:'70%', padding:'8px 12px', background:'rgba(80,80,90,0.85)', color:'#fff', borderRadius:14, fontSize: 'var(--fs-caption)', lineHeight:1.3}}>
              Привет!
            </div>
            <div style={{alignSelf:'flex-end', maxWidth:'70%', padding:'8px 12px', background:'#3B82F6', color:'#fff', borderRadius:14, fontSize: 'var(--fs-caption)', lineHeight:1.3}}>
              Так выглядит чат
            </div>
          </div>
        </div>

        {/* Опция "по умолчанию" — null */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10, marginBottom:16}}>
          <button
            onClick={() => setPendingValue(null)}
            style={preset_btn(pendingValue === null)}
            aria-label="По умолчанию"
          >
            <div style={{
              width:'100%', aspectRatio:'1/1',
              borderRadius:10,
              background: 'var(--bg)',
              border:'1px dashed var(--border)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize: 'var(--fs-micro)', color:'var(--muted)',
              padding:4,
              textAlign:'center',
            }}>{context === 'global' ? 'Дефолт' : 'Глобальный'}</div>
            <span style={preset_label}>{context === 'global' ? 'По умолч.' : 'Глобальный'}</span>
          </button>

          {BACKGROUND_PRESETS.map(p => {
            const value = `builtin:${p.id}`;
            return (
              <button
                key={p.id}
                onClick={() => setPendingValue(value)}
                style={preset_btn(pendingValue === value)}
                aria-label={p.label}
              >
                <div style={{
                  width:'100%', aspectRatio:'1/1',
                  borderRadius:10,
                  background: p.preview,
                }} />
                <span style={preset_label}>{p.label}</span>
              </button>
            );
          })}

          {/* Кастомный (загруженный) — отдельный preview если pendingValue это URL */}
          {pendingValue && (pendingValue.startsWith('http://') || pendingValue.startsWith('https://')) && (
            <button
              onClick={() => {/* уже выбран */}}
              style={preset_btn(true)}
              aria-label="Своя"
            >
              <div style={{
                width:'100%', aspectRatio:'1/1',
                borderRadius:10,
                background: `url("${pendingValue}") center/cover no-repeat`,
              }} />
              <span style={preset_label}>Своя</span>
            </button>
          )}
        </div>

        {/* Загрузить свою */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
          style={{display:'none'}}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading || saving}
          style={{
            padding:'12px',
            background:'var(--surface-light)',
            border:'1px solid var(--border)',
            borderRadius:10,
            color:'var(--text)',
            fontSize: 'var(--fs-snap14)',
            fontWeight:500,
            cursor: uploading ? 'default' : 'pointer',
            marginBottom:12,
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          }}
        >
          {uploading ? 'Загрузка...' : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              Загрузить свою картинку
            </>
          )}
        </button>

        {error && (
          <div style={{
            background:'rgba(239,68,68,0.1)', color:'#EF4444',
            padding:'10px 12px', borderRadius:8, fontSize: 'var(--fs-label)', marginBottom:12,
          }}>{error}</div>
        )}

        <div style={{display:'flex', gap:8}}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              flex:1, padding:'12px',
              background:'var(--surface-light)',
              border:'1px solid var(--border)',
              borderRadius:10, color:'var(--text)',
              fontSize: 'var(--fs-snap14)', fontWeight:500, cursor:'pointer',
            }}
          >Отмена</button>
          <button
            onClick={handleSave}
            disabled={saving || uploading}
            style={{
              flex:2, padding:'12px',
              background:'var(--primary)',
              border:'none', borderRadius:10,
              color:'var(--bg)',
              fontSize: 'var(--fs-snap14)', fontWeight:600,
              cursor: saving ? 'default' : 'pointer',
            }}
          >{saving ? 'Сохраняем...' : 'Применить'}</button>
        </div>
      </div>
    </div>
  );
}

const preset_btn = (active: boolean): React.CSSProperties => ({
  background:'none',
  border:'none',
  padding:0,
  cursor:'pointer',
  display:'flex',
  flexDirection:'column',
  alignItems:'center',
  gap:4,
  outline: active ? '2px solid var(--primary)' : 'none',
  outlineOffset: 3,
  borderRadius: 12,
});

const preset_label: React.CSSProperties = {
  fontSize: 'var(--fs-snap10)',
  color:'var(--muted)',
  fontWeight:500,
  textAlign:'center',
};
