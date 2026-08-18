// Голосовые эффекты как аудио-плагины 100ms.
// Плагин получает AudioContext + узел микрофона и возвращает обработанный узел,
// который SDK публикует остальным участникам.
// Питч-шифт сделан синхронно (delay-line «Jungle» метод) — без AudioWorklet,
// чтобы работать внутри processAudioTrack (он синхронный).

export type VoiceFxType =
  | 'none' | 'dark_lord' | 'dark_knight' | 'prime_bot'
  | 'ghost' | 'the_mask' | 'closet_monster' | 'space_comms' | 'butler_ai';

export const VOICE_FX: { id: VoiceFxType; label: string; icon: string }[] = [
  { id: 'none',           label: 'Off',            icon: 'mic' },
  { id: 'dark_lord',      label: 'Dark Lord',      icon: 'moon' },
  { id: 'dark_knight',    label: 'Dark Knight',    icon: 'shield' },
  { id: 'prime_bot',      label: 'Prime Bot',      icon: 'tool' },
  { id: 'ghost',          label: 'Ghost',          icon: 'ghost' },
  { id: 'the_mask',       label: 'The Mask',       icon: 'cards' },
  { id: 'closet_monster', label: 'Closet Monster', icon: 'flame' },
  { id: 'space_comms',    label: 'Space Comms',    icon: 'globe' },
  { id: 'butler_ai',      label: 'Butler AI',      icon: 'briefcase' },
];

