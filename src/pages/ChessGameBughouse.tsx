import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { useChessStore, type ChessGame } from '@/stores/chessStore';
import { toast } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import ChessBoard from '@/components/ChessBoard';
import { applyDrop, capturedPieceType, type DropPiece } from '@/lib/bughouseHelpers';

const PIECE_GLYPH: Record<string, string> = { P: '♟', N: '♞', B: '♝', R: '♜', Q: '♛' };
import ChessPieceSVG from '@/components/ChessPieceSVG';

function formatTime(ms: number | null): string {
  if (ms == null) return '∞';
  if (ms <= 0) return '00:00';
  const t = Math.floor(ms / 1000);
  return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
}

export default function ChessGameBughouse() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { session } = useAuthStore();
  const myId = session?.user.id;

  const { games, playerProfiles, loadPlayerProfile, sitDownBughouse, standUpBughouse, makeMoveBughouse, dropBughouse, resignBughouse } = useChessStore();

  const myBoard = id ? games[id] : undefined;
  const partnerId = myBoard?.partner_game_id ?? null;
  const partnerBoard = partnerId ? games[partnerId] : undefined;
  const matchId = myBoard?.bughouse_match_id ?? null;

  const [selectedDropPiece, setSelectedDropPiece] = useState<DropPiece | null>(null);
  const [dropTargetSquare, setDropTargetSquare] = useState<string | null>(null);
  const [showResign, setShowResign] = useState(false);

  // Подписываемся на обе доски
  useEffect(() => {
    if (!id) return;
    let ch1: any = null;
    let ch2: any = null;
    let partnerIdLocal: string | null = null;

    const load = async () => {
      // Загружаем основную
      const { data: g1 } = await supabase.from('chess_games').select('*').eq('id', id).single();
      if (g1) {
        useChessStore.setState(state => ({ games: { ...state.games, [id]: g1 as ChessGame } }));
        partnerIdLocal = g1.partner_game_id;
        if (g1.white_player_id) loadPlayerProfile(g1.white_player_id);
        if (g1.black_player_id) loadPlayerProfile(g1.black_player_id);

        if (partnerIdLocal) {
          const { data: g2 } = await supabase.from('chess_games').select('*').eq('id', partnerIdLocal).single();
          if (g2) {
            useChessStore.setState(state => ({ games: { ...state.games, [partnerIdLocal!]: g2 as ChessGame } }));
            if (g2.white_player_id) loadPlayerProfile(g2.white_player_id);
            if (g2.black_player_id) loadPlayerProfile(g2.black_player_id);
          }

          ch2 = supabase.channel(`bughouse_b2:${partnerIdLocal}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chess_games', filter: `id=eq.${partnerIdLocal}` }, (payload) => {
              const g = payload.new as ChessGame;
              useChessStore.setState(state => ({ games: { ...state.games, [g.id]: g } }));
              if (g.white_player_id) loadPlayerProfile(g.white_player_id);
              if (g.black_player_id) loadPlayerProfile(g.black_player_id);
            })
            .subscribe();
        }
      }

      ch1 = supabase.channel(`bughouse_b1:${id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chess_games', filter: `id=eq.${id}` }, (payload) => {
          const g = payload.new as ChessGame;
          useChessStore.setState(state => ({ games: { ...state.games, [g.id]: g } }));
          if (g.white_player_id) loadPlayerProfile(g.white_player_id);
          if (g.black_player_id) loadPlayerProfile(g.black_player_id);
        })
        .subscribe();
    };

    load();
    return () => {
      if (ch1) supabase.removeChannel(ch1);
      if (ch2) supabase.removeChannel(ch2);
    };
  }, [id, loadPlayerProfile]);

  // Live time
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!myBoard || myBoard.status !== 'playing' || myBoard.time_control === 'unlimited') return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [myBoard?.status, myBoard?.time_control]);

  const liveTime = useMemo(() => {
    if (!myBoard) return { white: null as number | null, black: null as number | null };
    if (myBoard.time_control === 'unlimited' || myBoard.status !== 'playing') {
      return { white: myBoard.white_time_ms, black: myBoard.black_time_ms };
    }
    const lastMoveAt = myBoard.last_move_at ? new Date(myBoard.last_move_at).getTime() : now;
    const elapsed = Math.max(0, now - lastMoveAt);
    if (myBoard.current_turn === 'white') {
      return { white: Math.max(0, (myBoard.white_time_ms ?? 0) - elapsed), black: myBoard.black_time_ms };
    }
    return { white: myBoard.white_time_ms, black: Math.max(0, (myBoard.black_time_ms ?? 0) - elapsed) };
  }, [myBoard, now]);

  if (!id || !myBoard) {
    return <div style={{padding:40,textAlign:'center',color:'var(--muted)'}}>Загрузка...</div>;
  }

  // Определяем мой цвет (на любой из 2 досок)
  let myColor: 'white' | 'black' | null = null;
  let myActualBoard = myBoard;
  if (myBoard.white_player_id === myId) { myColor = 'white'; myActualBoard = myBoard; }
  else if (myBoard.black_player_id === myId) { myColor = 'black'; myActualBoard = myBoard; }
  else if (partnerBoard && partnerBoard.white_player_id === myId) { myColor = 'white'; myActualBoard = partnerBoard; }
  else if (partnerBoard && partnerBoard.black_player_id === myId) { myColor = 'black'; myActualBoard = partnerBoard; }

  const isPlayer = myColor !== null;
  const isMyTurn = isPlayer && myActualBoard.status === 'playing' && myActualBoard.current_turn === myColor;
  const isWaiting = myBoard.status === 'waiting';

  // Drop pool — моих фигур
  const myDropPool: string[] = useMemo(() => {
    if (!myColor || !myActualBoard) return [];
    const pool = myColor === 'white' ? myActualBoard.white_drop_pool : myActualBoard.black_drop_pool;
    return pool || [];
  }, [myColor, myActualBoard]);

  // Last move
  const lastMove = useMemo(() => {
    if (!myActualBoard?.fen) return null;
    try {
      // Не сохраняем PGN в bughouse — пропускаем подсветку last move для упрощения
      return null;
    } catch { return null; }
  }, [myActualBoard?.fen]);

  // Партнёр играет ОТКРЫТЫМ цветом на партнёрской доске
  // Я (на myActualBoard) — myColor. Мой партнёр — на ДРУГОЙ доске, ИНОГО (противоположного на ней) цвета.
  // Но цвета между досками тоже разные:
  // Если я на board 1 white, мой партнёр на board 2 black.
  // Если я на board 1 black, мой партнёр на board 2 white.
  const partnerActualBoard = myActualBoard.id === myBoard.id ? partnerBoard : myBoard;
  const partnerColor: 'white' | 'black' | null =
    myColor === 'white' ? 'black' : myColor === 'black' ? 'white' : null;

  const handleMove = async (params: {
    from: string; to: string; promotion?: string;
    san: string; fenAfter: string; pgnAfter: string;
    isCheckmate: boolean; isStalemate: boolean;
  }) => {
    if (!myColor) return;
    // Определим что съели — нужно проверить старый FEN
    let captured: string | null = null;
    try {
      const c = new Chess(myActualBoard.fen);
      const move = c.move({ from: params.from, to: params.to, promotion: params.promotion as any });
      if (move?.captured) {
        captured = move.captured.toUpperCase();
      }
    } catch { /* ignore */ }

    const { error } = await makeMoveBughouse(myActualBoard.id, {
      from: params.from, to: params.to, promotion: params.promotion,
      san: params.san, fenAfter: params.fenAfter,
      captured,
      isCheckmate: params.isCheckmate, isStalemate: params.isStalemate,
    });
    if (error) toast.error('Ход отклонён: ' + error);
  };

  const handleDrop = async (piece: DropPiece, toSquare: string) => {
    if (!myColor) return;
    const result = applyDrop(myActualBoard.fen, piece, toSquare, myColor);
    if (!result) {
      toast.warning('Невозможно поставить фигуру на эту клетку');
      return;
    }
    const san = `@${piece}${toSquare}`; // Псевдо-SAN
    const { error } = await dropBughouse(myActualBoard.id, {
      piece, toSquare,
      san, fenAfter: result.newFen,
      isCheckmate: result.isCheckmate, isStalemate: result.isStalemate,
    });
    if (error) toast.error('Дроп отклонён: ' + error);
    setSelectedDropPiece(null);
    setDropTargetSquare(null);
  };

  const handleBoardClick = (square: string) => {
    // Если выбрана фигура для дропа — пробуем поставить
    if (selectedDropPiece) {
      handleDrop(selectedDropPiece, square);
    }
  };

  const playerName = (uid: string | null | undefined) => {
    if (!uid) return 'Свободно';
    return playerProfiles[uid]?.display_name || '...';
  };

  // Sit down helpers
  const handleSit = async (board: 1 | 2, color: 'white' | 'black') => {
    if (!matchId) return;
    const { error } = await sitDownBughouse(matchId, board, color);
    if (error) toast.error('Ошибка: ' + error);
  };

  const isFinished = myBoard.status === 'finished';
  let resultText = '';
  if (isFinished) {
    // Я выиграл если winner_id моего стола = я ИЛИ winner_id партнёрского стола = я (партнёр выиграл — мы оба выиграли)
    const iWon = myBoard.winner_id === myId || partnerBoard?.winner_id === myId;
    const myPartnerWon = (partnerBoard?.winner_id && partnerBoard?.white_player_id === myId === false && partnerBoard?.black_player_id === myId === false && partnerBoard.winner_id);
    if (myColor) {
      if (iWon) resultText = '🏆 Победа вашей команды';
      else resultText = '✕ Команда проиграла';
    } else {
      resultText = 'Партия окончена';
    }
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'calc(env(safe-area-inset-top, 0px) + 10px) 14px 10px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
        <button onClick={() => nav('/chess')} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text)',fontSize: 'var(--fs-snap24)',padding:0,lineHeight:1}}>‹</button>
        <div style={{flex:1,textAlign:'center',overflow:'hidden'}}>
          <div style={{fontSize: 'var(--fs-label)',fontWeight:600,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
            Bughouse · Доска {myActualBoard.board_number ?? '?'}
          </div>
          <div style={{fontSize: 'var(--fs-micro)',color:'var(--muted)'}}>
            {isWaiting && 'Ждём 4 игроков'}
            {myActualBoard.status === 'playing' && `Ход ${myActualBoard.current_turn === 'white' ? 'белых' : 'чёрных'}`}
            {isFinished && resultText}
          </div>
        </div>
        <div style={{width:24}} />
      </div>

      {/* Партнёрская доска — превью */}
      {partnerBoard && (
        <div style={{padding:'6px 12px', display:'flex', alignItems:'center', gap:8, background:'var(--surface-light)', borderBottom:'1px solid var(--border)', flexShrink:0}}>
          <div style={{fontSize: 'var(--fs-snap10)', color:'var(--muted)', textTransform:'uppercase', fontWeight:600}}>Партнёр (Доска {partnerBoard.board_number}):</div>
          <div style={{fontSize: 'var(--fs-caption)', color:'var(--text)', flex:1, minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', display:'flex', alignItems:'center', gap:4}}>
            <span style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
              {playerName(partnerBoard.white_player_id)} vs {playerName(partnerBoard.black_player_id)}
            </span>
            <span style={{color:'var(--muted)', display:'inline-flex', alignItems:'center', gap:4}}>· Ход: <ChessPieceSVG symbol={partnerBoard.current_turn === 'white' ? 'P' : 'p'} size={14} /></span>
          </div>
        </div>
      )}

      {/* Top player (соперник на моей доске) */}
      <div style={{padding:'8px 14px',display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
        <div style={{width:14,height:14,borderRadius:3,background: myColor === 'white' ? '#222' : '#fff',border:'1px solid #888'}} />
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize: 'var(--fs-label)',color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
            {myColor === 'white' ? playerName(myActualBoard.black_player_id) : playerName(myActualBoard.white_player_id)}
          </div>
        </div>
        <div style={{fontSize: 'var(--fs-snap16)',fontWeight:600,fontVariantNumeric:'tabular-nums',color: 'var(--text)'}}>
          {formatTime(myColor === 'white' ? liveTime.black : liveTime.white)}
        </div>
      </div>

      {/* Drop pool соперника */}
      <DropPoolStrip
        pool={(myColor === 'white' ? myActualBoard.black_drop_pool : myActualBoard.white_drop_pool) || []}
        color={myColor === 'white' ? 'black' : 'white'}
        canDrop={false}
      />

      {/* Доска */}
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'4px',overflow:'hidden'}}>
        <div style={{ width:'100%' }} onClick={(e) => {
          // Перехватываем клики по доске для дропа
          if (!selectedDropPiece) return;
          // Найдём целевую клетку — это решает ChessBoard, но в drop режиме мы перехватим клик
        }}>
          <ChessBoard
            fen={myActualBoard.fen}
            myColor={myColor}
            isMyTurn={isMyTurn && !selectedDropPiece}
            disabled={!isPlayer || myActualBoard.status !== 'playing'}
            lastMove={lastMove}
            onMove={handleMove}
            pgn=""
            pieceStyle={(myActualBoard as any).settings?.piece_style || 'classic'}
            boardTheme={(myActualBoard as any).settings?.board_theme || 'wood'}
          />
        </div>
      </div>

      {/* Drop pool мой (под доской) */}
      <DropPoolStrip
        pool={myDropPool}
        color={myColor ?? 'white'}
        canDrop={isMyTurn}
        selected={selectedDropPiece}
        onSelect={(p) => setSelectedDropPiece(selectedDropPiece === p ? null : p)}
      />

      {/* Bottom player (я) */}
      <div style={{padding:'8px 14px',display:'flex',alignItems:'center',gap:10,flexShrink:0,background: isMyTurn ? 'rgba(80,200,120,0.1)' : 'transparent'}}>
        <div style={{width:14,height:14,borderRadius:3,background: myColor === 'white' ? '#fff' : '#222',border:'1px solid #888'}} />
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize: 'var(--fs-label)',color:'var(--text)',fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
            {myColor === 'white' ? playerName(myActualBoard.white_player_id) : playerName(myActualBoard.black_player_id)}
          </div>
        </div>
        <div style={{fontSize: 'var(--fs-heading)',fontWeight:600,fontVariantNumeric:'tabular-nums',color: 'var(--text)'}}>
          {formatTime(myColor === 'white' ? liveTime.white : liveTime.black)}
        </div>
      </div>

      {/* Drop hint */}
      {selectedDropPiece && (
        <div style={{padding:'6px 14px', background:'rgba(80,120,200,0.15)', flexShrink:0, fontSize: 'var(--fs-caption)', color:'var(--text)', textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center', gap:6}}>
          Тапните на пустую клетку чтобы поставить <ChessPieceSVG symbol={myColor === 'white' ? selectedDropPiece.toUpperCase() : selectedDropPiece.toLowerCase()} size={16} />
        </div>
      )}

      {/* Sit down buttons */}
      {isWaiting && !isPlayer && matchId && (
        <div style={{padding:'8px 14px 18px', flexShrink:0}}>
          <div style={{fontSize: 'var(--fs-micro)', color:'var(--muted)', textAlign:'center', marginBottom:6, display:'flex', alignItems:'center', justifyContent:'center', gap:4, flexWrap:'wrap'}}>
            Команда A: Доска 1 <ChessPieceSVG symbol="P" size={13} /> + Доска 2 <ChessPieceSVG symbol="p" size={13} /> &nbsp;·&nbsp; Команда B: Доска 1 <ChessPieceSVG symbol="p" size={13} /> + Доска 2 <ChessPieceSVG symbol="P" size={13} />
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
            {!myBoard.white_player_id && (
              <button onClick={() => handleSit((myBoard.board_number || 1) as 1|2, 'white')} style={{padding:'10px',background:'#fff',color:'#000',border:'none',borderRadius:10,fontSize: 'var(--fs-caption)',fontWeight:600,cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6}}>
                Доска {myBoard.board_number} <ChessPieceSVG symbol="P" size={16} />
              </button>
            )}
            {!myBoard.black_player_id && (
              <button onClick={() => handleSit((myBoard.board_number || 1) as 1|2, 'black')} style={{padding:'10px',background:'#222',color:'#fff',border:'1px solid #555',borderRadius:10,fontSize: 'var(--fs-caption)',fontWeight:600,cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6}}>
                Доска {myBoard.board_number} <ChessPieceSVG symbol="p" size={16} />
              </button>
            )}
            {partnerBoard && !partnerBoard.white_player_id && (
              <button onClick={() => handleSit((partnerBoard.board_number || 2) as 1|2, 'white')} style={{padding:'10px',background:'#fff',color:'#000',border:'none',borderRadius:10,fontSize: 'var(--fs-caption)',fontWeight:600,cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6}}>
                Доска {partnerBoard.board_number} <ChessPieceSVG symbol="P" size={16} />
              </button>
            )}
            {partnerBoard && !partnerBoard.black_player_id && (
              <button onClick={() => handleSit((partnerBoard.board_number || 2) as 1|2, 'black')} style={{padding:'10px',background:'#222',color:'#fff',border:'1px solid #555',borderRadius:10,fontSize: 'var(--fs-caption)',fontWeight:600,cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6}}>
                Доска {partnerBoard.board_number} <ChessPieceSVG symbol="p" size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {isWaiting && isPlayer && matchId && (
        <div style={{padding:'10px 14px', flexShrink:0}}>
          <button onClick={() => standUpBughouse(matchId)} style={{
            width:'100%',padding:'10px',background:'var(--surface-light)',color:'var(--text)',
            border:'1px solid var(--border)',borderRadius:10,cursor:'pointer',fontSize: 'var(--fs-label)',
          }}>Встать со стола</button>
        </div>
      )}

      {/* Resign */}
      {myActualBoard.status === 'playing' && isPlayer && (
        <div style={{padding:'8px 14px', flexShrink:0}}>
          <button onClick={() => setShowResign(true)} style={{
            width:'100%',padding:'10px',background:'var(--surface-light)',color:'#ef4444',
            border:'1px solid var(--border)',borderRadius:10,cursor:'pointer',fontSize: 'var(--fs-label)',fontWeight:500,
          }}>Сдаться (вся команда проиграет)</button>
        </div>
      )}

      {/* Game over */}
      {isFinished && (
        <div style={{margin:'0 14px 10px',padding:12,background:'var(--surface-light)',borderRadius:10,border:'1px solid var(--border)',flexShrink:0}}>
          <div style={{fontSize: 'var(--fs-snap14)',fontWeight:600,color:'var(--text)',marginBottom:8}}>{resultText}</div>
          <button onClick={() => nav('/chess')} style={{marginTop:6,width:'100%',padding:10,background:'var(--accent)',color:'var(--bg)',border:'none',borderRadius:8,cursor:'pointer',fontSize: 'var(--fs-label)',fontWeight:600}}>В лобби</button>
        </div>
      )}

      {/* Resign modal */}
      {showResign && (
        <div onClick={() => setShowResign(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:90,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div onClick={e => e.stopPropagation()} style={{background:'var(--surface)',borderRadius:14,padding:20,maxWidth:'90vw',width:300}}>
            <h3 style={{margin:'0 0 8px',fontSize: 'var(--fs-snap16)',color:'var(--text)'}}>Сдаться?</h3>
            <p style={{margin:'0 0 16px',fontSize: 'var(--fs-label)',color:'var(--muted)'}}>Вместе с вами проиграет ваш партнёр на другой доске.</p>
            <div style={{display:'flex',gap:8}}>
              <button onClick={() => setShowResign(false)} style={{flex:1,padding:10,background:'var(--surface-light)',color:'var(--text)',border:'1px solid var(--border)',borderRadius:8,cursor:'pointer',fontSize: 'var(--fs-label)'}}>Отмена</button>
              <button onClick={() => { setShowResign(false); resignBughouse(myActualBoard.id); }} style={{flex:1,padding:10,background:'#ef4444',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize: 'var(--fs-label)',fontWeight:600}}>Сдаться</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DropPoolStrip({ pool, color, canDrop, selected, onSelect }: {
  pool: string[]; color: 'white' | 'black'; canDrop: boolean;
  selected?: DropPiece | null;
  onSelect?: (p: DropPiece) => void;
}) {
  if (pool.length === 0) {
    return (
      <div style={{height:32, padding:'4px 14px', display:'flex', alignItems:'center', flexShrink:0, gap:4}}>
        <div style={{fontSize: 'var(--fs-snap10)', color:'var(--muted)', display:'flex', alignItems:'center', gap:4}}>
          Drop pool
          <ChessPieceSVG symbol={color === 'white' ? 'P' : 'p'} size={14} />
          : пусто
        </div>
      </div>
    );
  }
  return (
    <div style={{padding:'6px 12px', display:'flex', gap:4, flexShrink:0, alignItems:'center', flexWrap:'wrap'}}>
      <div style={{fontSize: 'var(--fs-snap10)', color:'var(--muted)', marginRight:4, display:'flex', alignItems:'center', gap:4}}>
        Pool
        <ChessPieceSVG symbol={color === 'white' ? 'P' : 'p'} size={14} />
        :
      </div>
      {pool.map((p, i) => {
        const isSelected = selected === p;
        const sym = color === 'white' ? p.toUpperCase() : p.toLowerCase();
        return (
          <button
            key={i}
            disabled={!canDrop}
            onClick={() => onSelect?.(p as DropPiece)}
            style={{
              width:32, height:32, padding:0,
              background: isSelected ? 'rgba(80,200,120,0.3)' : (color === 'white' ? '#f0d9b5' : '#b58863'),
              border: isSelected ? '2px solid #50c878' : '1px solid var(--border)',
              borderRadius:6,
              cursor: canDrop ? 'pointer' : 'default',
              opacity: canDrop ? 1 : 0.5,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}
          >
            <ChessPieceSVG symbol={sym} size={22} />
          </button>
        );
      })}
    </div>
  );
}
