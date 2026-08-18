import { useEffect } from 'react';
import { useChessStore, type ChessGame } from '@/stores/chessStore';
import { useAuthStore } from '@/stores/authStore';

const COLOR_FILL: Record<string, string> = {
  // Должно совпадать с COLOR_STYLES.fill в FourPlayerBoard.tsx
  R: '#A0212F', B: '#2A4A8C', Y: '#C8911E', G: '#2A7A4F',
};

const END_REASON_RU: Record<string, string> = {
  checkmate: 'мат', stalemate: 'пат', resignation: 'сдача',
  timeout: 'время', draw_agreed: 'ничья',
  threefold_repetition: '3× повторение', fifty_move_rule: '50 ходов',
  insufficient_material: 'недостаточно фигур', aborted: 'прервано',
};

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return 'только что';
  if (diffMin < 60) return `${diffMin} мин назад`;
  if (diffHr < 24) return `${diffHr} ч назад`;
  if (diffDay < 7) return `${diffDay} дн назад`;
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function ChessHistory() {
  const { session } = useAuthStore();
  const myId = session?.user.id;
  const { myHistory, playerProfiles, loadMyHistory } = useChessStore();

  useEffect(() => {
    if (myId) loadMyHistory(myId);
  }, [myId, loadMyHistory]);

  const playerName = (uid: string | null | undefined) => {
    if (!uid) return '—';
    return playerProfiles[uid]?.display_name || '...';
  };

  const renderGame = (g: ChessGame) => {
    if (g.mode === 'cross_4p') return render4P(g);
    return render2P(g);
  };

  // 2p карточка
  const render2P = (g: ChessGame) => {
    if (!myId) return null;
    const myColor: 'white' | 'black' = g.white_player_id === myId ? 'white' : 'black';
    const oppId = myColor === 'white' ? g.black_player_id : g.white_player_id;

    let outcome: 'win' | 'loss' | 'draw' = 'draw';
    if (g.result === '1/2-1/2') outcome = 'draw';
    else if ((g.result === '1-0' && myColor === 'white') || (g.result === '0-1' && myColor === 'black')) outcome = 'win';
    else outcome = 'loss';

    const myEloBefore = myColor === 'white' ? g.white_elo_before : g.black_elo_before;
    const myEloAfter = myColor === 'white' ? g.white_elo_after : g.black_elo_after;
    const eloChange = (myEloAfter ?? 0) - (myEloBefore ?? 0);

    return (
      <div key={g.id} style={{
        background:'var(--surface-light)', borderRadius:12, padding:12, marginBottom:8,
        border:'1px solid var(--border)',
        borderLeft: `4px solid ${outcome === 'win' ? '#50c878' : outcome === 'loss' ? '#ef4444' : '#888'}`,
      }}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6}}>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize: 'var(--fs-label)', fontWeight:600, color:'var(--text)', marginBottom:2}}>
              {outcome === 'win' ? '🏆 Победа' : outcome === 'loss' ? '✕ Поражение' : '½ Ничья'}
              <span style={{fontSize: 'var(--fs-micro)', color:'var(--muted)', marginLeft:6, fontWeight:400}}>
                · {g.end_reason ? END_REASON_RU[g.end_reason] : ''}
              </span>
            </div>
            <div style={{fontSize: 'var(--fs-caption)', color:'var(--muted)'}}>
              vs {playerName(oppId)} · за {myColor === 'white' ? 'белых' : 'чёрных'}
            </div>
          </div>
          <div style={{textAlign:'right', flexShrink:0, marginLeft:8}}>
            <div style={{
              fontSize: 'var(--fs-label)', fontWeight:600,
              color: eloChange > 0 ? '#50c878' : eloChange < 0 ? '#ef4444' : 'var(--muted)',
              fontVariantNumeric:'tabular-nums',
            }}>
              {eloChange > 0 ? '+' : ''}{eloChange}
            </div>
            <div style={{fontSize: 'var(--fs-snap10)', color:'var(--muted)'}}>{myEloAfter}</div>
          </div>
        </div>
        <div style={{fontSize: 'var(--fs-snap10)', color:'var(--muted)'}}>
          {g.finished_at ? formatRelativeDate(g.finished_at) : ''}
        </div>
      </div>
    );
  };

  // 4p карточка
  const render4P = (g: ChessGame) => {
    if (!myId) return null;
    const myColor =
      g.red_player_id === myId ? 'R' :
      g.blue_player_id === myId ? 'B' :
      g.yellow_player_id === myId ? 'Y' :
      g.green_player_id === myId ? 'G' : null;
    if (!myColor) return null;

    const eloBefore =
      myColor === 'R' ? g.red_elo_before :
      myColor === 'B' ? g.blue_elo_before :
      myColor === 'Y' ? g.yellow_elo_before :
      g.green_elo_before;
    const eloAfter =
      myColor === 'R' ? g.red_elo_after :
      myColor === 'B' ? g.blue_elo_after :
      myColor === 'Y' ? g.yellow_elo_after :
      g.green_elo_after;
    const eloChange = (eloAfter ?? 0) - (eloBefore ?? 0);

    const iWon = g.winner_id === myId;
    let outcome: 'win' | 'loss' | 'draw' = 'loss';
    if (g.result === '1/2-1/2') outcome = 'draw';
    else if (iWon) outcome = 'win';
    else if (g.team_mode === 'teams_2v2') {
      // В командах если выиграл партнёр — это тоже наша победа
      const partner =
        myColor === 'R' ? 'Y' :
        myColor === 'Y' ? 'R' :
        myColor === 'B' ? 'G' : 'B';
      const partnerId =
        partner === 'R' ? g.red_player_id :
        partner === 'B' ? g.blue_player_id :
        partner === 'Y' ? g.yellow_player_id :
        g.green_player_id;
      if (g.winner_id === partnerId) outcome = 'win';
    }

    const modeLabel = g.team_mode === 'teams_2v2' ? 'Команды 2v2' : 'FFA';

    return (
      <div key={g.id} style={{
        background:'var(--surface-light)', borderRadius:12, padding:12, marginBottom:8,
        border:'1px solid var(--border)',
        borderLeft: `4px solid ${outcome === 'win' ? '#50c878' : outcome === 'loss' ? '#ef4444' : '#888'}`,
      }}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6}}>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize: 'var(--fs-label)', fontWeight:600, color:'var(--text)', marginBottom:2}}>
              {outcome === 'win' ? '🏆 Победа' : outcome === 'draw' ? '½ Ничья' : '✕ Поражение'}
              <span style={{fontSize: 'var(--fs-snap10)', padding:'1px 6px', borderRadius:4, background:'var(--bg)', color:'var(--muted)', marginLeft:6, fontWeight:400}}>
                4p · {modeLabel}
              </span>
            </div>
            <div style={{fontSize: 'var(--fs-caption)', color:'var(--muted)', display:'flex', alignItems:'center', gap:6}}>
              За <span style={{
                display:'inline-block', width:8, height:8, borderRadius:2,
                background: COLOR_FILL[myColor], marginLeft:2,
              }} />
            </div>
          </div>
          <div style={{textAlign:'right', flexShrink:0, marginLeft:8}}>
            <div style={{
              fontSize: 'var(--fs-label)', fontWeight:600,
              color: eloChange > 0 ? '#50c878' : eloChange < 0 ? '#ef4444' : 'var(--muted)',
              fontVariantNumeric:'tabular-nums',
            }}>
              {eloChange > 0 ? '+' : ''}{eloChange}
            </div>
            <div style={{fontSize: 'var(--fs-snap10)', color:'var(--muted)'}}>{eloAfter}</div>
          </div>
        </div>
        <div style={{fontSize: 'var(--fs-snap10)', color:'var(--muted)'}}>
          {g.finished_at ? formatRelativeDate(g.finished_at) : ''}
        </div>
      </div>
    );
  };

  if (myHistory.length === 0) {
    return (
      <div style={{padding:'40px 20px', textAlign:'center', color:'var(--muted)'}}>
        {/* v58.14: SVG свиток вместо 📜 emoji */}
        <div style={{display:'flex', justifyContent:'center', marginBottom:10, opacity:0.5}}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 4 H 18 A 2 2 0 0 1 20 6 A 2 2 0 0 1 18 8 H 4 A 2 2 0 0 1 6 4 Z"/>
            <path d="M4 8 V 18 A 2 2 0 0 0 6 20 H 18 A 2 2 0 0 1 16 18 V 8"/>
            <line x1="8" y1="12" x2="14" y2="12"/>
            <line x1="8" y1="16" x2="13" y2="16"/>
          </svg>
        </div>
        <div style={{fontSize: 'var(--fs-label)'}}>Партий ещё не было</div>
        <div style={{fontSize: 'var(--fs-micro)', marginTop:4}}>Сыграйте на одном из столов</div>
      </div>
    );
  }

  return (
    <div style={{padding:12}}>
      {myHistory.map(renderGame)}
    </div>
  );
}
