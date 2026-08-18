import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { useChessStore } from '@/stores/chessStore';
import { toast } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { triggerConfetti } from '@/lib/confetti';
import { haptic } from '@/lib/haptics';
import ChessBoard from '@/components/ChessBoard';
import ChessPieceSVG from '@/components/ChessPieceSVG';

const END_REASON_LABELS: Record<string, string> = {
  checkmate: 'Мат', stalemate: 'Пат', resignation: 'Сдача',
  timeout: 'Время вышло', draw_agreed: 'Ничья по соглашению',
  threefold_repetition: 'Троекратное повторение', fifty_move_rule: 'Правило 50 ходов',
  insufficient_material: 'Недостаточно материала', aborted: 'Прервано',
};

function formatTime(ms: number | null): string {
  if (ms == null) return '∞';
  if (ms <= 0) return '00:00';
  const t = Math.floor(ms / 1000);
  return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
}

// C7 — съеденные фигуры и перевес по материалу из FEN
function getCapturedMaterial(fen: string) {
  const board = (fen || '').split(' ')[0] || '';
  const counts: Record<string, number> = {};
  for (const ch of board) { if ('pnbrqPNBRQ'.includes(ch)) counts[ch] = (counts[ch] || 0) + 1; }
  const start: Record<string, number> = { p:8,n:2,b:2,r:2,q:1,P:8,N:2,B:2,R:2,Q:1 };
  const order = ['q','r','b','n','p'];
  const whiteCaptured: string[] = [];
  const blackCaptured: string[] = [];
  for (const t of order) {
    const lostBlack = (start[t] || 0) - (counts[t] || 0);
    for (let i = 0; i < lostBlack; i++) whiteCaptured.push(t);
    const T = t.toUpperCase();
    const lostWhite = (start[T] || 0) - (counts[T] || 0);
    for (let i = 0; i < lostWhite; i++) blackCaptured.push(T);
  }
  const val: Record<string, number> = { p:1,n:3,b:3,r:5,q:9 };
  let adv = 0;
  for (const c of whiteCaptured) adv += val[c.toLowerCase()] || 0;
  for (const c of blackCaptured) adv -= val[c.toLowerCase()] || 0;
  return { whiteCaptured, blackCaptured, adv };
}

function CapturedRow({ pieces, advantage, pieceStyle }: { pieces: string[]; advantage: number; pieceStyle: string }) {
  if (pieces.length === 0 && advantage <= 0) return null;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:0, marginTop:2, height:16 }}>
      {pieces.map((p, i) => (
        <span key={i} className="chess-cap-in" style={{ width:14, height:14, display:'inline-flex', marginLeft: i > 0 ? -3 : 0 }}>
          <ChessPieceSVG symbol={p} variant={pieceStyle} style={{ width:'100%', height:'100%' }} />
        </span>
      ))}
      {advantage > 0 && <span style={{ fontSize:'var(--fs-micro)', color:'var(--muted)', marginLeft:5, fontWeight:600 }}>+{advantage}</span>}
    </div>
  );
}