function makeImpulse(ctx: AudioContext, seconds = 2.2, decay = 2.6): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(rate * seconds));
  const buf = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function makeDistortionCurve(amount = 120): Float32Array {
  const n = 44100;
  const curve = new Float32Array(n);
  const deg = Math.PI / 180;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

function makeNoiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// ----- Pitch shifter (delay-line / «Jungle») -----
function createFadeBuffer(ctx: AudioContext, activeTime: number, fadeTime: number): AudioBuffer {
  const length1 = activeTime * ctx.sampleRate;
  const length2 = (activeTime - 2 * fadeTime) * ctx.sampleRate;
  const length = Math.floor(length1 + length2);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const p = buffer.getChannelData(0);
  const fadeLength = fadeTime * ctx.sampleRate;
  const fadeIndex1 = fadeLength;
  const fadeIndex2 = length1 - fadeLength;
  for (let i = 0; i < length1; ++i) {
    let v;
    if (i < fadeIndex1) v = Math.sqrt(i / fadeLength);
    else if (i >= fadeIndex2) v = Math.sqrt(1 - (i - fadeIndex2) / fadeLength);
    else v = 1;
    p[i] = v;
  }
  for (let i = Math.floor(length1); i < length; ++i) p[i] = 0;
  return buffer;
}

function createDelayTimeBuffer(ctx: AudioContext, activeTime: number, fadeTime: number, shiftUp: boolean): AudioBuffer {
  const length1 = activeTime * ctx.sampleRate;
  const length2 = (activeTime - 2 * fadeTime) * ctx.sampleRate;
  const length = Math.floor(length1 + length2);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const p = buffer.getChannelData(0);
  for (let i = 0; i < length1; ++i) {
    if (shiftUp) p[i] = (length1 - i) / length;
    else p[i] = i / length1;
  }
  for (let i = Math.floor(length1); i < length; ++i) p[i] = 0;
  return buffer;
}

// octaveOffset: -1..+1 (доли октавы). Возвращает выходной узел; стартует LFO-источники.
function createPitchNode(ctx: AudioContext, input: AudioNode, octaveOffset: number, started: any[]): AudioNode {
  const bufferTime = 0.1, fadeTime = 0.05, delayTime = 0.1;
  const output = ctx.createGain();
  const shiftDown = createDelayTimeBuffer(ctx, bufferTime, fadeTime, false);
  const shiftUp = createDelayTimeBuffer(ctx, bufferTime, fadeTime, true);
  const fadeBuffer = createFadeBuffer(ctx, bufferTime, fadeTime);

  const mod1 = ctx.createBufferSource(), mod2 = ctx.createBufferSource(), mod3 = ctx.createBufferSource(), mod4 = ctx.createBufferSource();
  mod1.buffer = shiftDown; mod2.buffer = shiftDown; mod3.buffer = shiftUp; mod4.buffer = shiftUp;
  mod1.loop = mod2.loop = mod3.loop = mod4.loop = true;

  const up = octaveOffset > 0;
  const mod1Gain = ctx.createGain(), mod2Gain = ctx.createGain(), mod3Gain = ctx.createGain(), mod4Gain = ctx.createGain();
  mod1Gain.gain.value = up ? 0 : 1; mod2Gain.gain.value = up ? 0 : 1;
  mod3Gain.gain.value = up ? 1 : 0; mod4Gain.gain.value = up ? 1 : 0;
  mod1.connect(mod1Gain); mod2.connect(mod2Gain); mod3.connect(mod3Gain); mod4.connect(mod4Gain);

  const modGain1 = ctx.createGain(), modGain2 = ctx.createGain();
  const delay1 = ctx.createDelay(), delay2 = ctx.createDelay();
  mod1Gain.connect(modGain1); mod2Gain.connect(modGain2); mod3Gain.connect(modGain1); mod4Gain.connect(modGain2);
  modGain1.connect(delay1.delayTime); modGain2.connect(delay2.delayTime);

  const fade1 = ctx.createBufferSource(), fade2 = ctx.createBufferSource();
  fade1.buffer = fadeBuffer; fade2.buffer = fadeBuffer; fade1.loop = true; fade2.loop = true;
  const mix1 = ctx.createGain(), mix2 = ctx.createGain();
  mix1.gain.value = 0; mix2.gain.value = 0;
  fade1.connect(mix1.gain); fade2.connect(mix2.gain);

  input.connect(delay1); input.connect(delay2);
  delay1.connect(mix1); delay2.connect(mix2);
  mix1.connect(output); mix2.connect(output);

  const amount = delayTime * Math.abs(octaveOffset);
  modGain1.gain.value = 0.5 * amount;
  modGain2.gain.value = 0.5 * amount;

  const t = ctx.currentTime + 0.05;
  const t2 = t + bufferTime - fadeTime;
  mod1.start(t); mod2.start(t2); mod3.start(t); mod4.start(t2); fade1.start(t); fade2.start(t2);
  started.push(mod1, mod2, mod3, mod4, fade1, fade2);
  return output;
}

function lfoOn(ctx: AudioContext, freq: number, depth: number, param: AudioParam, started: any[]) {
  const lfo = ctx.createOscillator();
  lfo.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = depth;
  lfo.connect(g);
  g.connect(param);
  lfo.start();
  started.push(lfo);
}

export function createVoiceFxPlugin(type: VoiceFxType) {
  const started: any[] = [];
  return {
    getName: () => 'sigmas-vfx-' + type,
    getPluginType: () => 'TRANSFORM' as any,
    checkSupport: () => ({ isSupported: true }),
    isSupported: () => true,
    init: () => {},
    stop: () => {
      for (const s of started) { try { s.stop?.(); } catch {} try { s.disconnect?.(); } catch {} }
      started.length = 0;
    },
    processAudioTrack: (ctx: AudioContext, source: AudioNode): AudioNode => {
      const out = ctx.createGain();
      const bq = (t: BiquadFilterType, f: number, q?: number, gain?: number) => {
        const n = ctx.createBiquadFilter(); n.type = t; n.frequency.value = f;
        if (q != null) n.Q.value = q; if (gain != null) n.gain.value = gain; return n;
      };
      const shaper = (amt: number) => { const w = ctx.createWaveShaper(); w.curve = makeDistortionCurve(amt) as unknown as Float32Array<ArrayBuffer>; w.oversample = '2x'; return w; };
      const gain = (v: number) => { const g = ctx.createGain(); g.gain.value = v; return g; };

      if (type === 'dark_lord') {
        const pitch = createPitchNode(ctx, source, -0.5, started);
        const ls = bq('lowshelf', 320, undefined, 8);
        const ws = shaper(25);
        const lp = bq('lowpass', 3100);
        pitch.connect(ls); ls.connect(ws); ws.connect(lp); lp.connect(out);
        // Дыхание респиратора: шум → полоса → медленный LFO громкости (вдох/выдох)
        const breathNoise = ctx.createBufferSource();
        breathNoise.buffer = makeNoiseBuffer(ctx, 3); breathNoise.loop = true;
        const breathBp = bq('bandpass', 800, 0.6);
        const breathGain = gain(0.05);
        lfoOn(ctx, 0.25, 0.045, breathGain.gain, started);
        breathNoise.connect(breathBp); breathBp.connect(breathGain); breathGain.connect(out);
        breathNoise.start(); started.push(breathNoise);

      } else if (type === 'dark_knight') {
        const hp = bq('highpass', 110);
        const ws = shaper(85);
        const ls = bq('lowshelf', 250, undefined, 5);
        const lp = bq('lowpass', 3600);
        const g = gain(0.9);
        source.connect(hp); hp.connect(ws); ws.connect(ls); ls.connect(lp); lp.connect(g); g.connect(out);

      } else if (type === 'prime_bot') {
        const ws = shaper(40);
        const comb = ctx.createDelay(); comb.delayTime.value = 0.012;
        const cfb = gain(0.5); comb.connect(cfb); cfb.connect(comb);
        const bp = bq('bandpass', 1400, 0.7);
        source.connect(ws); ws.connect(comb); comb.connect(bp); bp.connect(out); ws.connect(out);

      } else if (type === 'ghost') {
        const hp = bq('highpass', 300);
        const trem = gain(0.85);
        lfoOn(ctx, 6, 0.25, trem.gain, started);
        const conv = ctx.createConvolver(); conv.buffer = makeImpulse(ctx, 2.6, 2.2);
        const wet = gain(0.9), dry = gain(0.5);
        source.connect(hp); hp.connect(trem);
        trem.connect(conv); conv.connect(wet); wet.connect(out);
        trem.connect(dry); dry.connect(out);

      } else if (type === 'the_mask') {
        const lp = bq('lowpass', 1800);
        const ls = bq('lowshelf', 200, undefined, 4);
        const conv = ctx.createConvolver(); conv.buffer = makeImpulse(ctx, 1.0, 3);
        const wet = gain(0.4), dry = gain(0.9);
        source.connect(lp); lp.connect(ls);
        ls.connect(dry); dry.connect(out);
        ls.connect(conv); conv.connect(wet); wet.connect(out);

      } else if (type === 'closet_monster') {
        const ws = shaper(160);
        const lp = bq('lowpass', 900);
        const ls = bq('lowshelf', 180, undefined, 6);
        const g = gain(0.8);
        source.connect(ws); ws.connect(lp); lp.connect(ls); ls.connect(g); g.connect(out);

      } else if (type === 'space_comms') {
        const bp = bq('bandpass', 1800, 1.0);
        const ws = shaper(30);
        const noise = ctx.createBufferSource(); noise.buffer = makeNoiseBuffer(ctx, 2); noise.loop = true;
        const nbp = bq('bandpass', 2000, 1.0);
        const ng = gain(0.04);
        noise.connect(nbp); nbp.connect(ng); ng.connect(out); noise.start(); started.push(noise);
        source.connect(bp); bp.connect(ws); ws.connect(out);

      } else if (type === 'butler_ai') {
        const hp = bq('highpass', 180);
        const comb = ctx.createDelay(); comb.delayTime.value = 0.006;
        const cfb = gain(0.3); comb.connect(cfb); cfb.connect(comb);
        const peak = bq('peaking', 2500, 1, 4);
        source.connect(hp); hp.connect(comb); comb.connect(peak); peak.connect(out); hp.connect(out);

      } else {
        source.connect(out);
      }

      return out;
    },
  };
}
