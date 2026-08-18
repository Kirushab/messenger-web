import { useState } from 'react';
import { useAuctionStore } from '@/stores/auctionStore';
import FormSheet from '@/components/FormSheet';

interface Props {
  conversationId: string;
  creatorId: string;
  onClose: () => void;
  onCreated?: () => void;
}

const DURATIONS = [
  { label: '1 час',     ms: 60 * 60 * 1000 },
  { label: '6 часов',   ms: 6 * 60 * 60 * 1000 },
  { label: '24 часа',   ms: 24 * 60 * 60 * 1000 },
  { label: '3 дня',     ms: 3 * 24 * 60 * 60 * 1000 },
  { label: 'Неделя',    ms: 7 * 24 * 60 * 60 * 1000 },
];

const TITLE_SUGGESTIONS = [
  'Переднее сидение',
  'Кто DJ',
  'Кто решает фильм',
  'Лучшая комната',
  'Кто выбирает место',
  'Король вечера',
  'Один честный вопрос',
];

export default function AuctionCreator({ conversationId, creatorId, onClose, onCreated }: Props) {
  const { createAuction } = useAuctionStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [minBid, setMinBid] = useState('50');
  const [durationIdx, setDurationIdx] = useState(2);  // 24 часа дефолт
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numericMinBid = parseInt(minBid.replace(/\s/g, ''), 10) || 0;
  const isValid = title.trim().length > 0 && numericMinBid >= 0;

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    setError(null);

    const { id, error } = await createAuction({
      conversationId,
      creatorId,
      title,
      description: description || undefined,
      minBid: numericMinBid,
      durationMs: DURATIONS[durationIdx].ms,
    });

    setSubmitting(false);
    if (error) {
      setError(error);
      return;
    }
    if (id) {
      onCreated?.();
      onClose();
    }
  };

  return (
    <FormSheet onClose={onClose}>
        <h3 style={{fontSize: 'var(--fs-heading)', fontWeight:600, margin:'0 0 4px', color:'var(--text)', display:'flex', alignItems:'center', gap:6}}>
          <span>🎯</span> Аукцион привилегий
        </h3>
        <p style={{fontSize: 'var(--fs-caption)', color:'var(--muted)', margin:'0 0 16px', lineHeight:1.4}}>
          Все ставки <b>скрыты</b> до конца. У победителя токены сжигаются, остальным возвращаются.
        </p>

        <Label>Что разыгрываете</Label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Например: Переднее сидение в машине"
          maxLength={100}
          style={{width:'100%',padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-snap14)',marginBottom:8}}
        />
        <div style={{display:'flex', gap:6, flexWrap:'wrap', marginBottom:16}}>
          {TITLE_SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => setTitle(s)}
              style={{
                padding:'4px 10px', fontSize: 'var(--fs-micro)',
                background:'var(--surface-light)', border:'1px solid var(--border)',
                borderRadius:12, color:'var(--text)', cursor:'pointer',
              }}
            >{s}</button>
          ))}
        </div>

        <Label optional>Описание</Label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Уточнения, правила, ограничения"
          maxLength={300}
          rows={2}
          style={{width:'100%',padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-snap14)',marginBottom:16,resize:'vertical',fontFamily:'inherit'}}
        />

        <Label>Длительность</Label>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:6,marginBottom:16}}>
          {DURATIONS.map((d, i) => (
            <button
              key={i}
              onClick={() => setDurationIdx(i)}
              style={{
                padding:'10px 4px',
                borderRadius:10,
                border: durationIdx === i ? '2px solid var(--primary)' : '1px solid var(--border)',
                background: durationIdx === i ? 'var(--surface-light)' : 'transparent',
                cursor:'pointer',
                color:'var(--text)',
                fontSize: 'var(--fs-caption)',
                fontWeight: durationIdx === i ? 600 : 500,
              }}
            >{d.label}</button>
          ))}
        </div>

        <Label>Минимальная ставка</Label>
        <input
          type="text"
          inputMode="numeric"
          value={minBid}
          onChange={e => setMinBid(e.target.value.replace(/[^\d]/g, ''))}
          style={{width:'100%',padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-snap14)',marginBottom:16,fontVariantNumeric:'tabular-nums'}}
        />

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
              background:'var(--surface-light)',
              border:'1px solid var(--border)',
              borderRadius:10, color:'var(--text)',
              fontSize: 'var(--fs-snap14)', fontWeight:500, cursor:'pointer',
            }}
          >Отмена</button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            style={{
              flex:2, padding:'12px',
              background: isValid ? 'var(--primary)' : 'var(--surface-light)',
              color: isValid ? 'var(--bg)' : 'var(--muted)',
              border:'none', borderRadius:10,
              fontSize: 'var(--fs-snap14)', fontWeight:600,
              cursor: isValid && !submitting ? 'pointer' : 'default',
            }}
          >{submitting ? 'Создаём...' : 'Запустить аукцион'}</button>
        </div>
    </FormSheet>
  );
}

function Label({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <div style={{
      fontSize: 'var(--fs-micro)', fontWeight:600, color:'var(--muted)',
      marginBottom:6, letterSpacing:0.3, textTransform:'uppercase',
    }}>
      {children}
      {optional && <span style={{textTransform:'none', fontWeight:500, marginLeft:6, opacity:0.7}}>(опц.)</span>}
    </div>
  );
}
