import { useEffect } from 'react';
import { useChessStore } from '@/stores/chessStore';
import { useAuthStore } from '@/stores/authStore';

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function ChessLeaderboard() {
  const { session } = useAuthStore();
  const myId = session?.user.id;
  const { leaderboard, loadLeaderboard } = useChessStore();

  useEffect(() => {
    loadLeaderboard();
    const interval = setInterval(loadLeaderboard, 30000);
    return () => clearInterval(interval);
  }, [loadLeaderboard]);

  if (leaderboard.length === 0) {
    return (
      <div style={{padding:'40px 20px', textAlign:'center', color:'var(--muted)'}}>
        {/* v58.14: SVG кубок вместо 🏆 emoji */}
        <div style={{display:'flex', justifyContent:'center', marginBottom:10, opacity:0.55, color:'#d4a93b'}}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0.6" strokeLinejoin="round">
            <path d="M6 4 H 18 V 8 A 6 6 0 0 1 6 8 Z"/>
            <path d="M6 5 H 4 A 2 2 0 0 0 4 9 H 6.5" fill="none" strokeWidth="1.4"/>
            <path d="M18 5 H 20 A 2 2 0 0 1 20 9 H 17.5" fill="none" strokeWidth="1.4"/>
            <rect x="10" y="14" width="4" height="4"/>
            <path d="M8 18 H 16 L 17 21 H 7 Z"/>
          </svg>
        </div>
        <div style={{fontSize: 'var(--fs-label)'}}>Пока никто не сыграл партий</div>
        <div style={{fontSize: 'var(--fs-micro)', marginTop:4}}>Будь первым в рейтинге</div>
      </div>
    );
  }

  return (
    <div style={{padding:12}}>
      <div style={{
        fontSize: 'var(--fs-micro)', color:'var(--muted)', marginBottom:10, textAlign:'center',
      }}>
        Рейтинг Elo · топ-10 игроков
      </div>
      {leaderboard.map((p, idx) => {
        const place = idx + 1;
        const isMe = p.id === myId;
        return (
          <div key={p.id} style={{
            display:'flex', alignItems:'center', gap:10,
            padding:'10px 12px', marginBottom:6,
            background: isMe ? 'rgba(80,120,200,0.15)' : 'var(--surface-light)',
            border:'1px solid', borderColor: isMe ? 'rgba(80,120,200,0.4)' : 'var(--border)',
            borderRadius:10,
          }}>
            <div style={{
              width:30, textAlign:'center', fontSize: 'var(--fs-snap16)', fontWeight:700,
              color: place <= 3 ? 'var(--text)' : 'var(--muted)',
            }}>
              {MEDAL[place] || place}
            </div>
            <div style={{
              width:34, height:34, borderRadius:'50%',
              background: p.avatar_url ? 'var(--surface)' : 'var(--accent)',
              backgroundImage: p.avatar_url ? `url(${p.avatar_url})` : undefined,
              backgroundSize:'cover', backgroundPosition:'center',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize: 'var(--fs-snap14)', fontWeight:600, color:'var(--bg)',
              flexShrink:0,
            }}>
              {!p.avatar_url && (p.display_name?.[0]?.toUpperCase() || '?')}
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{
                fontSize: 'var(--fs-snap14)', fontWeight: isMe ? 700 : 500, color:'var(--text)',
                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
              }}>
                {p.display_name}
                {isMe && <span style={{fontSize: 'var(--fs-snap10)', color:'var(--muted)', marginLeft:6, fontWeight:400}}>(вы)</span>}
              </div>
              <div style={{fontSize: 'var(--fs-micro)', color:'var(--muted)'}}>
                Партий: {p.chess_games_played}
              </div>
            </div>
            <div style={{textAlign:'right', flexShrink:0}}>
              <div style={{fontSize: 'var(--fs-snap16)', fontWeight:700, color:'var(--text)', fontVariantNumeric:'tabular-nums'}}>
                {p.chess_elo}
              </div>
              <div style={{fontSize: 'var(--fs-snap10)', color:'var(--muted)'}}>Elo</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
