import { useState, useMemo, useEffect } from 'react';
import { Chess, type Square } from 'chess.js';

interface ChessBoardProps {
  fen: string;
  myColor: 'white' | 'black' | null; // null = зритель
  isMyTurn: boolean;
  disabled?: boolean;
  lastMove?: { from: string; to: string; captured?: string; promotion?: string; san?: string } | null;
  onMove: (params: {
    from: string; to: string; promotion?: string;
    san: string; fenAfter: string; pgnAfter: string;
    isCheckmate: boolean; isStalemate: boolean; isDraw: boolean;
    isThreefold: boolean; isInsufficient: boolean;
  }) => void;
  pgn?: string;
  /** Стиль фигур: 'classic', 'duo', или 'lichess:setName'. */
  pieceStyle?: string;
  /** Тема доски: 'light' белая, 'wood' классическая деревянная. */
  boardTheme?: 'light' | 'wood';
}

// Палитры доски — две: чистая светлая (как chess.com light) и тёплая деревянная.
const BOARD_THEMES = {
  light: { light: '#FFFFFF', dark: '#E5E7EB', selected: '#F8E16C', lastLight: '#FCE99A', lastDark: '#D6BC52' },
  wood:  { light: '#F0D9B5', dark: '#B58863', selected: '#D4A55C', lastLight: '#F7EC74', lastDark: '#DAC34D' },
};

import ChessPieceSVG from './ChessPieceSVG';

const FILES = ['a','b','c','d','e','f','g','h'];
const RANKS = ['8','7','6','5','4','3','2','1'];

