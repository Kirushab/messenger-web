import { useState } from 'react';
import { playNote, playNoteWithAccidental, NOTE_RU, type NoteName } from '@/lib/musicTheory';

interface Props {
  octave?: number;
  showLabels?: boolean;
  notation?: 'ru' | 'en' | 'both';
}

// Белые клавиши: C D E F G A B
const WHITE_KEYS: NoteName[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

// Чёрные клавиши: между какими белыми и их sharp-имя
// В октаве: C# (между C и D), D# (между D и E), F# (между F и G), G# (между G и A), A# (между A и B)
const BLACK_KEYS: { afterIdx: number; sharpName: NoteName }[] = [
  { afterIdx: 0, sharpName: 'C' }, // C#
  { afterIdx: 1, sharpName: 'D' }, // D#
  // нет между E-F
  { afterIdx: 3, sharpName: 'F' }, // F#
  { afterIdx: 4, sharpName: 'G' }, // G#
  { afterIdx: 5, sharpName: 'A' }, // A#
  // нет между B-следующая C
];

const WHITE_W = 40;
const WHITE_H = 140;
const BLACK_W = 26;
const BLACK_H = 88;

export default function VirtualPiano({ octave = 4, showLabels = true, notation = 'ru' }: Props) {
  const [pressed, setPressed] = useState<string | null>(null);

  const pressWhite = (name: NoteName, oct: number) => {
    const key = `${name}${oct}`;
    setPressed(key);
    playNote(name, oct, 0.6);
    setTimeout(() => setPressed(p => p === key ? null : p), 180);
  };

  const pressBlack = (sharpName: NoteName, oct: number) => {
    const key = `${sharpName}#${oct}`;
    setPressed(key);
    playNoteWithAccidental(sharpName, oct, 'sharp', 0.6);
    setTimeout(() => setPressed(p => p === key ? null : p), 180);
  };

  const octaves = [octave, octave + 1];
  // Длина в "слотах": 7 белых на октаву
  const octWidth = WHITE_W * 7;
  const totalWidth = octWidth * octaves.length;

  return (
    <div style={{
      background: 'var(--surface-light)',
      borderRadius: 10,
      padding: 8,
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch' as any,
    }}>
      <div style={{
        position: 'relative',
        width: totalWidth,
        height: WHITE_H,
      }}>
        {/* Слой белых клавиш */}
        {octaves.map((oct, octIdx) => (
          WHITE_KEYS.map((name, i) => {
            const key = `${name}${oct}`;
            const isPressed = pressed === key;
            const x = octIdx * octWidth + i * WHITE_W;
            return (
              <button
                key={key}
                onMouseDown={() => pressWhite(name, oct)}
                onTouchStart={(e) => { e.preventDefault(); pressWhite(name, oct); }}
                style={{
                  position: 'absolute',
                  left: x,
                  top: 0,
                  width: WHITE_W,
                  height: WHITE_H,
                  background: isPressed ? '#dcdcdc' : '#fff',
                  border: '1px solid #555',
                  borderRadius: '0 0 6px 6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  paddingBottom: 8,
                  fontSize: 'var(--fs-micro)',
                  color: '#333',
                  fontWeight: 600,
                  zIndex: 1,
                  transition: 'background 0.05s',
                }}
              >
                {showLabels && (
                  <span>
                    {notation === 'ru' ? NOTE_RU[name] : notation === 'en' ? name : `${NOTE_RU[name]}·${name}`}
                    <sub>{oct}</sub>
                  </span>
                )}
              </button>
            );
          })
        ))}

        {/* Слой чёрных клавиш — отображается ПОВЕРХ белых */}
        {octaves.map((oct, octIdx) => (
          BLACK_KEYS.map(({ afterIdx, sharpName }) => {
            const key = `${sharpName}#${oct}`;
            const isPressed = pressed === key;
            // Центр чёрной = граница между afterIdx и afterIdx+1 белыми
            const xCenter = octIdx * octWidth + (afterIdx + 1) * WHITE_W;
            const x = xCenter - BLACK_W / 2;
            return (
              <button
                key={key}
                onMouseDown={(e) => { e.stopPropagation(); pressBlack(sharpName, oct); }}
                onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); pressBlack(sharpName, oct); }}
                style={{
                  position: 'absolute',
                  left: x,
                  top: 0,
                  width: BLACK_W,
                  height: BLACK_H,
                  background: isPressed ? '#333' : '#0a0a0a',
                  border: '1px solid #000',
                  borderRadius: '0 0 4px 4px',
                  cursor: 'pointer',
                  zIndex: 2,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  paddingBottom: 4,
                  fontSize: 8,
                  color: '#fff',
                  fontWeight: 600,
                  opacity: isPressed ? 0.85 : 1,
                  transition: 'background 0.05s',
                }}
              >
                {showLabels && notation === 'en' && (
                  <span style={{ fontSize: 7, opacity: 0.7 }}>
                    {sharpName}♯
                  </span>
                )}
              </button>
            );
          })
        ))}
      </div>
    </div>
  );
}
