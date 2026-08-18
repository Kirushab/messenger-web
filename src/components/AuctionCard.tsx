import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useAuctionStore, type Auction } from '@/stores/auctionStore';
import { avatarColor } from '@/lib/utils';

interface Props {
  auction: Auction;
}

function fmtTimeLeft(ms: number): string {
  if (ms <= 0) return 'Завершён';
  const sec = Math.floor(ms / 1000);
  const days = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (days > 0) return `${days}д ${h}ч`;
  if (h > 0) return `${h}ч ${m}м`;
  if (m > 0) return `${m}м ${s}с`;
  return `${s}с`;
}

export default function AuctionCard({ auction }: Props) {
  const { session } = useAuthStore();
  const myId = session?.user?.id;
  const { myBids, allBids, placeBid, cancelAuction, loadAllBids } = useAuctionStore();

  const [now, setNow] = useState(Date.now());
  const [showBidModal, setShowBidModal] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [submittingBid, setSubmittingBid] = useState(false);
  const [bidError, setBidError] = useState<string | null>(null);

  // Тикер для live timer
  useEffect(() => {
    if (auction.status !== 'active') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [auction.status]);

  // Грузим все ставки если аукцион завершён
  useEffect(() => {
    if (auction.status === 'ended' || auction.status === 'cancelled') {
      if (!allBids[auction.id]) loadAllBids(auction.id);
    }
  }, [auction.status, auction.id]);

  const isCreator = myId === auction.creator_id;
  const myBid = myBids[auction.id];
  const endsAtMs = new Date(auction.ends_at).getTime();
  const timeLeft = Math.max(0, endsAtMs - now);
  const isActive = auction.status === 'active' && timeLeft > 0;

  const handleSubmitBid = async () => {
    const amount = parseInt(bidAmount.replace(/\s/g, ''), 10);
    if (isNaN(amount) || amount <= 0) {
      setBidError('Введите положительную сумму');
      return;
    }
    if (amount < auction.min_bid) {
      setBidError(`Минимальная ставка: ${auction.min_bid}`);
      return;
    }
    if (myBid && amount <= myBid.amount) {
      setBidError(`Должно быть больше текущей ${myBid.amount}`);
      return;
    }
    setSubmittingBid(true);
    setBidError(null);
    const { ok, error } = await placeBid(auction.id, amount);
    setSubmittingBid(false);
    if (ok) {
      setShowBidModal(false);
      setBidAmount('');
    } else {
      setBidError(error);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Отменить аукцион? Все ставки будут возвращены участникам.')) return;
    await cancelAuction(auction.id);
  };

  const cardBg = auction.status === 'cancelled'
    ? 'linear-gradient(135deg, #6B7280, #4B5563)'
    : auction.status === 'ended'
    ? 'linear-gradient(135deg, #FBBF24, #D97706)'
    : 'linear-gradient(135deg, #3B82F6, #1E40AF)';

  return (
    <div style={{
      width: 340,
      maxWidth: '78vw',
      minHeight: 260,
      boxSizing: 'border-box',
      margin: '4px 0',
      background: cardBg,
      borderRadius: 16,
      padding: 14,
      color: '#fff',
      boxShadow: 'var(--shadow-card)',
    }}>
      <div style={{display:'flex', alignItems:'center', gap:6, fontSize: 'var(--fs-micro)', opacity:0.85, marginBottom:6, letterSpacing:0.4, textTransform:'uppercase', fontWeight:600}}>
        <span>🎯</span>
        <span>
          {auction.status === 'active' && 'Аукцион'}
          {auction.status === 'ended' && 'Аукцион завершён'}
          {auction.status === 'cancelled' && 'Аукцион отменён'}
        </span>
      </div>

      <div style={{fontSize: 'var(--fs-snap16)', fontWeight:600, marginBottom:6, lineHeight:1.3}}>
        {auction.title}
      </div>

      {auction.description && (
        <div style={{fontSize: 'var(--fs-label)', opacity:0.85, marginBottom:10, lineHeight:1.35}}>
          {auction.description}
        </div>
      )}

      {auction.creator && (
        <div style={{fontSize: 'var(--fs-micro)', opacity:0.7, marginBottom:10}}>
          От: {auction.creator.display_name}
        </div>
      )}

      {isActive && (
        <>
          <div style={{
            display:'flex', justifyContent:'space-between', gap:12,
            padding:'8px 12px',
            background:'rgba(0,0,0,0.25)',
            borderRadius:10,
            marginBottom:10,
            fontSize: 'var(--fs-label)',
          }}>
            <div>
              <div style={{opacity:0.7, fontSize: 'var(--fs-snap10)', textTransform:'uppercase', letterSpacing:0.4}}>Осталось</div>
              <div style={{fontWeight:600, fontVariantNumeric:'tabular-nums'}}>{fmtTimeLeft(timeLeft)}</div>
            </div>
            <div>
              <div style={{opacity:0.7, fontSize: 'var(--fs-snap10)', textTransform:'uppercase', letterSpacing:0.4}}>Минимум</div>
              <div style={{fontWeight:600, fontVariantNumeric:'tabular-nums'}}>{auction.min_bid}</div>
            </div>
          </div>

          {myBid && (
            <div style={{
              padding:'8px 12px',
              background:'rgba(255,255,255,0.18)',
              borderRadius:10,
              marginBottom:10,
              fontSize: 'var(--fs-caption)',
              fontWeight:500,
            }}>
              Ваша ставка: <b style={{fontSize: 'var(--fs-snap14)', fontVariantNumeric:'tabular-nums'}}>{myBid.amount.toLocaleString('ru')}</b>
            </div>
          )}

          <button
            onClick={() => { setBidAmount(myBid ? String(myBid.amount + 50) : String(auction.min_bid)); setShowBidModal(true); }}
            style={{
              width:'100%', padding:'10px',
              background:'#fff', color:'#1E40AF',
              border:'none', borderRadius:10,
              fontSize: 'var(--fs-snap14)', fontWeight:600, cursor:'pointer',
              marginBottom: isCreator ? 6 : 0,
            }}
          >{myBid ? 'Поднять ставку' : 'Сделать ставку'}</button>

          {isCreator && (
            <button
              onClick={handleCancel}
              style={{
                width:'100%', padding:'8px',
                background:'rgba(0,0,0,0.25)', color:'#fff',
                border:'1px solid rgba(255,255,255,0.2)', borderRadius:10,
                fontSize: 'var(--fs-caption)', cursor:'pointer',
              }}
            >Отменить аукцион</button>
          )}
        </>
      )}

      {auction.status === 'ended' && (
        <ResultsSection auction={auction} myId={myId} />
      )}

      {auction.status === 'cancelled' && (
        <div style={{
          padding:'10px 12px',
          background:'rgba(0,0,0,0.25)',
          borderRadius:10,
          fontSize: 'var(--fs-label)',
          textAlign:'center',
          opacity:0.85,
        }}>
          Аукцион отменён, ставки возвращены
        </div>
      )}

      {showBidModal && (
        <BidModal
          auction={auction}
          currentBid={myBid?.amount}
          bidAmount={bidAmount}
          setBidAmount={setBidAmount}
          submitting={submittingBid}
          error={bidError}
          onSubmit={handleSubmitBid}
          onClose={() => { setShowBidModal(false); setBidError(null); }}
        />
      )}
    </div>
  );
}

function ResultsSection({ auction, myId }: { auction: Auction; myId?: string }) {
  const { allBids } = useAuctionStore();
  const bids = allBids[auction.id] || [];
  const winner = auction.winner;

  if (!winner) {
    return (
      <div style={{
        padding:'10px 12px',
        background:'rgba(0,0,0,0.25)',
        borderRadius:10,
        fontSize: 'var(--fs-label)',
        textAlign:'center',
        opacity:0.85,
      }}>
        Никто не сделал ставок
      </div>
    );
  }

  const isMeWinner = myId === winner.id;

  return (
    <>
      <div style={{
        padding:'10px 12px',
        background:'rgba(0,0,0,0.3)',
        borderRadius:10,
        marginBottom:10,
      }}>
        <div style={{fontSize: 'var(--fs-micro)', opacity:0.7, marginBottom:4, textTransform:'uppercase', letterSpacing:0.4}}>
          {isMeWinner ? '👑 Вы выиграли' : 'Победитель'}
        </div>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          {winner.avatar_url
            ? <img src={winner.avatar_url} alt="" style={{width:28,height:28,borderRadius:14,objectFit:'cover'}} />
            : <div style={{width:28,height:28,borderRadius:14,background:avatarColor(winner.id),display:'flex',alignItems:'center',justifyContent:'center',fontSize: 'var(--fs-caption)',fontWeight:600}}>{winner.display_name?.[0]?.toUpperCase()}</div>}
          <div style={{flex:1}}>
            <div style={{fontSize: 'var(--fs-snap14)', fontWeight:600}}>{winner.display_name}</div>
            <div style={{fontSize: 'var(--fs-micro)', opacity:0.7, fontVariantNumeric:'tabular-nums'}}>
              ставка: {auction.winning_amount?.toLocaleString('ru')} (сожжено)
            </div>
          </div>
        </div>
      </div>

      {bids.length > 0 && (
        <details style={{cursor:'pointer'}}>
          <summary style={{fontSize: 'var(--fs-caption)', opacity:0.85, padding:'4px 0'}}>
            Все ставки ({bids.length})
          </summary>
          <div style={{marginTop:8, display:'flex', flexDirection:'column', gap:4}}>
            {bids.map((b, i) => (
              <div key={b.id} style={{
                display:'flex', alignItems:'center', gap:8,
                padding:'6px 8px',
                background: i === 0 ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.15)',
                borderRadius:8,
                fontSize: 'var(--fs-caption)',
              }}>
                <span style={{opacity:0.6, width:14, textAlign:'right', fontVariantNumeric:'tabular-nums'}}>{i + 1}.</span>
                <span style={{flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{b.user?.display_name || 'Юзер'}</span>
                <span style={{fontWeight:600, fontVariantNumeric:'tabular-nums'}}>{b.amount.toLocaleString('ru')}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </>
  );
}

function BidModal({
  auction, currentBid, bidAmount, setBidAmount, submitting, error, onSubmit, onClose,
}: {
  auction: Auction;
  currentBid?: number;
  bidAmount: string;
  setBidAmount: (s: string) => void;
  submitting: boolean;
  error: string | null;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const minNew = Math.max(auction.min_bid, (currentBid || 0) + 1);

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, zIndex:70,
      background:'rgba(0,0,0,0.7)',
      display:'flex', alignItems:'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width:'100%',
        background:'var(--surface)',
        borderRadius:'16px 16px 0 0',
        padding:'12px 16px max(20px, env(safe-area-inset-bottom, 20px))',
        color:'var(--text)',
      }}>
        <div style={{display:'flex',justifyContent:'center',marginBottom:12}}>
          <div style={{width:36, height:4, borderRadius:2, background:'var(--border)'}} />
        </div>

        <h3 style={{fontSize: 'var(--fs-snap16)', fontWeight:600, margin:'0 0 4px'}}>{auction.title}</h3>
        <p style={{fontSize: 'var(--fs-caption)', color:'var(--muted)', margin:'0 0 16px'}}>
          {currentBid ? `Текущая ваша ставка: ${currentBid}. ` : `Минимум: ${auction.min_bid}. `}
          Ставка скрыта до конца аукциона.
        </p>

        <input
          type="text"
          inputMode="numeric"
          autoFocus
          value={bidAmount}
          onChange={e => setBidAmount(e.target.value.replace(/[^\d]/g, ''))}
          placeholder={String(minNew)}
          style={{width:'100%',padding:'14px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-heading)',fontVariantNumeric:'tabular-nums',marginBottom:8,textAlign:'center',fontWeight:600}}
        />

        <div style={{display:'flex', gap:6, marginBottom:12, flexWrap:'wrap'}}>
          {[minNew, minNew + 50, minNew + 100, minNew + 500].map(v => (
            <button key={v} onClick={() => setBidAmount(String(v))} style={{
              padding:'5px 10px', fontSize: 'var(--fs-caption)',
              background:'var(--surface-light)', border:'1px solid var(--border)',
              borderRadius:14, color:'var(--text)', cursor:'pointer',
              fontVariantNumeric:'tabular-nums',
            }}>{v.toLocaleString('ru')}</button>
          ))}
        </div>

        {error && (
          <div style={{
            background:'rgba(239,68,68,0.1)', color:'#EF4444',
            padding:'10px 12px', borderRadius:8, fontSize: 'var(--fs-label)', marginBottom:12,
          }}>{error}</div>
        )}

        <div style={{display:'flex', gap:8}}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              flex:1, padding:'12px',
              background:'var(--surface-light)', border:'1px solid var(--border)',
              borderRadius:10, color:'var(--text)',
              fontSize: 'var(--fs-snap14)', fontWeight:500, cursor:'pointer',
            }}
          >Отмена</button>
          <button
            onClick={onSubmit}
            disabled={submitting}
            style={{
              flex:2, padding:'12px',
              background:'var(--primary)', color:'var(--bg)',
              border:'none', borderRadius:10,
              fontSize: 'var(--fs-snap14)', fontWeight:600,
              cursor: submitting ? 'default' : 'pointer',
            }}
          >{submitting ? 'Ставлю...' : 'Поставить'}</button>
        </div>
      </div>
    </div>
  );
}
