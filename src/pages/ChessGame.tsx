import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useChessStore } from '@/stores/chessStore';
import ChessGame2P from './ChessGame2P';
import ChessGame4P from './ChessGame4P';
import ChessGameBughouse from './ChessGameBughouse';

export default function ChessGame() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { games, subscribeToGame, unsubscribeFromGame } = useChessStore();
  const game = id ? games[id] : undefined;

  useEffect(() => {
    if (!id) return;
    // Для bughouse не подписываемся через стандартный subscribe — там своя логика подписки на 2 доски
    if (game?.mode === 'bughouse_4p') return;
    subscribeToGame(id);
    return () => { unsubscribeFromGame(); };
  }, [id, game?.mode, subscribeToGame, unsubscribeFromGame]);

  if (!id) return <div style={{padding:40,textAlign:'center',color:'var(--muted)'}}>Загрузка...</div>;

  // Для bughouse сразу рендерим — он сам загружает обе доски
  if (game?.mode === 'bughouse_4p') return <ChessGameBughouse />;

  if (!game) return <div style={{padding:40,textAlign:'center',color:'var(--muted)'}}>Загрузка...</div>;

  if (game.mode === 'cross_4p') return <ChessGame4P />;
  return <ChessGame2P />;
}
