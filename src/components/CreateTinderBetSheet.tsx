// Создание Тиндер-виджета: юзер выбирает фото с устройства, пишет описание,
// устанавливает длительность, отправляет в чат. Создаёт скрытый пост с медиа
// (автор = текущий юзер) и tinder_bet через RPC.
import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';

interface Props {
  conversationId: string;
  onCreated: (betId: string) => void;
  onClose: () => void;
}

export default function CreateTinderBetSheet({ conversationId, onCreated, onClose }: Props) {
  const { user } = useAuthStore();
  const sendWidgetMessage = useChatStore(s => s.sendWidgetMessage);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [dragY, setDragY] = useState(0);
  const startYRef = useRef<number | null>(null);

  const handleFile = (f: File) => {
    if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) {
      toast.error('Только фото и видео');
      return;
    }
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const create = async () => {
    if (!file || creating || !user) return;
    setCreating(true);
    try {
      // 1. Создаём пост (автор = текущий юзер). Caption = описание.
      const { data: post, error: postErr } = await supabase
        .from('posts')
        .insert({ author_id: user.id, caption: caption.trim(), is_tinder: true })
        .select()
        .single();
      if (postErr || !post) throw postErr || new Error('post insert failed');

      // 2. Загружаем медиа в storage
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `${user.id}/${post.id}/0_${safeName}`;
      const { error: upErr } = await supabase.storage
        .from('post-media')
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('post-media').getPublicUrl(path);

      // 3. post_media запись
      const { error: mediaErr } = await supabase.from('post_media').insert({
        post_id: post.id,
        file_url: urlData.publicUrl,
        mime_type: file.type,
        position: 0,
      });
      if (mediaErr) throw mediaErr;

      // 4. Создаём tinder_bet через RPC. Длительность ставим заведомо большой —
      //    виджет работает только на лайки/комменты, ставочной механики больше нет.
      const { data: betData, error: betErr } = await supabase.rpc('create_tinder_bet', {
        conversation_id_param: conversationId,
        post_id_param: post.id,
        duration_minutes_param: 60 * 24 * 365, // 365 дней — фактически бесконечно
        visible_bets_param: false,             // флаг устарел, оставлен для совместимости RPC
      });
      if (betErr || !betData) throw betErr || new Error('bet creation failed');
      const betId = (betData as any).bet_id;

      // 5. Системное сообщение с маркером виджета
      const messageResult = await sendWidgetMessage(conversationId, user.id, `[TINDER_BET:${betId}]`, 'system');
      if (messageResult.error) throw new Error(messageResult.error);
      if (messageResult.id) {
        await supabase.from('tinder_bets').update({ message_id: messageResult.id }).eq('id', betId);
      }

      setCreating(false);
      onCreated(betId);
    } catch (e: any) {
      setCreating(false);
      toast.error('Не получилось: ' + (e?.message || 'unknown'));
    }
  };

  const onTouchStart = (e: React.TouchEvent) => { startYRef.current = e.touches[0].clientY; };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startYRef.current === null) return;
    const dy = e.touches[0].clientY - startYRef.current;
    if (dy > 0) setDragY(dy);
  };
  const onTouchEnd = () => {
    if (dragY > 120) onClose();
    setDragY(0);
    startYRef.current = null;
  };

  const isVideo = file?.type.startsWith('video/');

  return (
    <div
      className="sheet-backdrop"
      style={{
        position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',
        display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:1000,
      }}
      onClick={onClose}
    >
      <div
        className="sheet-content"
        onClick={e => e.stopPropagation()}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        style={{
          background:'var(--bg)',
          borderTopLeftRadius:20, borderTopRightRadius:20,
          maxHeight:'92dvh',display:'flex',flexDirection:'column',
          width:'100%',maxWidth:540,
          transform:`translateY(${dragY}px)`,
          transition:dragY === 0 ? 'transform 200ms ease' : undefined,
        }}
      >
        {/* Хэндл */}
        <div style={{padding:'10px 0',display:'flex',justifyContent:'center'}}>
          <div style={{width:36,height:4,borderRadius:2,background:'var(--border)'}} />
        </div>

        {/* Заголовок */}
        <div style={{padding:'4px 16px 14px',borderBottom:'1px solid var(--border)'}}>
          <div style={{fontSize: 'var(--fs-heading)',fontWeight:700,color:'var(--text)'}}>Создать Тиндер</div>
          <div style={{fontSize: 'var(--fs-caption)',color:'var(--muted)',marginTop:2}}>
            Загрузи фото, добавь описание — в чат прилетит виджет для свайпа
          </div>
        </div>

        <div className="page-scroll" style={{padding:14, flex:1, overflowY:'auto'}}>

          {/* Превью / кнопка выбора фото */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            style={{display:'none'}}
          />
          {!file ? (
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                width:'100%',aspectRatio:'3/4',
                background:'var(--surface-light)',
                border:'2px dashed var(--border)',
                borderRadius:16,
                display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                gap:10,color:'var(--muted)',cursor:'pointer',
                marginBottom:14,
              }}
            >
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <div style={{fontSize: 'var(--fs-snap14)',fontWeight:600,color:'var(--text)'}}>Выбрать фото или видео</div>
              <div style={{fontSize: 'var(--fs-micro)'}}>JPEG, PNG, MP4...</div>
            </button>
          ) : (
            <div style={{position:'relative',marginBottom:14,borderRadius:16,overflow:'hidden',aspectRatio:'3/4',background:'#000'}}>
              {isVideo
                ? <video src={preview!} muted playsInline loop autoPlay style={{width:'100%',height:'100%',objectFit:'cover'}} />
                : <img src={preview!} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />}
              <button
                onClick={() => { setFile(null); setPreview(null); }}
                style={{
                  position:'absolute',top:8,right:8,
                  width:32,height:32,borderRadius:16,
                  background:'rgba(0,0,0,0.6)',color:'#fff',
                  border:'none',cursor:'pointer',
                  display:'flex',alignItems:'center',justifyContent:'center',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  position:'absolute',bottom:8,left:8,
                  padding:'6px 12px',borderRadius:12,
                  background:'rgba(0,0,0,0.6)',color:'#fff',
                  border:'none',cursor:'pointer',fontSize: 'var(--fs-caption)',fontWeight:500,
                }}
              >
                Заменить
              </button>
            </div>
          )}

          {/* Описание */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize: 'var(--fs-micro)',fontWeight:600,color:'var(--muted)',textTransform:'uppercase',marginBottom:6}}>
              Описание <span style={{fontWeight:400,textTransform:'none'}}>(опционально)</span>
            </div>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="Кто это / что обсуждаем"
              maxLength={500}
              rows={2}
              style={{
                width:'100%',padding:'10px 12px',borderRadius:14,
                background:'var(--surface-light)',border:'1px solid var(--border)',
                color:'var(--text)',fontSize: 'var(--fs-snap14)',outline:'none',resize:'vertical',
                fontFamily:'inherit',boxSizing:'border-box',minHeight:50,
              }}
            />
          </div>
        </div>

        {/* Кнопки нижней панели */}
        <div style={{
          padding:'12px 14px',borderTop:'1px solid var(--border)',
          display:'flex',gap:8,
        }}>
          <button
            onClick={onClose}
            style={{
              flex:1,padding:'13px',borderRadius:14,
              background:'var(--surface-light)',color:'var(--text)',
              border:'1px solid var(--border)',fontSize: 'var(--fs-snap14)',fontWeight:600,cursor:'pointer',
            }}
          >Отмена</button>
          <button
            onClick={create}
            disabled={!file || creating}
            style={{
              flex:2,padding:'13px',borderRadius:14,
              background:!file || creating ? 'var(--border)' : 'var(--accent)',
              color:!file || creating ? 'var(--muted)' : 'var(--bg)',
              border:'none',fontSize: 'var(--fs-snap14)',fontWeight:700,
              cursor:!file || creating ? 'default' : 'pointer',
            }}
          >{creating ? 'Создаём...' : 'Отправить в чат'}</button>
        </div>
      </div>
    </div>
  );
}
