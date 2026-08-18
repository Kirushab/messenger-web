// Слайдер «исчезающее сообщение» — со снапом на пресеты:
// 10с / 1м / 5м / 30м / 1ч / 6ч / 1д.
// Position на слайдере — индекс пресета (0..6). Снап автоматический.
// Кнопка "Применить" внизу. Цифра справа — текущая выбранная длительность.

import { useState } from 'react';

const PRESETS: { s: number; l: string; short: string }[] = [
  { s: 10,    l: '10 секунд',  short: '10с' },
  { s: 60,    l: '1 минуту',   short: '1м' },
  { s: 300,   l: '5 минут',    short: '5м' },
  { s: 1800,  l: '30 минут',   short: '30м' },
  { s: 3600,  l: '1 час',      short: '1ч' },
  { s: 21600, l: '6 часов',    short: '6ч' },
  { s: 86400, l: '1 день',     short: '1д' },
];

interface Props {
  onPick: (seconds: number, label: string) => void;
}

const UNITS: { k: string; label: string; mult: number }[] = [
  { k: 's', label: 'сек', mult: 1 },
  { k: 'm', label: 'мин', mult: 60 },
  { k: 'h', label: 'час', mult: 3600 },
  { k: 'd', label: 'дн',  mult: 86400 },
];

export default function EphemeralSlider({ onPick }: Props) {
  const [idx, setIdx] = useState(2); // дефолт = 5 минут
  const [custom, setCustom] = useState(false);
  const [customVal, setCustomVal] = useState('15');
  const [customUnit, setCustomUnit] = useState('m');

  const unit = UNITS.find(u => u.k === customUnit) || UNITS[1];
  const customNum = Math.max(1, Math.floor(parseFloat(customVal) || 0));
  const customSeconds = customNum * unit.mult;
  const eff = custom
    ? { s: customSeconds, l: `${customNum} ${unit.label}` }
    : PRESETS[idx];

  return (
    <div className="attach-pane" style={{
      flexDirection: 'column', alignItems: 'stretch',
      padding: '12px 16px max(10px, env(safe-area-inset-bottom, 10px))', maxWidth: 480, margin: '0 auto', width: '100%',
    }}>
      {/* Header: title + текущее значение справа */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 22,
          background: 'rgba(99,102,241,0.15)',
          color: '#6366F1',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="13" r="8"/>
            <polyline points="12 9 12 13 14.5 14.5"/>
            <line x1="9" y1="2" x2="15" y2="2"/>
            <line x1="12" y1="2" x2="12" y2="5"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 'var(--fs-label)', color: 'var(--text2)' }}>
            Следующее сообщение исчезнет через
          </div>
          <div style={{ fontSize: 'var(--fs-title)', fontWeight: 700, color: 'var(--text)', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
            {eff.l}
          </div>
        </div>
      </div>

      {/* Слайдер. step=1, max=6 → ровно 7 позиций. Браузер сам снапит к step-у. */}
      <input
        type="range"
        className="ephemeral-range"
        min={0}
        max={PRESETS.length - 1}
        step={1}
        value={idx}
        onChange={e => { setIdx(parseInt(e.target.value, 10)); setCustom(false); }}
        style={{
          width: '100%', accentColor: '#6366F1', cursor: 'pointer',
          margin: '0 0 8px', opacity: custom ? 0.4 : 1,
        }}
      />

      {/* Подписи пресетов под слайдером */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 'var(--fs-snap10)', color: 'var(--text2)', fontVariantNumeric: 'tabular-nums',
        marginBottom: 18, padding: '0 2px',
      }}>
        {PRESETS.map((p, i) => (
          <span
            key={p.s}
            onClick={() => { setIdx(i); setCustom(false); }}
            style={{
              cursor: 'pointer',
              fontWeight: i === idx && !custom ? 700 : 500,
              color: i === idx && !custom ? 'var(--text)' : 'var(--text2)',
              padding: '2px 4px',
            }}
          >{p.short}</span>
        ))}
      </div>

      {/* Своё время */}
      <button
        onClick={() => setCustom(c => !c)}
        style={{
          alignSelf: 'flex-start', background: custom ? 'var(--text)' : 'var(--surface-2)',
          color: custom ? 'var(--bg)' : 'var(--text)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '7px 14px', fontSize: 'var(--fs-label)', fontWeight: 600,
          cursor: 'pointer', marginBottom: custom ? 10 : 16,
        }}
      >Своё время</button>

      {custom && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            type="number" min={1} inputMode="numeric" value={customVal}
            onChange={e => setCustomVal(e.target.value)}
            style={{
              flex: 1, minWidth: 0, padding: '10px 12px', fontSize: 'var(--fs-body)',
              background: 'var(--surface-2)', border: '1px solid color-mix(in srgb, var(--text) 18%, transparent)',
              borderRadius: 12, color: 'var(--text)',
            }}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            {UNITS.map(u => (
              <button key={u.k} onClick={() => setCustomUnit(u.k)} style={{
                padding: '8px 10px', fontSize: 'var(--fs-label)', fontWeight: 600, cursor: 'pointer',
                borderRadius: 10, border: 'none',
                background: customUnit === u.k ? 'var(--text)' : 'var(--surface-2)',
                color: customUnit === u.k ? 'var(--bg)' : 'var(--text)',
                boxShadow: customUnit === u.k ? '0 6px 18px rgba(0,0,0,0.18)' : 'inset 0 0 0 1px var(--border)',
              }}>{u.label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Apply */}
      <button
        onClick={() => onPick(eff.s, eff.l)}
        style={{
          width: '100%', padding: '12px',
          background: 'var(--text)', color: 'var(--bg)',
          border: '1px solid var(--text)', borderRadius: 12,
          fontSize: 'var(--fs-body)', fontWeight: 700, cursor: 'pointer',
          marginTop: 2, marginBottom: 4,
          position: 'sticky', bottom: 0, zIndex: 2,
          boxShadow: '0 10px 28px rgba(0,0,0,0.28)',
        }}
      >
        Применить
      </button>
    </div>
  );
}
