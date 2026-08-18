import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChessStore } from '@/stores/chessStore';
import { useAuthStore } from '@/stores/authStore';
import PullToRefresh from '@/components/PullToRefresh';
import ChessHistory from '@/components/ChessHistory';
import ChessLeaderboard from '@/components/ChessLeaderboard';
import SwipeToDeleteRow from '@/components/SwipeToDeleteRow';
import { toast } from '@/stores/toastStore';
import { haptic } from '@/lib/haptics';

type Tab = 'tables' | 'history' | 'top';

const TIME_CONTROL_LABELS: Record<string, string> = {
  bullet_1: 'Bullet 1м',
  blitz_3: 'Blitz 3м',
  blitz_5: 'Blitz 5м',
  rapid_10: '⏱ Rapid 10м',
  rapid_15: '⏱ Rapid 15м',
  unlimited: '∞ Без таймера',
};

const STATUS_LABELS: Record<string, string> = {
  waiting: 'Ждём игроков',
  playing: 'Идёт партия',
  finished: 'Завершено',
};

export default function ChessLobby() {
  const nav = useNavigate();
  const { session } = useAuthStore();
  const { lobbyGames, playerProfiles, loadLobby, deleteGame } = useChessStore();
  const myId = session?.user.id;
  const [tab, setTab] = useState<Tab>('tables');

  useEffect(() => {
    if (tab !== 'tables') return;
    loadLobby();
    const interval = setInterval(loadLobby, 5000);
    return () => clearInterval(interval);
  }, [loadLobby, tab]);

  const playerName = (uid: string | null) => {
    if (!uid) return null;
    return playerProfiles[uid]?.display_name || '...';
  };

  const playerElo = (uid: string | null) => {
    if (!uid) return null;
    return playerProfiles[uid]?.chess_elo ?? 1200;
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Header */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'calc(env(safe-area-inset-top, 0px) + 12px) 16px 12px', borderBottom:'1px solid var(--border)',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button
            onClick={() => nav('/apps')}
            style={{
              background:'none', border:'none', cursor:'pointer',
              color:'var(--text)', fontSize: 'var(--fs-snap24)', padding:0, lineHeight:1,
            }}
          >‹</button>
          <h2 style={{ margin:0, fontSize: 'var(--fs-heading)', color:'var(--text)' }}>Шахматы</h2>
        </div>
        <button
          onClick={() => { haptic.tap(); nav('/chess/create'); }}
          style={{
            padding:'8px 14px', background:'var(--accent)', color:'var(--bg)',
            border:'none', borderRadius:8, fontSize: 'var(--fs-snap14)', fontWeight:600, cursor:'pointer',
          }}
        >+ Стол</button>
      </div>

      {/* My rating */}
      {myId && playerProfiles[myId] && (
        <div style={{
          padding:'10px 16px', display:'flex', alignItems:'center', gap:12,
          background:'var(--surface-light)', borderBottom:'1px solid var(--border)',
        }}>
          <div style={{ fontSize: 'var(--fs-caption)', color:'var(--muted)' }}>Ваш Elo:</div>
          <div style={{ fontSize: 'var(--fs-heading)', fontWeight:600, color:'var(--text)' }}>
            {playerProfiles[myId].chess_elo}
          </div>
          <div style={{ fontSize: 'var(--fs-micro)', color:'var(--muted)', marginLeft:'auto' }}>
            Партий: {playerProfiles[myId].chess_games_played}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{
        display:'flex', gap:0, padding:'8px 12px 0',
        borderBottom:'1px solid var(--border)',
      }}>
        {([
          { id: 'tables' as Tab, label: 'Столы' },
          { id: 'history' as Tab, label: 'История' },
          { id: 'top' as Tab, label: 'Топ-10' },
        ]).map(t => (
          <button key={t.id} onClick={() => { haptic.tap(); setTab(t.id); }} style={{
            flex:1, padding:'10px 0',
            background:'transparent', border:'none',
            borderBottom:'2px solid',
            borderBottomColor: tab === t.id ? 'var(--accent)' : 'transparent',
            color: tab === t.id ? 'var(--text)' : 'var(--muted)',
            fontWeight: tab === t.id ? 600 : 500,
            fontSize: 'var(--fs-label)', cursor:'pointer',
            transition:'all .2s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* History tab */}
      {tab === 'history' && (
        <div className="page-scroll">
          <ChessHistory />
        </div>
      )}

      {/* Top-10 tab */}
      {tab === 'top' && (
        <div className="page-scroll">
          <ChessLeaderboard />
        </div>
      )}

      {/* Tables tab */}
      {tab === 'tables' && (
      <PullToRefresh className="page-scroll" onRefresh={() => loadLobby()} style={{ padding:12 }}>
        {lobbyGames.length === 0 && (
          <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--muted)' }}>
            {/* v58.14: SVG пешка вместо ♟ юникод-эмодзи (рендерилась как Apple emoji) */}
            <div style={{ display:'flex', justifyContent:'center', marginBottom:12, opacity:0.45 }}>
              <svg width="56" height="56" viewBox="0 0 45 45" fill="currentColor" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
                <circle cx="22.5" cy="10.5" r="4.5"/>
                <path d="M19 14.5 Q22.5 17 26 14.5 L26 17 Q22.5 18.5 19 17 Z"/>
                <path d="M17 18 L28 18 L31 30 L14 30 Z"/>
                <path d="M12 30 L33 30 L34.5 36 L10.5 36 Z"/>
                <path d="M10 36 L35 36 L36 39.5 L9 39.5 Z"/>
              </svg>
            </div>
            <div style={{ fontSize: 'var(--fs-snap14)', marginBottom:16 }}>Пока нет столов</div>
            <button
              onClick={() => { haptic.tap(); nav('/chess/create'); }}
              style={{
                padding:'10px 20px', background:'var(--accent)', color:'var(--bg)',
                border:'none', borderRadius:10, fontSize: 'var(--fs-snap14)', fontWeight:600, cursor:'pointer',
              }}
            >Создать первый стол</button>
          </div>
        )}

        {lobbyGames.map((g, gi) => {
          const canDelete = g.created_by === myId;
          const card = (
            <div
              onClick={() => { haptic.tap(); nav(`/chess/${g.id}`); }}
              className="chess-lobby-card"
              style={{
                background:'var(--surface-light)', borderRadius:12, padding:14, marginBottom:10,
                cursor:'pointer', border:'1px solid var(--border)',
                animationDelay: Math.min(gi, 12) * 35 + 'ms',
              }}
            >
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
              <div style={{ fontSize: 'var(--fs-body)', fontWeight:600, color:'var(--text)', flex:1, minWidth:0, marginRight:8 }}>
                {g.name}
              </div>
              <div style={{
                fontSize: 'var(--fs-micro)', padding:'3px 8px', borderRadius:6,
                background: g.status === 'playing' ? 'rgba(80, 200, 120, 0.2)' : 'var(--bg)',
                color: g.status === 'playing' ? '#50c878' : 'var(--muted)',
                whiteSpace:'nowrap',
              }}>
                {STATUS_LABELS[g.status] || g.status}
              </div>
            </div>

            <div style={{ display:'flex', gap:6, marginBottom:8, flexWrap:'wrap' }}>
              <span style={{
                fontSize: 'var(--fs-micro)', padding:'2px 8px', background:'var(--bg)',
                color:'var(--muted)', borderRadius:6,
              }}>{TIME_CONTROL_LABELS[g.time_control]}</span>
              {g.mode === 'cross_4p' && (
                <span style={{
                  fontSize: 'var(--fs-micro)', padding:'2px 8px',
                  background:'rgba(234, 179, 8, 0.15)', color:'#eab308',
                  borderRadius:6, fontWeight:600,
                  display:'inline-flex', alignItems:'center', gap:4,
                }}>
                  {g.team_mode === 'teams_2v2' ? (
                    // Рукопожатие — команды
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 17 L8 14 C 7 13 7 11.5 8 10.5 L 11 7.5"/>
                        <path d="M13 17 L16 14 C 17 13 17 11.5 16 10.5 L 13 7.5"/>
                        <path d="M3 11 L6 8 L 10 9"/>
                        <path d="M21 11 L18 8 L 14 9"/>
                      </svg>
                      4p Команды
                    </>
                  ) : (
                    // Скрещённые мечи — FFA
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 3 L 13 13 M 3 5 L 5 3"/>
                        <path d="M21 3 L 11 13 M 19 3 L 21 5"/>
                        <path d="M12 14 L 19 21 L 21 21 L 21 19 L 14 12"/>
                        <path d="M12 14 L 5 21 L 3 21 L 3 19 L 10 12"/>
                      </svg>
                      4p FFA
                    </>
                  )}
                </span>
              )}
              {g.mode === 'bughouse_4p' && (
                <span style={{
                  fontSize: 'var(--fs-micro)', padding:'2px 8px',
                  background:'rgba(168, 85, 247, 0.15)', color:'#a855f7',
                  borderRadius:6, fontWeight:600,
                  display:'inline-flex', alignItems:'center', gap:4,
                }}>
                  {/* Передача — две стрелки */}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 1l4 4-4 4"/>
                    <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                    <path d="M7 23l-4-4 4-4"/>
                    <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                  </svg>
                  Bughouse · Доска {g.board_number}
                </span>
              )}
            </div>

            {g.mode === 'cross_4p' ? (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, fontSize: 'var(--fs-micro)' }}>
                {([
                  ['R','#dc2626','Красные', g.red_player_id],
                  ['B','#2563eb','Синие', g.blue_player_id],
                  ['Y','#eab308','Жёлтые', g.yellow_player_id],
                  ['G','#16a34a','Зелёные', g.green_player_id],
                ] as const).map(([c, fill, label, uid]) => (
                  <div key={c} style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <div style={{ width:8, height:8, borderRadius:2, background: fill }} />
                    <span style={{ color: uid ? 'var(--text)' : 'var(--muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {uid ? playerName(uid) : 'Свободно'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display:'flex', gap:12, alignItems:'center', fontSize: 'var(--fs-caption)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <div style={{ width:14, height:14, borderRadius:3, background:'#fff', border:'1px solid #999' }} />
                  <span style={{ color: g.white_player_id ? 'var(--text)' : 'var(--muted)' }}>
                    {g.white_player_id ? `${playerName(g.white_player_id)} (${playerElo(g.white_player_id)})` : 'Свободно'}
                  </span>
                </div>
                <div style={{ color:'var(--muted)' }}>vs</div>
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <div style={{ width:14, height:14, borderRadius:3, background:'#222', border:'1px solid #555' }} />
                  <span style={{ color: g.black_player_id ? 'var(--text)' : 'var(--muted)' }}>
                    {g.black_player_id ? `${playerName(g.black_player_id)} (${playerElo(g.black_player_id)})` : 'Свободно'}
                  </span>
                </div>
              </div>
            )}
          </div>
          );
          return canDelete ? (
            <SwipeToDeleteRow
              key={g.id}
              onDelete={async () => {
                const { error } = await deleteGame(g.id);
                if (error) toast.error('Не удалось удалить: ' + error);
                else toast.success('Стол удалён');
              }}
            >
              {card}
            </SwipeToDeleteRow>
          ) : <div key={g.id}>{card}</div>;
        })}
      </PullToRefresh>
      )}
    </div>
  );
}
