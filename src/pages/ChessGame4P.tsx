import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useChessStore } from '@/stores/chessStore';
import { toast } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import FourPlayerBoard from '@/components/FourPlayerBoard';
import {
  createInitialState, deserializeState, serializeState, makeMove, squareToString,
  type GameState4, type Color4, type Square4, type PieceType,
} from '@/lib/chess4p';

const COLOR_LABELS: Record<Color4, string> = {
  R: 'Красные', B: 'Синие', Y: 'Жёлтые', G: 'Зелёные',
};
const COLOR_FILL: Record<Color4, string> = {
  // Должно совпадать с COLOR_STYLES.fill в FourPlayerBoard.tsx
  R: '#8B2A3C', B: '#27407A', Y: '#B68433', G: '#2A6E4A',
};

function formatTime(ms: number | null | undefined): string {
  if (ms == null) return '∞';
  if (ms <= 0) return '00:00';
  const t = Math.floor(ms / 1000);
  return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
}

export default function ChessGame4P() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { session } = useAuthStore();
  const myId = session?.user.id;

  const { games, playerProfiles, sitDown4p, standUp4p, makeMove4p, resign4p, offerDraw4p, respondDraw4p } = useChessStore();
  const game = id ? games[id] : undefined;

  const [showResign, setShowResign] = useState(false);

  // Восстанавливаем состояние из БД (или начинаем с initial)
  const gameState: GameState4 = useMemo(() => {
    if (game?.state_4p) {
      try { return deserializeState(game.state_4p); } catch { /* fall through */ }
    }
    return createInitialState();
  }, [game?.state_4p]);

  // Time control
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!game || game.status !== 'playing' || game.time_control === 'unlimited') return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [game?.status, game?.time_control]);

  if (!id || !game) return <div style={{padding:40,textAlign:'center',color:'var(--muted)'}}>Загрузка...</div>;

  const seats: Record<Color4, string | null> = {
    R: game.red_player_id ?? null,
    B: game.blue_player_id ?? null,
    Y: game.yellow_player_id ?? null,
    G: game.green_player_id ?? null,
  };
  const times: Record<Color4, number | null> = {
    R: game.red_time_ms ?? null,
    B: game.blue_time_ms ?? null,
    Y: game.yellow_time_ms ?? null,
    G: game.green_time_ms ?? null,
  };
  // Live time
  const liveTimes: Record<Color4, number | null> = { ...times };
  if (game.status === 'playing' && game.time_control !== 'unlimited' && game.last_move_at) {
    const elapsed = Math.max(0, now - new Date(game.last_move_at).getTime());
    const turnColor = game.current_turn as Color4;
    if (turnColor in liveTimes) {
      liveTimes[turnColor] = Math.max(0, (times[turnColor] ?? 0) - elapsed);
    }
  }

  const myColor: Color4 | null =
    seats.R === myId ? 'R' :
    seats.B === myId ? 'B' :
    seats.Y === myId ? 'Y' :
    seats.G === myId ? 'G' : null;

  const isPlayer = myColor !== null;
  const currentTurn = game.current_turn as Color4;
  const isMyTurn = isPlayer && game.status === 'playing' && currentTurn === myColor;
  const isWaiting = game.status === 'waiting';
  const isFinished = game.status === 'finished';

  const handleSit = async (color: Color4) => {
    const { error } = await sitDown4p(game.id, color);
    if (error) toast.error('Ошибка: ' + error);
  };

  const handleMove = async (from: Square4, to: Square4, promotion?: PieceType) => {
    if (!myColor || !isMyTurn) return;

    // Применяем ход локально (валидация в движке)
    const stateCopy = deserializeState(serializeState(gameState));
    let result;
    try {
      result = makeMove(stateCopy, from, to, promotion);
    } catch (e: any) {
      toast.error('Недопустимый ход: ' + e.message);
      return;
    }

    // Отправляем на сервер
    const isGameOver = result.isWin;
    const { error } = await makeMove4p(game.id, {
      stateAfter: serializeState(result.state),
      playerColor: myColor,
      nextTurn: result.state.turn,
      from: squareToString(from),
      to: squareToString(to),
      isGameOver,
      scores: result.state.scores,
      alive: result.state.alive,
    });
    if (error) {
      console.error('move4p error:', error);
      toast.error('Ход отклонён: ' + error);
    }
  };

  const playerName = (color: Color4) => {
    const uid = seats[color];
    if (!uid) return 'Свободно';
    return playerProfiles[uid]?.display_name || '...';
  };

  // Результат
  let winnerText = '';
  if (isFinished) {
    if (game.winner_id) {
      winnerText = (playerProfiles[game.winner_id]?.display_name || 'Победитель') + ' выиграл';
    } else {
      winnerText = 'Ничья';
    }
  }

  // Team mode label
  const teamLabel = game.team_mode === 'teams_2v2' ? 'Команды 2v2' : 'Каждый сам';

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'calc(env(safe-area-inset-top, 0px) + 10px) 14px 10px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
        <button onClick={() => nav('/chess')} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text)',fontSize: 'var(--fs-snap24)',padding:0,lineHeight:1}}>‹</button>
        <div style={{flex:1,textAlign:'center',overflow:'hidden'}}>
          <div style={{fontSize: 'var(--fs-snap14)',fontWeight:600,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{game.name}</div>
          <div style={{fontSize: 'var(--fs-micro)',color:'var(--muted)'}}>
            {isWaiting && `${teamLabel} · Ждём игроков`}
            {game.status === 'playing' && `Ход: ${COLOR_LABELS[currentTurn]}`}
            {isFinished && winnerText}
          </div>
        </div>
        <div style={{width:24}} />
      </div>

      {/* Player panels — 4 в ряд */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:6,padding:'8px 10px',flexShrink:0}}>
        {(['R','B','Y','G'] as Color4[]).map(c => {
          const isCurrentTurn = currentTurn === c && game.status === 'playing' && gameState.alive[c];
          const isDead = !gameState.alive[c] && game.status === 'playing';
          const time = liveTimes[c];
          return (
            <div key={c} style={{
              padding:6, borderRadius:8,
              background: isCurrentTurn ? 'rgba(80,200,120,0.15)' : 'var(--surface-light)',
              border:'1px solid', borderColor: isCurrentTurn ? '#50c878' : 'var(--border)',
              opacity: isDead ? 0.4 : 1,
            }}>
              <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:2}}>
                <div style={{width:8,height:8,borderRadius:2,background:COLOR_FILL[c]}} />
                <div style={{fontSize: 'var(--fs-snap10)',color:'var(--muted)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{COLOR_LABELS[c]}</div>
              </div>
              <div style={{fontSize: 'var(--fs-micro)',color:'var(--text)',fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                {playerName(c)}
              </div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:2}}>
                <span style={{fontSize: 'var(--fs-snap10)',fontVariantNumeric:'tabular-nums',color: time != null && time < 30000 ? '#ef4444' : 'var(--muted)'}}>
                  {formatTime(time)}
                </span>
                <span style={{fontSize: 'var(--fs-micro)',fontWeight:700,color:COLOR_FILL[c]}}>
                  {gameState.scores[c]}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Board */}
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:8,overflow:'hidden'}}>
        <FourPlayerBoard
          state={gameState}
          myColor={myColor}
          isMyTurn={isMyTurn}
          disabled={!isPlayer || game.status !== 'playing'}
          onMove={handleMove}
          pieceStyle={(game as any).settings?.piece_style || 'classic'}
          boardTheme={(game as any).settings?.board_theme || 'wood'}
        />
      </div>

      {/* Sit-down buttons in waiting */}
      {isWaiting && !isPlayer && (
        <div style={{padding:'10px 14px',flexShrink:0}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
            {(['R','B','Y','G'] as Color4[]).filter(c => !seats[c]).map(c => (
              <button key={c} onClick={() => handleSit(c)} style={{
                padding:'10px',background:COLOR_FILL[c],color:'#fff',border:'none',
                borderRadius:10,fontSize: 'var(--fs-caption)',fontWeight:600,cursor:'pointer',
              }}>Сесть за {COLOR_LABELS[c].toLowerCase()}</button>
            ))}
          </div>
        </div>
      )}

      {isWaiting && isPlayer && (
        <div style={{padding:'10px 14px',flexShrink:0}}>
          <button onClick={() => standUp4p(game.id)} style={{
            width:'100%',padding:'10px',background:'var(--surface-light)',color:'var(--text)',
            border:'1px solid var(--border)',borderRadius:10,cursor:'pointer',fontSize: 'var(--fs-label)',
          }}>Встать со стола</button>
        </div>
      )}

      {/* Resign + Offer Draw during play */}
      {game.status === 'playing' && isPlayer && gameState.alive[myColor!] && (
        <div style={{display:'flex', gap:8, padding:'8px 14px', flexShrink:0}}>
          <button onClick={() => setShowResign(true)} style={{
            flex:1,padding:'10px',background:'var(--surface-light)',color:'#ef4444',
            border:'1px solid var(--border)',borderRadius:10,cursor:'pointer',fontSize: 'var(--fs-label)',fontWeight:500,
          }}>Сдаться</button>
          <button
            onClick={() => offerDraw4p(game.id)}
            disabled={!!game.draw_offer_by}
            style={{
              flex:1, padding:'10px',
              background:'var(--surface-light)',
              color: game.draw_offer_by ? 'var(--muted)' : 'var(--text)',
              border:'1px solid var(--border)', borderRadius:10,
              cursor: game.draw_offer_by ? 'default' : 'pointer',
              fontSize: 'var(--fs-label)', fontWeight:500,
            }}
          >{game.draw_offer_by ? 'Ничья предложена' : 'Предложить ничью'}</button>
        </div>
      )}

      {/* Draw offer response panel — для всех кроме инициатора */}
      {game.draw_offer_by && game.draw_offer_by !== myId && isPlayer && game.status === 'playing'
        && gameState.alive[myColor!]
        && game.draw_responses_4p?.[myColor!] !== 'accepted' && (
        <div style={{
          margin:'0 14px 8px', padding:12,
          background:'rgba(80,120,200,0.15)', borderRadius:10,
          border:'1px solid rgba(80,120,200,0.4)', flexShrink:0,
        }}>
          <div style={{fontSize: 'var(--fs-label)', color:'var(--text)', marginBottom:8}}>
            {playerProfiles[game.draw_offer_by]?.display_name || 'Игрок'} предлагает ничью
          </div>
          <div style={{fontSize: 'var(--fs-micro)', color:'var(--muted)', marginBottom:8}}>
            Нужно согласие всех живых игроков. Любой отказ — отменяет.
          </div>
          <div style={{display:'flex', gap:8}}>
            <button onClick={() => respondDraw4p(game.id, true)} style={{
              flex:1, padding:8, background:'#50c878', color:'#fff',
              border:'none', borderRadius:8, cursor:'pointer', fontSize: 'var(--fs-caption)', fontWeight:600,
            }}>Принять</button>
            <button onClick={() => respondDraw4p(game.id, false)} style={{
              flex:1, padding:8, background:'var(--surface-light)', color:'var(--text)',
              border:'1px solid var(--border)', borderRadius:8, cursor:'pointer', fontSize: 'var(--fs-caption)',
            }}>Отклонить</button>
          </div>
        </div>
      )}

      {/* Статус согласий — у инициатора */}
      {game.draw_offer_by === myId && game.status === 'playing' && game.draw_responses_4p && (
        <div style={{
          margin:'0 14px 8px', padding:10,
          background:'var(--surface-light)', borderRadius:10,
          border:'1px solid var(--border)', flexShrink:0, fontSize: 'var(--fs-caption)',
        }}>
          <div style={{color:'var(--text)', marginBottom:6, fontWeight:500}}>Ваше предложение ничьи · ждём ответов</div>
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            {(['R','B','Y','G'] as Color4[]).filter(c => seats[c]).map(c => {
              const status = game.draw_responses_4p?.[c];
              return (
                <span key={c} style={{
                  fontSize: 'var(--fs-snap10)', padding:'2px 6px', borderRadius:4,
                  background: status === 'accepted' ? 'rgba(80,200,120,0.2)' : 'var(--bg)',
                  color: status === 'accepted' ? '#50c878' : 'var(--muted)',
                }}>
                  <span style={{display:'inline-block', width:6, height:6, borderRadius:1, background:COLOR_FILL[c], marginRight:4, verticalAlign:'middle'}} />
                  {playerName(c).slice(0,8)} · {status === 'accepted' ? '✓' : '...'}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Game over screen */}
      {isFinished && (
        <div style={{margin:'0 14px 10px',padding:12,background:'var(--surface-light)',borderRadius:10,border:'1px solid var(--border)',flexShrink:0}}>
          <div style={{fontSize: 'var(--fs-snap14)',fontWeight:600,color:'var(--text)',marginBottom:8}}>{winnerText}</div>
          <div style={{fontSize: 'var(--fs-micro)',color:'var(--muted)',marginBottom:8}}>
            {(['R','B','Y','G'] as Color4[]).map(c => (
              <div key={c}>
                <span style={{color:COLOR_FILL[c],fontWeight:600}}>{COLOR_LABELS[c]}:</span> {gameState.scores[c]} очков · {playerName(c)}
              </div>
            ))}
          </div>
          <button onClick={() => nav('/chess')} style={{
            marginTop:6,width:'100%',padding:10,background:'var(--accent)',color:'var(--bg)',
            border:'none',borderRadius:8,cursor:'pointer',fontSize: 'var(--fs-label)',fontWeight:600,
          }}>В лобби</button>
        </div>
      )}

      {/* Resign modal */}
      {showResign && (
        <div onClick={() => setShowResign(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:90,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div onClick={e => e.stopPropagation()} style={{background:'var(--surface)',borderRadius:14,padding:20,maxWidth:'90vw',width:300}}>
            <h3 style={{margin:'0 0 8px',fontSize: 'var(--fs-snap16)',color:'var(--text)'}}>Сдаться?</h3>
            <p style={{margin:'0 0 16px',fontSize: 'var(--fs-label)',color:'var(--muted)'}}>Ваши фигуры исчезнут с доски. Партия продолжится без вас.</p>
            <div style={{display:'flex',gap:8}}>
              <button onClick={() => setShowResign(false)} style={{flex:1,padding:10,background:'var(--surface-light)',color:'var(--text)',border:'1px solid var(--border)',borderRadius:8,cursor:'pointer',fontSize: 'var(--fs-label)'}}>Отмена</button>
              <button onClick={() => { setShowResign(false); resign4p(game.id); }} style={{flex:1,padding:10,background:'#ef4444',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize: 'var(--fs-label)',fontWeight:600}}>Сдаться</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
