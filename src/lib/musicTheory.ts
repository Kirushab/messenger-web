import { isSoundOn } from './eduPrefs';
// Музыкальная теория для тренажёра "Ноты"

export type NoteName = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export type ClefType = 'treble' | 'bass';
export type Accidental = 'sharp' | 'flat'; // диез или бемоль

export interface MusicNote {
  name: NoteName;
  octave: number;
  clef: ClefType;
  staffPosition: number;
  accidental?: Accidental;
}

// Русские названия
export const NOTE_RU: Record<NoteName, string> = {
  C: 'До', D: 'Ре', E: 'Ми', F: 'Фа', G: 'Соль', A: 'Ля', B: 'Си',
};

export const NOTE_NAMES: NoteName[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

// Энгармонические пары (для уровня advanced)
// Чёрные клавиши = 5 пар. Канонический ID = "C#" / "D#" / "F#" / "G#" / "A#"
export interface AccidentalPair {
  canonical: string;   // "C#" — для проверки ответа
  sharpName: NoteName; // C (нота с диезом)
  flatName: NoteName;  // D (та же нота с бемолем)
  labelRu: string;     // "До#/Ре♭"
  labelEn: string;     // "C#/Db"
}

export const ACCIDENTAL_PAIRS: AccidentalPair[] = [
  { canonical: 'C#', sharpName: 'C', flatName: 'D', labelRu: 'До#/Ре♭', labelEn: 'C#/D♭' },
  { canonical: 'D#', sharpName: 'D', flatName: 'E', labelRu: 'Ре#/Ми♭', labelEn: 'D#/E♭' },
  { canonical: 'F#', sharpName: 'F', flatName: 'G', labelRu: 'Фа#/Соль♭', labelEn: 'F#/G♭' },
  { canonical: 'G#', sharpName: 'G', flatName: 'A', labelRu: 'Соль#/Ля♭', labelEn: 'G#/A♭' },
  { canonical: 'A#', sharpName: 'A', flatName: 'B', labelRu: 'Ля#/Си♭', labelEn: 'A#/B♭' },
];

// Конвертация ноты в canonical для сравнения ответов
export function noteCanonical(note: MusicNote): string {
  if (!note.accidental) return note.name;
  if (note.accidental === 'sharp') {
    // C# stays C#, D# stays D#, F# stays F#, G# stays G#, A# stays A#
    return `${note.name}#`;
  }
  // Бемоли — конвертируем в эквивалентный диез
  // Db → C#, Eb → D#, Gb → F#, Ab → G#, Bb → A#
  const flatToSharp: Record<NoteName, string> = {
    C: 'B', D: 'C#', E: 'D#', F: 'E', G: 'F#', A: 'G#', B: 'A#',
  };
  return flatToSharp[note.name] || note.name;
}

// Скрипичный ключ (treble): 9 нот в пределах стана + 1 средняя До
// Позиция: 0 = нижняя линия (E4), 8 = верхняя линия (F5)
export const TREBLE_NOTES: MusicNote[] = [
  { name: 'E', octave: 4, clef: 'treble', staffPosition: 0 },  // линия 1
  { name: 'F', octave: 4, clef: 'treble', staffPosition: 1 },  // между 1-2
  { name: 'G', octave: 4, clef: 'treble', staffPosition: 2 },  // линия 2
  { name: 'A', octave: 4, clef: 'treble', staffPosition: 3 },  // между 2-3
  { name: 'B', octave: 4, clef: 'treble', staffPosition: 4 },  // линия 3 (средняя)
  { name: 'C', octave: 5, clef: 'treble', staffPosition: 5 },  // между 3-4
  { name: 'D', octave: 5, clef: 'treble', staffPosition: 6 },  // линия 4
  { name: 'E', octave: 5, clef: 'treble', staffPosition: 7 },  // между 4-5
  { name: 'F', octave: 5, clef: 'treble', staffPosition: 8 },  // линия 5 (верхняя)
];

// Басовый ключ (bass): 9 нот в пределах стана
// Позиция: 0 = нижняя линия (G2), 8 = верхняя линия (A3)
export const BASS_NOTES: MusicNote[] = [
  { name: 'G', octave: 2, clef: 'bass', staffPosition: 0 },
  { name: 'A', octave: 2, clef: 'bass', staffPosition: 1 },
  { name: 'B', octave: 2, clef: 'bass', staffPosition: 2 },
  { name: 'C', octave: 3, clef: 'bass', staffPosition: 3 },
  { name: 'D', octave: 3, clef: 'bass', staffPosition: 4 },
  { name: 'E', octave: 3, clef: 'bass', staffPosition: 5 },
  { name: 'F', octave: 3, clef: 'bass', staffPosition: 6 },
  { name: 'G', octave: 3, clef: 'bass', staffPosition: 7 },
  { name: 'A', octave: 3, clef: 'bass', staffPosition: 8 },
];

// Случайная нота для уровня
export function pickRandomNote(level: 'treble' | 'bass' | 'both' | 'advanced'): MusicNote {
  let pool: MusicNote[];
  if (level === 'treble') pool = TREBLE_NOTES;
  else if (level === 'bass') pool = BASS_NOTES;
  else pool = [...TREBLE_NOTES, ...BASS_NOTES];

  const base = pool[Math.floor(Math.random() * pool.length)];

  // Для advanced — 40% шанс добавить альтерацию
  if (level === 'advanced' && Math.random() < 0.4) {
    // Валидные альтерации (избегаем E#, B#, Cb, Fb — редкие)
    const canSharp = !['E', 'B'].includes(base.name); // нет E# и B#
    const canFlat = !['C', 'F'].includes(base.name);  // нет Cb и Fb
    const choices: Accidental[] = [];
    if (canSharp) choices.push('sharp');
    if (canFlat) choices.push('flat');
    if (choices.length > 0) {
      const acc = choices[Math.floor(Math.random() * choices.length)];
      return { ...base, accidental: acc };
    }
  }
  return base;
}

// Частота ноты (Hz) с учётом альтерации
export function noteFrequencyWithAccidental(note: MusicNote): number {
  let semitones = SEMITONE_OFFSETS[note.name];
  if (note.accidental === 'sharp') semitones += 1;
  else if (note.accidental === 'flat') semitones -= 1;
  const midi = (note.octave + 1) * 12 + semitones;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Частота ноты (Hz) для Web Audio
// A4 = 440Hz, остальные через формулу freq = 440 * 2^((n - 69) / 12)
const SEMITONE_OFFSETS: Record<NoteName, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

export function noteFrequency(name: NoteName, octave: number): number {
  // MIDI number: C4 = 60, A4 = 69
  const midi = (octave + 1) * 12 + SEMITONE_OFFSETS[name];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Web Audio плеер
let audioCtx: AudioContext | null = null;
function getCtx(): AudioContext {
  if (!audioCtx) {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    audioCtx = new Ctx();
  }
  return audioCtx!;
}

export function playNote(name: NoteName, octave: number, duration = 0.7): void {
  playFreq(noteFrequency(name, octave), duration);
}

// Воспроизведение ноты с диезом или бемолем (для чёрных клавиш пианино)
export function playNoteWithAccidental(name: NoteName, octave: number, accidental?: Accidental, duration = 0.7): void {
  let semitones = SEMITONE_OFFSETS[name];
  if (accidental === 'sharp') semitones += 1;
  else if (accidental === 'flat') semitones -= 1;
  const midi = (octave + 1) * 12 + semitones;
  const freq = 440 * Math.pow(2, (midi - 69) / 12);
  playFreq(freq, duration);
}

export function playMusicNote(note: MusicNote, duration = 0.7): void {
  if (!isSoundOn()) return;
  playFreq(noteFrequencyWithAccidental(note), duration);
}

function playFreq(freq: number, duration: number): void {
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.start(now);
    osc.stop(now + duration);
  } catch (e) {
    console.warn('Audio failed:', e);
  }
}

// Короткий positive звук (для правильного ответа)
export function playCorrect(): void {
  if (!isSoundOn()) return;
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = ctx.currentTime + i * 0.08;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
      osc.start(start);
      osc.stop(start + 0.25);
    });
  } catch {}
}

// Короткий negative звук
export function playWrong(): void {
  if (!isSoundOn()) return;
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 180;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } catch {}
}
