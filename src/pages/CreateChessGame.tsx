import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useChessStore, type ChessTimeControl } from '@/stores/chessStore';
import { useAuthStore } from '@/stores/authStore';
import { LICHESS_PIECE_SETS, pieceSrc } from '@/components/ChessPieceLichess';
import { haptic } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { useChatStore } from '@/stores/chatStore';

const TIME_CONTROLS: { id: ChessTimeControl; label: string; sub: string }[] = [
  { id: 'unlimited', label: 'Без таймера', sub: 'Думайте сколько нужно' },
  { id: 'bullet_1', label: 'Bullet 1м', sub: 'На партию у каждого' },
  { id: 'blitz_3', label: 'Blitz 3м', sub: 'Классический блиц' },
  { id: 'blitz_5', label: 'Blitz 5м', sub: '5 минут на партию' },
  { id: 'rapid_10', label: 'Rapid 10м', sub: 'Спокойный темп' },
  { id: 'rapid_15', label: 'Rapid 15м', sub: 'Думаем серьёзно' },
];

export default function CreateChessGame() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const chatId = searchParams.get('chatId'); // если пришли из чата — после создания шлём виджет туда
  const { user } = useAuthStore();
  const { createGame } = useChessStore();
  const sendWidgetMessage = useChatStore(s => s.sendWidgetMessage);
  const [name, setName] = useState('');
  const [timeControl, setTimeControl] = useState<ChessTimeControl>('blitz_5');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // v58.37: стиль фигур + тема доски (для новой игры). Сохраняется в chess_games.settings.
  const [pieceStyle, setPieceStyle] = useState<string>('lichess:cburnett');
  const [boardTheme, setBoardTheme] = useState<'light' | 'wood'>('wood');

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Введите название стола');
      return;
    }
    setSubmitting(true);
    setError(null);

    const timeoutPromise = new Promise<{ id: null; error: string }>((resolve) =>
      setTimeout(() => resolve({ id: null, error: 'Сервер не отвечает' }), 15000)
    );

    const result: { id: string | null; error: string | null } = await Promise.race([
      createGame(name.trim(), 'classic_2p', timeControl),
      timeoutPromise,
    ]);

    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.id) {
      // Записываем выбранный стиль в settings игры. Если колонки нет (миграция 080 не накатана) — silent fail.
      try {
        await supabase
          .from('chess_games')
          .update({ settings: { piece_style: pieceStyle, board_theme: boardTheme } })
          .eq('id', result.id);
      } catch (e) {
        console.warn('chess settings save failed (migration 080 needed):', e);
      }

      // Если пришли из чата — шлём виджет приглашения и возвращаемся в чат
      if (chatId && user) {
        try {
          const messageResult = await sendWidgetMessage(chatId, user.id, `[CHESS:${result.id}]`, 'system');
          if (messageResult.error) console.warn('chess invite send failed:', messageResult.error);
        } catch (e) {
          console.warn('chess invite send failed:', e);
        }
        nav(`/chat/${chatId}`, { replace: true });
        return;
      }

      nav(`/chess/${result.id}`, { replace: true });
    }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{
        display:'flex', alignItems:'center', gap:8,
        padding:'calc(env(safe-area-inset-top, 0px) + 12px) 16px 12px', borderBottom:'1px solid var(--border)',
      }}>
        <button onClick={() => nav(-1)} style={{
          background:'none', border:'none', cursor:'pointer',
          color:'var(--text)', fontSize: 'var(--fs-snap24)', padding:0, lineHeight:1,
        }}>‹</button>
        <h2 style={{ margin:0, fontSize: 'var(--fs-heading)', color:'var(--text)' }}>Новый стол</h2>
      </div>

      <div className="page-scroll ce-form" style={{ padding:16 }}>
        <div style={{ marginBottom:18 }}>
          <div style={{ fontSize: 'var(--fs-micro)', fontWeight:600, color:'var(--muted)', textTransform:'uppercase', marginBottom:8 }}>Название</div>
          <input
            type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="Например: Вечерняя партия" maxLength={60}
            style={{
              width:'100%', padding:'12px',
              background:'var(--surface-light)', border:'1px solid var(--border)',
              borderRadius:14, color:'var(--text)', fontSize: 'var(--fs-snap14)', boxSizing:'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom:18 }}>
          <div style={{ fontSize: 'var(--fs-micro)', fontWeight:600, color:'var(--muted)', textTransform:'uppercase', marginBottom:8 }}>Контроль времени</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {TIME_CONTROLS.map(tc => (
              <button key={tc.id} onClick={() => { haptic.tap(); setTimeControl(tc.id); }} style={{
                padding:'12px 10px',
                background: timeControl === tc.id ? 'var(--text)' : 'var(--surface-light)',
                color: timeControl === tc.id ? 'var(--bg)' : 'var(--text)',
                border:'1px solid', borderColor: timeControl === tc.id ? 'var(--text)' : 'var(--border)',
                borderRadius:14, cursor:'pointer', textAlign:'left',
              }}>
                <div style={{ fontWeight:600, fontSize: 'var(--fs-label)', marginBottom:2 }}>{tc.label}</div>
                <div style={{ fontSize: 'var(--fs-snap10)', opacity:0.7 }}>{tc.sub}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom:18 }}>
          <div style={{ fontSize: 'var(--fs-micro)', fontWeight:600, color:'var(--muted)', textTransform:'uppercase', marginBottom:8 }}>Стиль фигур</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {LICHESS_PIECE_SETS.map(s => {
              const id = `lichess:${s.id}`;
              const active = pieceStyle === id;
              return (
                <button key={s.id} onClick={() => { haptic.tap(); setPieceStyle(id); }} style={{
                  padding:'14px 10px',
                  background: active ? 'var(--text)' : 'var(--surface-light)',
                  color: active ? 'var(--bg)' : 'var(--text)',
                  border:'1px solid', borderColor: active ? 'var(--text)' : 'var(--border)',
                  borderRadius:14, cursor:'pointer', textAlign:'center',
                }}>
                  <div style={{ display:'flex', justifyContent:'center', alignItems:'flex-end', gap: 2, height: 40, marginBottom: 4 }}>
                    <img
                      src={pieceSrc(s.id, 'N')}
                      width={36} height={36}
                      alt=""
                      draggable={false}
                      style={{ display:'block' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                    />
                  </div>
                  <div style={{ fontWeight:600, fontSize: 'var(--fs-label)' }}>{s.label}</div>
                </button>
              );
            })}
          </div>

          <div style={{ fontSize: 'var(--fs-micro)', fontWeight:600, color:'var(--muted)', textTransform:'uppercase', marginBottom:8, marginTop: 14 }}>Доска</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {([
              { id: 'wood', label: 'Дерево', sub: 'Классика', light: '#F0D9B5', dark: '#B58863' },
              { id: 'light', label: 'Светлая', sub: 'Минимализм', light: '#FFFFFF', dark: '#E5E7EB' },
            ] as const).map(t => (
              <button key={t.id} onClick={() => { haptic.tap(); setBoardTheme(t.id); }} style={{
                padding:'14px 10px',
                background: boardTheme === t.id ? 'var(--text)' : 'var(--surface-light)',
                color: boardTheme === t.id ? 'var(--bg)' : 'var(--text)',
                border:'1px solid', borderColor: boardTheme === t.id ? 'var(--text)' : 'var(--border)',
                borderRadius:14, cursor:'pointer', textAlign:'center',
              }}>
                {/* Превью 2×2 поля */}
                <div style={{ display:'inline-grid', gridTemplateColumns:'1fr 1fr', width: 44, height: 44, marginBottom: 6, borderRadius: 6, overflow: 'hidden', border:'1px solid rgba(0,0,0,0.08)' }}>
                  <div style={{ background: t.light }}/><div style={{ background: t.dark }}/>
                  <div style={{ background: t.dark }}/><div style={{ background: t.light }}/>
                </div>
                <div style={{ fontWeight:600, fontSize: 'var(--fs-label)' }}>{t.label}</div>
                <div style={{ fontSize: 'var(--fs-snap10)', opacity:0.7, marginTop: 1 }}>{t.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{
            padding:10, background:'rgba(239, 68, 68, 0.1)',
            border:'1px solid rgba(239, 68, 68, 0.3)',
            borderRadius:8, color:'#ef4444', fontSize: 'var(--fs-label)', marginBottom:14,
          }}>{error}</div>
        )}

        <button onClick={handleSubmit} disabled={submitting || !name.trim()} style={{
          width:'100%', padding:'14px',
          background: name.trim() && !submitting ? 'var(--text)' : 'var(--surface-light)',
          color: name.trim() && !submitting ? 'var(--bg)' : 'var(--muted)',
          border:'none', borderRadius:14, fontSize: 'var(--fs-body)', fontWeight:600,
          cursor: name.trim() && !submitting ? 'pointer' : 'default',
        }}>{submitting ? <><span className="anim-spin" style={{display:'inline-block'}}>↻</span> Создаём...</> : 'Создать стол'}</button>
      </div>
    </div>
  );
}
