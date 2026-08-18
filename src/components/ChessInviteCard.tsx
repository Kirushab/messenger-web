// Виджет шахматной партии в чате. Показывает живую мини-доску с текущей позицией
// (FEN), обновляется в реальном времени через Supabase channel, позволяет зайти в партию.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import ChessPieceSVG from './ChessPieceSVG';
import { SkeletonWidgetCard } from '@/components/Skeleton';

interface Props { gameId: string; }

interface ChessGameRow {
  id: string;
  name: string;
  mode: string;
  time_control: string;
  status: string;
  fen: string;
  white_id: string | null;
  black_id: string | null;
  created_by: string;
  settings: any;
  winner_id?: string | null;
}

const MODE_LABELS: Record<string, string> = {
  classic_2p: 'Классика · 2 игрока',
  cross_4p_ffa: '4 игрока · каждый сам',
  cross_4p_teams: 'Команды 2v2',
  bughouse_4p: 'Bughouse 2v2',
};

const TIME_LABELS: Record<string, string> = {
  unlimited: 'Без таймера',
  bullet_1: 'Bullet 1м',
  blitz_3: 'Blitz 3м',
  blitz_5: 'Blitz 5м',
  rapid_10: 'Rapid 10м',
  rapid_15: 'Rapid 15м',
};

const BOARD_THEMES = {
  light: { light: '#FFFFFF', dark: '#E5E7EB' },
  wood:  { light: '#F0D9B5', dark: '#B58863' },
};

/** Парсит первую часть FEN в 8×8 массив (от 8-го ряда к 1-му). */
function parseFen(fen: string): string[][] {
  const board: string[][] = [];
  const placement = fen.split(' ')[0] || '8/8/8/8/8/8/8/8';
  const rows = placement.split('/');
  for (const row of rows) {
    const cells: string[] = [];
    for (const ch of row) {
      if (/[1-8]/.test(ch)) {
        const n = parseInt(ch, 10);
        for (let i = 0; i < n; i++) cells.push('');
      } else {
        cells.push(ch);
      }
    }
    while (cells.length < 8) cells.push('');
    board.push(cells.slice(0, 8));
  }
  while (board.length < 8) board.push(['','','','','','','','']);
  return board;
}

/** Кто сейчас ходит (по FEN). */
function fenTurn(fen: string): 'white' | 'black' {
  const parts = fen.split(' ');
  return parts[1] === 'b' ? 'black' : 'white';
}