export default function ChessBoard({ fen, myColor, isMyTurn, disabled, lastMove, onMove, pgn, pieceStyle = 'classic', boardTheme = 'wood' }: ChessBoardProps) {
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotionMove, setPromotionMove] = useState<{ from: Square; to: Square } | null>(null);

  // Инстанс шахмат для текущей позиции
  const chess = useMemo(() => {
    const c = new Chess();
    try {
      c.load(fen);
    } catch (e) {
      console.error('Bad FEN:', fen, e);
    }
    return c;
  }, [fen]);

  // Возможные ходы из выбранной клетки
  const possibleMoves = useMemo(() => {
    if (!selected) return [];
    return chess.moves({ square: selected, verbose: true });
  }, [chess, selected]);

  const possibleTargets = new Set(possibleMoves.map(m => m.to));

  // Шах: ищем клетку текущего короля если он под боем
  const checkedKingSquare = useMemo<Square | null>(() => {
    if (!chess.inCheck()) return null;
    // Чей ход — тот король под боем
    const turn = chess.turn(); // 'w' | 'b'
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const cell = board[r][f];
        if (cell && cell.type === 'k' && cell.color === turn) {
          const file = 'abcdefgh'[f];
          const rank = 8 - r;
          return (file + rank) as Square;
        }
      }
    }
    return null;
  }, [chess]);

  // Мат: shake + flash на короле
  const isCheckmate = chess.isCheckmate();
  const [shake, setShake] = useState(false);
  useEffect(() => {
    if (isCheckmate) {
      setShake(true);
      // Haptic
      if ('vibrate' in navigator) {
        try { navigator.vibrate([60, 80, 80, 80, 120]); } catch {}
      }
      const t = setTimeout(() => setShake(false), 600);
      return () => clearTimeout(t);
    }
  }, [isCheckmate]);

  // Перевернуть доску для чёрных
  const flipped = myColor === 'black';
  const ranks = flipped ? [...RANKS].reverse() : RANKS;
  const files = flipped ? [...FILES].reverse() : FILES;

  // Получить буквенный символ фигуры (P/N/B/R/Q/K, lowercase = чёрная)
  const getPiece = (square: Square): string | null => {
    const p = chess.get(square);
    if (!p) return null;
    return p.color === 'w' ? p.type.toUpperCase() : p.type.toLowerCase();
  };

  const handleSquareClick = (square: Square) => {
    if (disabled || !myColor) return;

    // Если выбрана своя фигура — попытка хода
    if (selected) {
      const move = possibleMoves.find(m => m.to === square);
      if (move) {
        // Превращение пешки?
        if (move.flags.includes('p')) {
          setPromotionMove({ from: selected, to: square });
          return;
        }
        executeMove(selected, square);
        return;
      }
      // Кликнули по той же клетке — снять выделение
      if (square === selected) {
        setSelected(null);
        return;
      }
    }

    // Выбрать свою фигуру
    const piece = chess.get(square);
    if (!piece) {
      setSelected(null);
      return;
    }
    if ((piece.color === 'w' && myColor === 'white') || (piece.color === 'b' && myColor === 'black')) {
      if (isMyTurn) setSelected(square);
    }
  };

  const executeMove = (from: Square, to: Square, promotion?: string) => {
    const tempChess = new Chess(fen);
    let moveResult;
    try {
      moveResult = tempChess.move({ from, to, promotion: promotion as any });
    } catch (e) {
      console.error('Invalid move:', e);
      setSelected(null);
      setPromotionMove(null);
      return;
    }
    if (!moveResult) {
      setSelected(null);
      return;
    }

    // Собираем PGN путём добавления хода
    const fullChess = new Chess();
    if (pgn) {
      try { fullChess.loadPgn(pgn); } catch (e) {}
    } else {
      fullChess.load(fen);
    }
    try {
      fullChess.move({ from, to, promotion: promotion as any });
    } catch (e) {}
    const newPgn = fullChess.pgn();

    onMove({
      from, to, promotion,
      san: moveResult.san,
      fenAfter: tempChess.fen(),
      pgnAfter: newPgn,
      isCheckmate: tempChess.isCheckmate(),
      isStalemate: tempChess.isStalemate(),
      isDraw: tempChess.isDraw(),
      isThreefold: tempChess.isThreefoldRepetition(),
      isInsufficient: tempChess.isInsufficientMaterial(),
    });

    setSelected(null);
    setPromotionMove(null);
  };

  const isLight = (file: number, rank: number) => (file + rank) % 2 === 0;

  // Анимация движущейся фигуры
  const [moveAnim, setMoveAnim] = useState<{ piece: string; fromX: number; fromY: number; toX: number; toY: number; phase: 'start'|'end' } | null>(null);
  // Анимация улетающей захваченной фигуры
  const [captureFly, setCaptureFly] = useState<{ piece: string; x: number; y: number; flyX: number; flyY: number } | null>(null);
  // Анимация ладьи при рокировке (для O-O / O-O-O)
  const [castleRook, setCastleRook] = useState<{ piece: string; fromX: number; fromY: number; toX: number; toY: number; phase: 'start'|'end' } | null>(null);

  useEffect(() => {
    if (!lastMove) return;
    const fileIdx = 'abcdefgh'.indexOf(lastMove.to[0]);
    const rankIdx = parseInt(lastMove.to[1]) - 1;
    const fromFileIdx = 'abcdefgh'.indexOf(lastMove.from[0]);
    const fromRankIdx = parseInt(lastMove.from[1]) - 1;

    let toX: number, toY: number, fromX: number, fromY: number;
    if (myColor === 'black') {
      toX = 7 - fileIdx; toY = rankIdx;
      fromX = 7 - fromFileIdx; fromY = fromRankIdx;
    } else {
      toX = fileIdx; toY = 7 - rankIdx;
      fromX = fromFileIdx; fromY = 7 - fromRankIdx;
    }

    const piece = chess.get(lastMove.to as Square);
    if (!piece) return;
    const sym = piece.color === 'w' ? piece.type.toUpperCase() : piece.type;

    setMoveAnim({ piece: sym, fromX, fromY, toX, toY, phase: 'start' });
    const t1 = setTimeout(() => setMoveAnim(prev => prev ? { ...prev, phase: 'end' } : null), 16);
    const t2 = setTimeout(() => setMoveAnim(null), 320);

    // ЗАХВАТ: если был capture, показываем улетающую фигуру
    let t3: any, t4: any;
    if (lastMove.captured) {
      const capSym = lastMove.captured;
      // Куда улетает (наружу доски, случайное направление)
      const dirs = [
        { x: -120, y: -80 }, { x: 120, y: -80 },
        { x: -100, y: 80 }, { x: 100, y: 80 },
      ];
      const dir = dirs[(fileIdx + rankIdx) % dirs.length];
      t3 = setTimeout(() => {
        setCaptureFly({ piece: capSym, x: toX, y: toY, flyX: dir.x, flyY: dir.y });
      }, 200);
      t4 = setTimeout(() => setCaptureFly(null), 900);
    }

    // РОКИРОВКА: если SAN === 'O-O' или 'O-O-O', анимируем ладью
    let t5: any, t6: any;
    if (lastMove.san === 'O-O' || lastMove.san === 'O-O-O') {
      const isKingSide = lastMove.san === 'O-O';
      const rank = lastMove.from[1];
      const rookFromFile = isKingSide ? 'h' : 'a';
      const rookToFile = isKingSide ? 'f' : 'd';
      const rookFromFileIdx = 'abcdefgh'.indexOf(rookFromFile);
      const rookToFileIdx = 'abcdefgh'.indexOf(rookToFile);
      const rookRankIdx = parseInt(rank) - 1;
      let rFromX, rFromY, rToX, rToY;
      if (myColor === 'black') {
        rFromX = 7 - rookFromFileIdx; rFromY = rookRankIdx;
        rToX = 7 - rookToFileIdx; rToY = rookRankIdx;
      } else {
        rFromX = rookFromFileIdx; rFromY = 7 - rookRankIdx;
        rToX = rookToFileIdx; rToY = 7 - rookRankIdx;
      }
      const rookPiece = piece.color === 'w' ? 'R' : 'r';
      setCastleRook({ piece: rookPiece, fromX: rFromX, fromY: rFromY, toX: rToX, toY: rToY, phase: 'start' });
      t5 = setTimeout(() => setCastleRook(prev => prev ? { ...prev, phase: 'end' } : null), 16);
      t6 = setTimeout(() => setCastleRook(null), 320);
    }

    return () => {
      clearTimeout(t1); clearTimeout(t2);
      if (t3) clearTimeout(t3); if (t4) clearTimeout(t4);
      if (t5) clearTimeout(t5); if (t6) clearTimeout(t6);
    };
  }, [lastMove?.from, lastMove?.to]);

  // Начальная позиция → stagger расстановка
  const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const isInitialPosition = fen.split(' ').slice(0, 4).join(' ') === INITIAL_FEN.split(' ').slice(0, 4).join(' ');

  return (
    <div style={{ width:'100%', maxWidth:'min(96vw, 480px)', margin:'0 auto', position:'relative' }}>
      <div className={shake ? 'chess-board-shake' : ''} style={{
        display:'grid',
        gridTemplateColumns:'repeat(8, 1fr)',
        gridTemplateRows:'repeat(8, 1fr)',
        aspectRatio:'1 / 1',
        // v58.14: премиум-рамка с многослойным деревянным градиентом
        padding: 8,
        background: `
          radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.06) 0%, transparent 50%),
          linear-gradient(135deg, #7a5536 0%, #4a3220 38%, #5a3a25 68%, #2e1e12 100%)
        `,
        borderRadius: 14,
        boxShadow: '0 14px 36px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.25)',
        overflow:'hidden',
      }}>
        {ranks.map((rank, ri) => files.map((file, fi) => {
          const square = (file + rank) as Square;
          const piece = getPiece(square);
          const isSelected = selected === square;
          const isPossibleMove = possibleTargets.has(square);
          const isLastFrom = lastMove?.from === square;
          const isLastTo = lastMove?.to === square;
          const isKingInCheck = checkedKingSquare === square;
          const isMatedKing = isCheckmate && isKingInCheck;
          const light = isLight(fi, ri);
          const palette = BOARD_THEMES[boardTheme];

          // Простые плоские цвета — без деревянной текстуры
          let bg: string;
          if (light) bg = palette.light;
          else bg = palette.dark;

          if (isSelected) bg = palette.selected;
          if (isLastFrom || isLastTo) {
            bg = light ? palette.lastLight : palette.lastDark;
          }

          let cellClass = 'tap-effect-light';
          if (isLastTo) cellClass += ' chess-square-flash';
          if (isKingInCheck && !isMatedKing) cellClass += ' chess-check-pulse';
          if (isMatedKing) cellClass += ' chess-mate-flash';

          return (
            <div
              key={square}
              onClick={() => handleSquareClick(square)}
              className={cellClass}
              style={{
                position:'relative',
                background: bg,
                boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.04)',
                display:'flex', alignItems:'center', justifyContent:'center',
                cursor: !disabled && myColor ? 'pointer' : 'default',
                userSelect:'none',
                fontSize:'min(8vw, 38px)',
                lineHeight:1,
                transition: 'background-color 200ms ease',
              }}
            >
              {piece && (
                <span
                  key={piece + (isLastTo ? '-moved' : '') + (isInitialPosition ? '-init' : '')}
                  className={
                    isInitialPosition
                      ? 'chess-piece-setup'
                      : (isLastTo
                          ? (lastMove?.promotion ? 'chess-promote' : 'anim-pop-in')
                          : '')
                  }
                  style={{
                    pointerEvents:'none',
                    animationDelay: isInitialPosition ? `${(ri * 8 + fi) * 25}ms` : undefined,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    width:'88%', height:'88%',
                  }}>
                  <ChessPieceSVG symbol={piece} variant={pieceStyle} style={{ width:"100%", height:"100%" }} />
                </span>
              )}
              {isPossibleMove && !piece && (
                <div className="chess-move-pulse" style={{
                  position:'absolute',
                  width:'30%', height:'30%',
                  borderRadius:'50%',
                  background:'rgba(0,0,0,0.3)',
                  pointerEvents:'none',
                }} />
              )}
              {isPossibleMove && piece && (
                <div style={{
                  position:'absolute', inset:0,
                  borderRadius:'50%',
                  border:'4px solid rgba(0,0,0,0.4)',
                  pointerEvents:'none',
                }} />
              )}
              {/* Координаты */}
              {fi === 0 && (
                <span style={{
                  position:'absolute', left:3, top:2,
                  fontSize:9, color: light ? '#6b4525' : '#f0d4a4',
                  fontWeight:700, pointerEvents:'none', textShadow: '0 1px 0 rgba(255,255,255,0.15)',
                }}>{rank}</span>
              )}
              {ri === 7 && (
                <span style={{
                  position:'absolute', right:3, bottom:2,
                  fontSize:9, color: light ? '#6b4525' : '#f0d4a4',
                  fontWeight:700, pointerEvents:'none', textShadow: '0 1px 0 rgba(255,255,255,0.15)',
                }}>{file}</span>
              )}
            </div>
          );
        }))}
      </div>

      {/* Overlay — летящая фигура для плавного движения */}
      {moveAnim && (
        <div style={{
          position: 'absolute',
          top: 4, left: 4, right: 4, bottom: 4,
          pointerEvents: 'none',
          overflow: 'hidden',
          borderRadius: 4,
        }}>
          <div style={{
            position: 'absolute',
            width: '12.5%',
            height: '12.5%',
            left: `${(moveAnim.phase === 'start' ? moveAnim.fromX : moveAnim.toX) * 12.5}%`,
            top: `${(moveAnim.phase === 'start' ? moveAnim.fromY : moveAnim.toY) * 12.5}%`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: moveAnim.phase === 'end' ? 'left 280ms cubic-bezier(0.4,0,0.2,1), top 280ms cubic-bezier(0.4,0,0.2,1)' : 'none',
            zIndex: 5,
          }}>
            <ChessPieceSVG symbol={moveAnim.piece} variant={pieceStyle} size={Math.min(window.innerWidth * 0.085, 42)} />
          </div>
        </div>
      )}

      {/* Overlay — летящая ладья при рокировке (одновременно с королём) */}
      {castleRook && (
        <div style={{
          position: 'absolute',
          top: 4, left: 4, right: 4, bottom: 4,
          pointerEvents: 'none',
          overflow: 'hidden',
          borderRadius: 4,
        }}>
          <div style={{
            position: 'absolute',
            width: '12.5%',
            height: '12.5%',
            left: `${(castleRook.phase === 'start' ? castleRook.fromX : castleRook.toX) * 12.5}%`,
            top: `${(castleRook.phase === 'start' ? castleRook.fromY : castleRook.toY) * 12.5}%`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: castleRook.phase === 'end' ? 'left 280ms cubic-bezier(0.4,0,0.2,1), top 280ms cubic-bezier(0.4,0,0.2,1)' : 'none',
            zIndex: 5,
          }}>
            <ChessPieceSVG symbol={castleRook.piece} variant={pieceStyle} size={Math.min(window.innerWidth * 0.085, 42)} />
          </div>
        </div>
      )}

      {/* Overlay — захваченная фигура улетает с rotate */}
      {captureFly && (
        <div style={{
          position: 'absolute',
          top: 4, left: 4, right: 4, bottom: 4,
          pointerEvents: 'none',
          overflow: 'visible',
          borderRadius: 4,
        }}>
          <div
            style={{
              position: 'absolute',
              width: '12.5%',
              height: '12.5%',
              left: `${captureFly.x * 12.5}%`,
              top: `${captureFly.y * 12.5}%`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              ['--fly-x' as any]: `${captureFly.flyX}px`,
              ['--fly-y' as any]: `${captureFly.flyY}px`,
              animation: 'chessCaptureFly 700ms cubic-bezier(0.5, 0, 0.75, 0) forwards',
              zIndex: 6,
            }}
          >
            <ChessPieceSVG symbol={captureFly.piece} variant={pieceStyle} size={Math.min(window.innerWidth * 0.085, 42)} />
          </div>
        </div>
      )}

      {/* Диалог превращения пешки */}
      {promotionMove && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.7)',
          zIndex:90, display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <div style={{
            background:'var(--surface)', borderRadius:16, padding:20,
            maxWidth:'90vw',
          }}>
            <h3 style={{ margin:'0 0 12px', fontSize: 'var(--fs-snap16)', color:'var(--text)', textAlign:'center' }}>Превращение пешки</h3>
            <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
              {(['q', 'r', 'b', 'n'] as const).map(p => {
                const symbol = myColor === 'white' ? p.toUpperCase() : p;
                return (
                  <button
                    key={p}
                    onClick={() => executeMove(promotionMove.from, promotionMove.to, p)}
                    style={{
                      width:64, height:64,
                      background: myColor === 'white' ? '#f0d9b5' : '#b58863',
                      border:'2px solid var(--border)', borderRadius:8,
                      cursor:'pointer',
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}
                  >
                    <ChessPieceSVG symbol={symbol} variant={pieceStyle} size={44} />
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => { setPromotionMove(null); setSelected(null); }}
              style={{
                marginTop:12, width:'100%', padding:10,
                background:'var(--surface-light)', border:'1px solid var(--border)',
                borderRadius:8, color:'var(--text)', cursor:'pointer',
              }}
            >Отмена</button>
          </div>
        </div>
      )}
    </div>
  );
}
