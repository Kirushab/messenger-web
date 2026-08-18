// Звуки для покера через Web Audio API.
// Без mp3 файлов — все звуки генерируются осцилляторами.
// Mute состояние хранится в localStorage.

const STORAGE_KEY = 'poker_sound_muted';

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  // iOS Safari требует пользовательского жеста — после первого клика resume сработает
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

export function isPokerSoundMuted(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) === '1';
}

export function setPokerSoundMuted(muted: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
}

export function togglePokerSoundMuted(): boolean {
  const next = !isPokerSoundMuted();
  setPokerSoundMuted(next);
  return next;
}

// === Утилита: ноты + envelope ===
function play(freq: number, duration: number, type: OscillatorType = 'sine', vol = 0.15): void {
  if (isPokerSoundMuted()) return;
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, c.currentTime);
  gain.gain.linearRampToValueAtTime(vol, c.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
  osc.connect(gain).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + duration + 0.05);
}

function playNoise(duration: number, freq = 1000, vol = 0.08): void {
  if (isPokerSoundMuted()) return;
  const c = getCtx();
  if (!c) return;
  const bufSize = Math.floor(c.sampleRate * duration);
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);

  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = 0.7;
  const gain = c.createGain();
  gain.gain.value = vol;
  src.connect(filter).connect(gain).connect(c.destination);
  src.start();
}

// === Игровые события ===

// Раздача карты — короткий whoosh
export function soundDealCard(): void {
  playNoise(0.08, 2000, 0.05);
}

// Fold — глухой drop
export function soundFold(): void {
  play(150, 0.1, 'sine', 0.1);
}

// Check — мягкий tap
export function soundCheck(): void {
  play(400, 0.06, 'square', 0.06);
}

// Call — chip click
export function soundCall(): void {
  playNoise(0.04, 3000, 0.06);
  setTimeout(() => playNoise(0.04, 3500, 0.05), 30);
}

// Raise / bet / all-in — несколько фишек подряд
export function soundRaise(): void {
  for (let i = 0; i < 3; i++) {
    setTimeout(() => playNoise(0.04, 3000 + i * 200, 0.06), i * 40);
  }
}

// Выигрыш — мажорный аккорд
export function soundWin(): void {
  play(523.25, 0.4, 'triangle', 0.12);              // C5
  setTimeout(() => play(659.25, 0.35, 'triangle', 0.12), 80);  // E5
  setTimeout(() => play(783.99, 0.45, 'triangle', 0.13), 160); // G5
}

// Бит таймера — короткий тик
export function soundTimerTick(): void {
  play(800, 0.05, 'square', 0.07);
}

// Повышение блайндов — короткий звон
export function soundBlindUp(): void {
  play(880, 0.15, 'triangle', 0.1);
  setTimeout(() => play(1108.73, 0.2, 'triangle', 0.1), 80);
}

// Удобный диспатчер по типу действия
export function soundForAction(action: string): void {
  switch (action) {
    case 'fold': return soundFold();
    case 'check': return soundCheck();
    case 'call': return soundCall();
    case 'bet':
    case 'raise':
    case 'all_in': return soundRaise();
  }
}