export default function ChessInviteCard({ gameId }: Props) {
  const nav = useNavigate();
  const [game, setGame] = useState<ChessGameRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatorName, setCreatorName] = useState('');

  // Подгрузка + realtime подписка на изменения партии
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: g } = await supabase
        .from('chess_games')
        .select('*')
        .eq('id', gameId)
        .maybeSingle();
      if (g && mounted) {
        setGame(g as ChessGameRow);
        const { data: u } = await supabase
          .from('users').select('display_name').eq('id', (g as ChessGameRow).created_by).maybeSingle();
        if (u?.display_name && mounted) setCreatorName(u.display_name);
      }
      if (mounted) setLoading(false);
    })();

    // Реал-тайм — следим за обновлениями FEN/статуса
    const ch = supabase.channel(`chess-widget:${gameId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'chess_games', filter: `id=eq.${gameId}`,
      }, (payload) => {
        if (mounted && payload.new) setGame(payload.new as ChessGameRow);
      })
      .subscribe();

    return () => { mounted = false; ch.unsubscribe(); };
  }, [gameId]);

  if (loading) {
    return <SkeletonWidgetCard compact />;
  }

  if (!game) {
    return (
      <div style={{
        padding: '14px 16px', background: 'var(--surface)', borderRadius: 16,
        fontSize: 'var(--fs-label)', color: 'var(--muted)', minWidth: 240,
      }}>Партия не найдена</div>
    );
  }

  const modeLabel = MODE_LABELS[game.mode] || game.mode;
  const timeLabel = TIME_LABELS[game.time_control] || game.time_control;
  const inProgress = game.status === 'playing';
  const finished = game.status === 'finished' || game.status === 'aborted';
  const isWaiting = game.status === 'waiting';

  const pieceStyle: string = game.settings?.piece_style || 'classic';
  const boardTheme: 'light' | 'wood' = (game.settings?.board_theme as any) || 'wood';
  const palette = BOARD_THEMES[boardTheme] || BOARD_THEMES.wood;

  const board = parseFen(game.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const turn = fenTurn(game.fen || '');

  return (
    <div style={{
      background: 'var(--surface-2)',
      borderRadius: 16,
      overflow: 'hidden',
      width: 280, maxWidth: '78vw', height: 384, boxSizing: 'border-box',
      boxShadow: 'var(--shadow-card)',
    }}>
      {/* Шапка */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '11px 13px', borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 'var(--fs-snap14)', fontWeight: 600, color: 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {game.name || 'Партия'}
          </div>
          <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', marginTop: 1 }}>
            {creatorName ? `от ${creatorName}` : modeLabel}
          </div>
        </div>
        {inProgress && (
          <div style={{
            padding: '3px 8px', background: '#10B981', color: '#fff',
            borderRadius: 8, fontSize: 'var(--fs-snap10)', fontWeight: 700, marginRight: 30,
          }}>LIVE</div>
        )}
        {finished && (
          <div style={{
            padding: '3px 8px', background: 'var(--surface-light)', color: 'var(--muted)',
            borderRadius: 8, fontSize: 'var(--fs-snap10)', fontWeight: 700, marginRight: 30,
          }}>END</div>
        )}
      </div>

      {/* Мини-доска */}
      <div style={{
        padding: 12, display: 'flex', justifyContent: 'center',
        background: 'var(--surface)',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          gridTemplateRows: 'repeat(8, 1fr)',
          width: 200, height: 200,
          borderRadius: 6, overflow: 'hidden',
          border: '1px solid var(--border)',
        }}>
          {board.flatMap((row, rIdx) =>
            row.map((piece, fIdx) => {
              const isLight = (rIdx + fIdx) % 2 === 0;
              return (
                <div key={`${rIdx}-${fIdx}`} style={{
                  background: isLight ? palette.light : palette.dark,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                }}>
                  {piece && (
                    <ChessPieceSVG
                      symbol={piece}
                      variant={pieceStyle}
                      size={22}
                      style={{ width: '85%', height: '85%' }}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Параметры + чей ход */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        padding: '0 13px 11px',
      }}>
        <span style={{
          fontSize: 'var(--fs-micro)', padding: '3px 8px',
          background: 'var(--surface-light)', borderRadius: 8, color: 'var(--text)',
        }}>{timeLabel}</span>
        {!finished && (
          <span style={{
            fontSize: 'var(--fs-micro)', padding: '3px 8px',
            background: turn === 'white' ? '#fff' : '#1F2937',
            color: turn === 'white' ? '#1F2937' : '#fff',
            border: '1px solid var(--border)',
            borderRadius: 8, fontWeight: 600,
          }}>
            Ход: {turn === 'white' ? 'белые' : 'чёрные'}
          </span>
        )}
      </div>

      {/* Кнопка */}
      <div style={{ padding: '0 13px 13px' }}>
        <button
          onClick={() => nav(`/chess/${game.id}`)}
          style={{
            width: '100%', padding: '10px 14px',
            background: finished ? 'var(--surface-light)' : 'var(--accent)',
            color: finished ? 'var(--text)' : 'var(--bg)',
            border: 'none', borderRadius: 12,
            fontSize: 'var(--fs-snap14)', fontWeight: 600, cursor: 'pointer',
          }}
        >
          {finished ? 'Посмотреть партию' : inProgress ? 'Смотреть / зайти' : isWaiting ? 'Присоединиться' : 'Открыть'}
        </button>
      </div>
    </div>
  );
}
