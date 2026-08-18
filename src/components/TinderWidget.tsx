// Создание тиндер-виджета: выбираем фото (можно несколько), описание —
// в чат прилетает ПОЛНОЦЕННЫЙ интерактивный виджет (свайп/лайки/комменты),
// который рендерит TinderBetCard по маркеру [TINDER_BET:id].
// Раньше слался статичный [TINDER:] (маленькая картинка) — он убран.
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/stores/toastStore';
import { haptic } from '@/lib/haptics';
import { useChatStore } from '@/stores/chatStore';

interface Props {
  conversationId: string;
  userId: string;
  onClose: () => void;
  onSent?: () => void;
}

const MAX_PHOTOS = 10;

export default function TinderWidget({ conversationId, userId, onClose, onSent }: Props) {
  const [shown, setShown] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [sending, setSending] = useState(false);
  const sendWidgetMessage = useChatStore(s => s.sendWidgetMessage);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragY, setDragY] = useState(0);
  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const thumbRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => { const t = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(t); }, []);
  useEffect(() => () => { previews.forEach(u => URL.revokeObjectURL(u)); }, [previews]);

  const close = () => { setShown(false); setTimeout(onClose, 220); };

  const addFiles = (fl: FileList | null) => {
    if (!fl) return;
    haptic.tap();
    const incoming = Array.from(fl).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    const merged = [...files, ...incoming].slice(0, MAX_PHOTOS);
    setFiles(merged);
    previews.forEach(u => URL.revokeObjectURL(u));
    setPreviews(merged.map(f => URL.createObjectURL(f)));
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeAt = (i: number) => {
    haptic.tap();
    const merged = files.filter((_, idx) => idx !== i);
    setFiles(merged);
    previews.forEach(u => URL.revokeObjectURL(u));
    setPreviews(merged.map(f => URL.createObjectURL(f)));
  };

  const send = async () => {
    if (sending || files.length === 0) return;
    setSending(true);
    try {
      // 1. Пост (автор = текущий юзер). Caption = описание.
      const { data: post, error: postErr } = await supabase
        .from('posts')
        .insert({ author_id: userId, caption: caption.trim(), is_tinder: true })
        .select()
        .single();
      if (postErr || !post) throw postErr || new Error('post insert failed');

      // 2. Загружаем все медиа в storage + post_media (position = порядок)
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const safeName = f.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const path = `${userId}/${post.id}/${i}_${safeName}`;
        const { error: upErr } = await supabase.storage
          .from('post-media')
          .upload(path, f, { contentType: f.type });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('post-media').getPublicUrl(path);
        const { error: mediaErr } = await supabase.from('post_media').insert({
          post_id: post.id,
          file_url: urlData.publicUrl,
          mime_type: f.type,
          position: i,
        });
        if (mediaErr) throw mediaErr;
      }

      // 3. Создаём бет через RPC (обложка = первая media). Длительность — большая.
      const { data: betData, error: betErr } = await supabase.rpc('create_tinder_bet', {
        conversation_id_param: conversationId,
        post_id_param: post.id,
        duration_minutes_param: 60 * 24 * 365,
        visible_bets_param: false,
      });
      if (betErr || !betData) throw betErr || new Error('bet creation failed');
      const betId = (betData as any).bet_id;

      // 4. Системное сообщение с маркером виджета
      const messageResult = await sendWidgetMessage(conversationId, userId, `[TINDER_BET:${betId}]`, 'system');
      if (messageResult.error) throw new Error(messageResult.error);
      if (messageResult.id) await supabase.from('tinder_bets').update({ message_id: messageResult.id }).eq('id', betId);

      haptic.success();
      onSent?.();
      close();
    } catch (e: any) {
      setSending(false);
      toast.error('Не получилось: ' + (e?.message || 'unknown'));
    }
  };

  // С2 — свайп вниз по граберу/шапке для закрытия
  const onGrabDown = (e: React.PointerEvent) => { draggingRef.current = true; startYRef.current = e.clientY; };
  const onGrabMove = (e: React.PointerEvent) => { if (!draggingRef.current) return; const dy = e.clientY - startYRef.current; if (dy > 0) setDragY(dy); };
  const onGrabUp = () => { if (!draggingRef.current) return; draggingRef.current = false; if (dragY > 110) { haptic.tap(); close(); } else setDragY(0); };

  // С4 — перетаскивание фото для смены порядка
  const reorder = (from: number, to: number) => {
    const f = [...files]; const [mf] = f.splice(from, 1); f.splice(to, 0, mf);
    const p = [...previews]; const [mp] = p.splice(from, 1); p.splice(to, 0, mp);
    setFiles(f); setPreviews(p);
  };
  const onThumbDown = (i: number, e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-rm]')) return;
    setDragIdx(i);
  };
  const onGridMove = (e: React.PointerEvent) => {
    if (dragIdx === null) return;
    let target = dragIdx;
    thumbRefs.current.forEach((el, idx) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) target = idx;
    });
    if (target !== dragIdx && target < files.length) { reorder(dragIdx, target); setDragIdx(target); haptic.tap(); }
  };
  const onGridUp = () => { if (dragIdx !== null) setDragIdx(null); };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.4)', opacity: shown ? 1 : 0, transition: 'opacity .2s' }} onClick={close}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute', inset: 0,
          background: 'var(--bg)', display: 'flex', flexDirection: 'column',
          transform: shown ? `translateY(${dragY}px)` : 'translateY(100%)',
          transition: draggingRef.current ? 'none' : 'transform .24s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Header + грабер (зона свайпа вниз, С2) */}
        <div onPointerDown={onGrabDown} onPointerMove={onGrabMove} onPointerUp={onGrabUp} onPointerCancel={onGrabUp} style={{ touchAction: 'none', paddingTop: 'env(safe-area-inset-top, 0)' }}>
          <div style={{ width: 38, height: 4, borderRadius: 2, background: 'var(--border)', margin: '8px auto 2px' }} />
          <header style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 16px 12px',
            borderBottom: '1px solid var(--border)',
          }}>
            <button onClick={close} aria-label="Закрыть" style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: 4, display: 'flex' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
            <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 700, flex: 1 }}>Тиндер-карточка</div>
          </header>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }} onChange={e => addFiles(e.target.files)} />

          {previews.length === 0 ? (
            <button onClick={() => fileRef.current?.click()} style={{
              width: '100%', aspectRatio: '3/4', maxHeight: 360, borderRadius: 16,
              border: '2px dashed var(--border)', background: 'var(--surface-light)',
              color: 'var(--muted)', cursor: 'pointer', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 'var(--fs-body)',
            }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
              Выбрать фото
              <span style={{ fontSize: 'var(--fs-caption)' }}>можно несколько · до {MAX_PHOTOS}</span>
            </button>
          ) : (
            <div>
              {/* Сетка превью: перетаскивание меняет порядок, ✕ убирает */}
              <div onPointerMove={onGridMove} onPointerUp={onGridUp} onPointerLeave={onGridUp} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, touchAction: dragIdx !== null ? 'none' : undefined }}>
                {previews.map((src, i) => {
                  const isVid = files[i]?.type.startsWith('video');
                  const dragging = dragIdx === i;
                  return (
                    <div key={i} ref={el => { thumbRefs.current[i] = el; }} onPointerDown={(e) => onThumbDown(i, e)} style={{
                      position: 'relative', aspectRatio: '1', borderRadius: 12, overflow: 'hidden', background: '#000',
                      cursor: 'grab', touchAction: 'none',
                      transform: dragging ? 'scale(1.08)' : 'none', opacity: dragging ? 0.85 : 1, zIndex: dragging ? 2 : 1,
                      boxShadow: dragging ? '0 8px 22px rgba(0,0,0,0.5)' : 'none',
                      transition: dragIdx === null ? 'transform .15s, opacity .15s, box-shadow .15s' : 'none',
                    }}>
                      {isVid
                        ? <video src={src} muted playsInline draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                        : <img src={src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />}
                      {i === 0 && <div style={{ position: 'absolute', left: 6, bottom: 6, padding: '2px 7px', borderRadius: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 'var(--fs-micro)', fontWeight: 700 }}>обложка</div>}
                      <button data-rm onClick={() => removeAt(i)} aria-label="Убрать" style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                      </button>
                    </div>
                  );
                })}
                {files.length < MAX_PHOTOS && (
                  <button onClick={() => fileRef.current?.click()} style={{ aspectRatio: '1', borderRadius: 12, border: '2px dashed var(--border)', background: 'var(--surface-light)', color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  </button>
                )}
              </div>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 8 }}>
                Первое фото — обложка. Перетащи, чтобы поменять порядок; в карточке листаются тапом по краям.
              </div>
            </div>
          )}

          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Описание (необязательно)"
            rows={3}
            style={{
              width: '100%', resize: 'none', padding: '12px 14px', fontSize: 'var(--fs-body)',
              background: 'var(--surface-light)', border: '1px solid var(--border)',
              borderRadius: 12, color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box',
            }}
          />

          <button
            onClick={send}
            disabled={files.length === 0 || sending}
            style={{
              width: '100%', padding: 14, borderRadius: 14, border: 'none',
              background: files.length === 0 ? 'var(--surface-light)' : 'var(--accent)',
              color: files.length === 0 ? 'var(--muted)' : 'var(--bg)',
              fontSize: 'var(--fs-body)', fontWeight: 700, cursor: files.length === 0 ? 'default' : 'pointer',
              opacity: sending ? 0.6 : 1, marginTop: 'auto',
            }}
          >{sending ? 'Отправка…' : 'Отправить в чат'}</button>
        </div>
      </div>
    </div>
  );
}