export default function ChessGame2P() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { session } = useAuthStore();
  const myId = session?.user.id;

  const {
    games, playerProfiles,
    sitDown, standUp, makeMove, resign, offerDraw, respondDraw, forceTimeout,
  } = useChessStore();

  const game = id ? games[id] : undefined;
  const [showResign, setShowResign] = useState(false);
  const timeoutCalledRef = useRef(false);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!game || game.status !== 'playing' || game.time_control === 'unlimited') return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [game?.status, game?.time_control]);

  const { whiteTimeLive, blackTimeLive } = useMemo(() => {
    if (!game) return { whiteTimeLive: null, blackTimeLive: null };
    if (game.time_control === 'unlimited' || game.status !== 'playing') {
      return { whiteTimeLive: game.white_time_ms, blackTimeLive: game.black_time_ms };
    }
    const lastMoveAt = game.last_move_at ? new Date(game.last_move_at).getTime() : now;
    const elapsed = Math.max(0, now - lastMoveAt);
    if (game.current_turn === 'white') {
      return {
        whiteTimeLive: Math.max(0, (game.white_time_ms ?? 0) - elapsed),
        blackTimeLive: game.black_time_ms,
      };
    }
    return {
      whiteTimeLive: game.white_time_ms,
      blackTimeLive: Math.max(0, (game.black_time_ms ?? 0) - elapsed),
    };
  }, [game, now]);

  useEffect(() => {
    if (!game || game.status !== 'playing' || game.time_control === 'unlimited') return;
    if (timeoutCalledRef.current) return;
    if ((whiteTimeLive ?? 1) <= 0 || (blackTimeLive ?? 1) <= 0) {
      timeoutCalledRef.current = true;
      forceTimeout(game.id);
    }
  }, [whiteTimeLive, blackTimeLive, game, forceTimeout]);

  useEffect(() => {
    if (game?.status === 'playing') timeoutCalledRef.current = false;
  }, [game?.id, game?.status]);

  // Last move
  const lastMove = useMemo(() => {
    if (!game?.pgn) return null;
    try {
      const c = new Chess();
      c.loadPgn(game.pgn);
      const moves = c.history({ verbose: true });
      const last = moves[moves.length - 1];
      if (!last) return null;
      // captured: lowercase piece type ('p','n','b','r','q'), need to figure out color
      // chess.js verbose move has `captured: 'p'|'n'|'b'|'r'|'q'|undefined` (without colour)
      // У захваченной фигуры цвет — противоположен ходившему: last.color === 'w' → captured была чёрная
      let capturedPiece: string | undefined = undefined;
      if (last.captured) {
        capturedPiece = last.color === 'w' ? last.captured.toLowerCase() : last.captured.toUpperCase();
      }
      return {
        from: last.from,
        to: last.to,
        captured: capturedPiece,
        promotion: last.promotion,
        san: last.san,
      };
    } catch { return null; }
  }, [game?.pgn]);

  // C5 — конфетти при победе
  const finishedConfettiRef = useRef(false);
  useEffect(() => {
    if (!game || game.status !== 'finished' || finishedConfettiRef.current) return;
    finishedConfettiRef.current = true;
    const myC = game.white_player_id === myId ? 'white' : game.black_player_id === myId ? 'black' : null;
    const iWon = (game.result === '1-0' && myC === 'white') || (game.result === '0-1' && myC === 'black');
    if (iWon) {
      haptic.success();
      triggerConfetti({ count: 80, power: 12, duration: 2200 });
    }
  }, [game?.status, game?.result]);

  if (!id || !game) return <div style={{padding:40,textAlign:'center',color:'var(--muted)'}}>Загрузка...</div>;

  const myColor: 'white' | 'black' | null =
    game.white_player_id === myId ? 'white' :
    game.black_player_id === myId ? 'black' : null;

  const isPlayer = myColor !== null;
  const isMyTurn = isPlayer && game.status === 'playing' && game.current_turn === myColor;
  const isWaiting = game.status === 'waiting';
  const isFinished = game.status === 'finished';

  const whiteName = game.white_player_id ? (playerProfiles[game.white_player_id]?.display_name || '...') : 'Свободно';
  const blackName = game.black_player_id ? (playerProfiles[game.black_player_id]?.display_name || '...') : 'Свободно';
  const whiteElo = game.white_player_id ? (playerProfiles[game.white_player_id]?.chess_elo ?? 1200) : null;
  const blackElo = game.black_player_id ? (playerProfiles[game.black_player_id]?.chess_elo ?? 1200) : null;

  let resultText = '';
  if (isFinished) {
    if (game.result === '1-0') resultText = 'Победили белые';
    else if (game.result === '0-1') resultText = 'Победили чёрные';
    else if (game.result === '1/2-1/2') resultText = 'Ничья';
    else resultText = 'Партия прервана';
  }

  const cap = getCapturedMaterial(game.fen);
  const bottomIsWhite = myColor !== 'black';
  const topPlayer = bottomIsWhite ?
    { name: blackName, elo: blackElo, time: blackTimeLive, isTurn: game.current_turn === 'black', color: 'black' as const } :
    { name: whiteName, elo: whiteElo, time: whiteTimeLive, isTurn: game.current_turn === 'white', color: 'white' as const };
  const bottomPlayer = bottomIsWhite ?
    { name: whiteName, elo: whiteElo, time: whiteTimeLive, isTurn: game.current_turn === 'white', color: 'white' as const } :
    { name: blackName, elo: blackElo, time: blackTimeLive, isTurn: game.current_turn === 'black', color: 'black' as const };

  const handleSit = async (c: 'white' | 'black') => {
    const { error } = await sitDown(game.id, c);
    if (error) toast.error('Ошибка: ' + error);
  };

  const handleMove = async (params: any) => {
    const { error } = await makeMove(game.id, params);
    if (error) toast.error('Ход отклонён: ' + error);
  };

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'calc(env(safe-area-inset-top, 0px) + 10px) 14px 10px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
        <button onClick={() => nav('/chess')} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text)',fontSize: 'var(--fs-snap24)',padding:0,lineHeight:1}}>‹</button>
        <div style={{flex:1,textAlign:'center',overflow:'hidden'}}>
          <div style={{fontSize: 'var(--fs-snap14)',fontWeight:600,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{game.name}</div>
          <div style={{fontSize: 'var(--fs-micro)',color:'var(--muted)'}}>
            {isWaiting && 'Ждём игроков'}
            {game.status === 'playing' && `Ход ${game.current_turn === 'white' ? 'белых' : 'чёрных'}`}
            {isFinished && resultText}
          </div>
        </div>
        <div style={{width:24}} />
      </div>

      <div className={(topPlayer.isTurn && game.status === 'playing') ? 'chess-turn-active' : undefined} style={{padding:'8px 14px',display:'flex',alignItems:'center',gap:10,background: topPlayer.isTurn && game.status === 'playing' ? 'rgba(80, 200, 120, 0.1)' : 'transparent',flexShrink:0,transition:'background-color 0.3s ease'}}>
        <div style={{width:26,height:26,borderRadius:13,flexShrink:0,background:topPlayer.color === 'white' ? '#F4F4F5' : '#1D1D1F',border:topPlayer.color === 'white' ? '1px solid rgba(0,0,0,0.18)' : '1px solid #3A3A3C',boxShadow:(topPlayer.isTurn && game.status === 'playing') ? '0 0 0 2.5px #50C878' : 'none',transition:'box-shadow .25s ease'}} />
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize: 'var(--fs-label)',color:'var(--text)',fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
            {topPlayer.name}
            {topPlayer.elo != null && <span style={{fontSize: 'var(--fs-micro)',color:'var(--muted)',marginLeft:6,fontWeight:500}}>· {topPlayer.elo}</span>}
          </div>
          <CapturedRow pieces={topPlayer.color === 'white' ? cap.whiteCaptured : cap.blackCaptured} advantage={topPlayer.color === 'white' ? cap.adv : -cap.adv} pieceStyle={(game as any).settings?.piece_style || 'classic'} />
        </div>
        <div className={(topPlayer.time != null && topPlayer.time < 30000 && game.status === 'playing') ? 'chess-clock-low' : undefined} style={{fontSize: 'var(--fs-heading)',fontWeight:700,fontVariantNumeric:'tabular-nums',padding:'5px 12px',borderRadius:10,background:(topPlayer.isTurn && game.status === 'playing') ? 'var(--text)' : 'var(--surface-light)',color:(topPlayer.time != null && topPlayer.time < 30000) ? '#ef4444' : ((topPlayer.isTurn && game.status === 'playing') ? 'var(--bg)' : 'var(--text)'),transition:'background .25s ease,color .25s ease'}}>{formatTime(topPlayer.time)}</div>
      </div>

      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'8px',overflow:'hidden'}}>
        <ChessBoard
          fen={game.fen}
          myColor={myColor}
          isMyTurn={isMyTurn}
          disabled={!isPlayer || game.status !== 'playing'}
          lastMove={lastMove}
          onMove={handleMove}
          pgn={game.pgn}
          pieceStyle={(game as any).settings?.piece_style || 'classic'}
          boardTheme={(game as any).settings?.board_theme || 'green'}
        />
      </div>

      <div className={(bottomPlayer.isTurn && game.status === 'playing') ? 'chess-turn-active' : undefined} style={{padding:'8px 14px',display:'flex',alignItems:'center',gap:10,background: bottomPlayer.isTurn && game.status === 'playing' ? 'rgba(80, 200, 120, 0.1)' : 'transparent',flexShrink:0,transition:'background-color 0.3s ease'}}>
        <div style={{width:26,height:26,borderRadius:13,flexShrink:0,background:bottomPlayer.color === 'white' ? '#F4F4F5' : '#1D1D1F',border:bottomPlayer.color === 'white' ? '1px solid rgba(0,0,0,0.18)' : '1px solid #3A3A3C',boxShadow:(bottomPlayer.isTurn && game.status === 'playing') ? '0 0 0 2.5px #50C878' : 'none',transition:'box-shadow .25s ease'}} />
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize: 'var(--fs-label)',color:'var(--text)',fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
            {bottomPlayer.name}
            {bottomPlayer.elo != null && <span style={{fontSize: 'var(--fs-micro)',color:'var(--muted)',marginLeft:6,fontWeight:500}}>· {bottomPlayer.elo}</span>}
          </div>
          <CapturedRow pieces={bottomPlayer.color === 'white' ? cap.whiteCaptured : cap.blackCaptured} advantage={bottomPlayer.color === 'white' ? cap.adv : -cap.adv} pieceStyle={(game as any).settings?.piece_style || 'classic'} />
        </div>
        <div className={(bottomPlayer.time != null && bottomPlayer.time < 30000 && game.status === 'playing') ? 'chess-clock-low' : undefined} style={{fontSize: 'var(--fs-heading)',fontWeight:700,fontVariantNumeric:'tabular-nums',padding:'5px 12px',borderRadius:10,background:(bottomPlayer.isTurn && game.status === 'playing') ? 'var(--text)' : 'var(--surface-light)',color:(bottomPlayer.time != null && bottomPlayer.time < 30000) ? '#ef4444' : ((bottomPlayer.isTurn && game.status === 'playing') ? 'var(--bg)' : 'var(--text)'),transition:'background .25s ease,color .25s ease'}}>{formatTime(bottomPlayer.time)}</div>
      </div>

      {isWaiting && !isPlayer && (
        <div style={{display:'flex',gap:8,padding:'8px 14px 18px',flexShrink:0}}>
          {!game.white_player_id && (
            <button onClick={() => handleSit('white')} style={{flex:1,padding:'12px',background:'#fff',color:'#000',border:'none',borderRadius:10,fontSize: 'var(--fs-label)',fontWeight:600,cursor:'pointer'}}>Сесть за белых</button>
          )}
          {!game.black_player_id && (
            <button onClick={() => handleSit('black')} style={{flex:1,padding:'12px',background:'#222',color:'#fff',border:'1px solid #555',borderRadius:10,fontSize: 'var(--fs-label)',fontWeight:600,cursor:'pointer'}}>Сесть за чёрных</button>
          )}
        </div>
      )}

      {isWaiting && isPlayer && (
        <div style={{padding:'10px 14px',flexShrink:0}}>
          <button onClick={() => standUp(game.id)} style={{width:'100%',padding:'12px',background:'var(--surface-light)',color:'var(--text)',border:'1px solid var(--border)',borderRadius:10,cursor:'pointer',fontSize: 'var(--fs-label)'}}>Встать со стола</button>
        </div>
      )}

      {game.status === 'playing' && isPlayer && (
        <div style={{display:'flex',gap:8,padding:'10px 14px',flexShrink:0}}>
          <button onClick={() => setShowResign(true)} style={{flex:1,padding:'13px',background:'var(--surface-light)',color:'#ef4444',border:'1px solid var(--border)',borderRadius:14,cursor:'pointer',fontSize: 'var(--fs-label)',fontWeight:600}}>Сдаться</button>
          <button onClick={() => offerDraw(game.id)} disabled={!!game.draw_offer_by} style={{flex:1,padding:'13px',background:'var(--surface-light)',color:game.draw_offer_by ? 'var(--muted)' : 'var(--text)',border:'1px solid var(--border)',borderRadius:14,cursor:game.draw_offer_by ? 'default' : 'pointer',fontSize: 'var(--fs-label)',fontWeight:600}}>{game.draw_offer_by ? 'Ничья предложена' : 'Предложить ничью'}</button>
        </div>
      )}

      {game.draw_offer_by && game.draw_offer_by !== myId && isPlayer && game.status === 'playing' && (
        <div style={{margin:'0 14px 10px',padding:12,background:'rgba(80, 120, 200, 0.15)',borderRadius:10,border:'1px solid rgba(80, 120, 200, 0.4)',flexShrink:0}}>
          <div style={{fontSize: 'var(--fs-label)',color:'var(--text)',marginBottom:8}}>Соперник предлагает ничью</div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={() => respondDraw(game.id, true)} style={{flex:1,padding:8,background:'#50c878',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize: 'var(--fs-caption)',fontWeight:600}}>Принять</button>
            <button onClick={() => respondDraw(game.id, false)} style={{flex:1,padding:8,background:'var(--surface-light)',color:'var(--text)',border:'1px solid var(--border)',borderRadius:8,cursor:'pointer',fontSize: 'var(--fs-caption)'}}>Отклонить</button>
          </div>
        </div>
      )}

      {isFinished && (
        <div className="chess-result-in" style={{margin:'0 14px 10px',padding:14,background:'var(--surface-light)',borderRadius:10,border:'1px solid var(--border)',flexShrink:0}}>
          <div style={{fontSize: 'var(--fs-heading)',fontWeight:700,color:'var(--text)',marginBottom:4}}>{game.result === '1/2-1/2' ? '🤝 ' : '🏆 '}{resultText}</div>
          <div style={{fontSize: 'var(--fs-micro)',color:'var(--muted)',marginBottom:8}}>{END_REASON_LABELS[game.end_reason || ''] || ''}</div>
          {game.white_elo_after != null && game.black_elo_after != null && (
            <div style={{fontSize: 'var(--fs-micro)',color:'var(--muted)'}}>
              Белые: {game.white_elo_before} → {game.white_elo_after} ({game.white_elo_after - (game.white_elo_before || 0) >= 0 ? '+' : ''}{game.white_elo_after - (game.white_elo_before || 0)})<br/>
              Чёрные: {game.black_elo_before} → {game.black_elo_after} ({game.black_elo_after - (game.black_elo_before || 0) >= 0 ? '+' : ''}{game.black_elo_after - (game.black_elo_before || 0)})
            </div>
          )}
          <button onClick={() => nav('/chess')} style={{marginTop:10,width:'100%',padding:10,background:'var(--accent)',color:'var(--bg)',border:'none',borderRadius:8,cursor:'pointer',fontSize: 'var(--fs-label)',fontWeight:600}}>В лобби</button>
        </div>
      )}

      {showResign && (
        <div onClick={() => setShowResign(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:90,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div onClick={e => e.stopPropagation()} style={{background:'var(--surface)',borderRadius:14,padding:20,maxWidth:'90vw',width:300}}>
            <h3 style={{margin:'0 0 8px',fontSize: 'var(--fs-snap16)',color:'var(--text)'}}>Сдаться?</h3>
            <p style={{margin:'0 0 16px',fontSize: 'var(--fs-label)',color:'var(--muted)'}}>Вы потеряете очки Elo.</p>
            <div style={{display:'flex',gap:8}}>
              <button onClick={() => setShowResign(false)} style={{flex:1,padding:10,background:'var(--surface-light)',color:'var(--text)',border:'1px solid var(--border)',borderRadius:8,cursor:'pointer',fontSize: 'var(--fs-label)'}}>Отмена</button>
              <button onClick={() => { setShowResign(false); resign(game.id); }} style={{flex:1,padding:10,background:'#ef4444',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize: 'var(--fs-label)',fontWeight:600}}>Сдаться</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
