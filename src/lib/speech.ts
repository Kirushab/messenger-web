import { isSoundOn, getSpeechRate, getVoiceURI } from './eduPrefs';

// Озвучка обучения через системный Web Speech API.
// Качество зависит от голосов, установленных на устройстве, поэтому модуль:
// 1) выбирает Enhanced/Premium/Neural-голос, когда он доступен;
// 2) ждёт загрузки списка голосов в Safari;
// 3) делит длинный текст на естественные фразы;
// 4) добавляет короткую паузу после cancel(), чтобы iOS не «съедала» начало.

let cachedVoices: SpeechSynthesisVoice[] = [];
let speakGeneration = 0;
let pendingStartTimer: number | null = null;

function refreshVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) cachedVoices = voices;
  return cachedVoices;
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  refreshVoices();
  try {
    window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
  } catch {
    window.speechSynthesis.onvoiceschanged = refreshVoices;
  }
}

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && !!window.speechSynthesis;
}

export type SpeechLang = 'en' | 'it' | 'es' | 'de' | 'fr';
export type SpeechIntent = 'word' | 'phrase' | 'example' | 'reading' | 'slow';

const BCP: Record<SpeechLang, string> = {
  en: 'en-US',
  it: 'it-IT',
  es: 'es-ES',
  de: 'de-DE',
  fr: 'fr-FR',
};

function bcpFor(language: SpeechLang): string {
  return BCP[language];
}

function normalizedVoiceName(voice: SpeechSynthesisVoice): string {
  return `${voice.name} ${voice.voiceURI}`.toLowerCase();
}

const NATURAL_ENGINE_RE = /premium|enhanced|neural|natural|wavenet|studio|online|siri|high quality|hq/i;
const ROBOTIC_ENGINE_RE = /compact|espeak|festival|eloquence|default|novelty|whisper|bad news|bubbles|bells|boing|cellos|zarvox|trinoids|organ|superstar/i;

const PREFERRED_NAMES: Record<SpeechLang, RegExp> = {
  en: /karen|ava|samantha|zoe|serena|daniel|moira|tessa|aaron|nicky|allison|victoria|alex/i,
  it: /alice|federica|luca|paola|elsa|diego/i,
  es: /m[oó]nica|paulina|jorge|marisol|ximena|luciana|helena|diego/i,
  de: /anna|markus|petra|yannick|katja|conrad|vicki/i,
  fr: /am[eé]lie|audrey|thomas|marie|aur[eé]lie|hortense|daniel/i,
};

function isKarenVoice(voice: SpeechSynthesisVoice): boolean {
  return /(^|[^a-z])karen([^a-z]|$)/i.test(`${voice.name} ${voice.voiceURI}`);
}

function voiceScore(voice: SpeechSynthesisVoice, language: SpeechLang): number {
  const bcp = bcpFor(language).toLowerCase();
  const lang = String(voice.lang || '').toLowerCase();
  const name = normalizedVoiceName(voice);
  let score = 0;

  if (lang === bcp) score += 70;
  else if (lang.startsWith(`${language}-`)) score += 48;
  else if (lang.startsWith(language)) score += 38;

  if (NATURAL_ENGINE_RE.test(name)) score += 55;
  if (PREFERRED_NAMES[language].test(name)) score += 28;
  if (language === 'en' && isKarenVoice(voice)) score += 85;

  // Локальный голос запускается быстрее и надёжнее офлайн, но не должен
  // обгонять качественный Neural/Enhanced только из-за localService.
  if (voice.localService) score += 7;
  if (voice.default) score += 2;

  if (ROBOTIC_ENGINE_RE.test(name)) score -= 90;
  return score;
}

function matchingVoices(language: SpeechLang): SpeechSynthesisVoice[] {
  const voices = refreshVoices();
  const matches = voices
    .filter(voice => String(voice.lang || '').toLowerCase().startsWith(language))
    .sort((a, b) => voiceScore(b, language) - voiceScore(a, language));
  if (language === 'en') {
    const karen = matches.filter(isKarenVoice);
    if (karen.length > 0) return karen;
  }
  return matches;
}

export function hasVoiceFor(language: string): boolean {
  if (!speechSupported()) return false;
  if (!['en', 'it', 'es', 'de', 'fr'].includes(language)) return false;
  const voices = refreshVoices();
  if (voices.length === 0) return true;
  return voices.some(voice => String(voice.lang || '').toLowerCase().startsWith(language));
}

export function getVoicesFor(language: SpeechLang): SpeechSynthesisVoice[] {
  return matchingVoices(language);
}

export function getBestVoice(language: SpeechLang): SpeechSynthesisVoice | undefined {
  const voices = refreshVoices();
  const matches = matchingVoices(language);

  if (language === 'en') {
    const selectedKaren = matches.find(voice => {
      const preferredURI = getVoiceURI(language);
      return preferredURI ? voice.voiceURI === preferredURI : true;
    });
    if (selectedKaren) return selectedKaren;
    return matches[0];
  }

  const preferredURI = getVoiceURI(language);
  if (preferredURI) {
    const selected = voices.find(voice => voice.voiceURI === preferredURI);
    if (selected) return selected;
  }
  return matches[0];
}

export function getVoiceQualityLabel(voice: SpeechSynthesisVoice): string {
  const name = normalizedVoiceName(voice);
  if (/premium|enhanced/i.test(name)) return 'улучшенный';
  if (/neural|natural|wavenet|studio|siri|online/i.test(name)) return 'натуральный';
  return voice.localService ? 'на устройстве' : 'онлайн';
}

function normalizeSpeechText(text: string): string {
  return String(text || '')
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,.;:!?])([^\s"'])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitLongPart(part: string, maxLength = 180): string[] {
  if (part.length <= maxLength) return [part];
  const chunks: string[] = [];
  let rest = part;
  while (rest.length > maxLength) {
    const windowText = rest.slice(0, maxLength + 1);
    const candidates = [windowText.lastIndexOf(','), windowText.lastIndexOf(';'), windowText.lastIndexOf(' ')]
      .filter(index => index >= Math.floor(maxLength * 0.55));
    const cut = candidates.length > 0 ? Math.max(...candidates) + 1 : maxLength;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function splitIntoNaturalSegments(text: string): string[] {
  const sentences = text.match(/[^.!?…]+(?:[.!?…]+["']?|$)/g) || [text];
  return sentences
    .flatMap(sentence => splitLongPart(sentence.trim()))
    .map(segment => segment.trim())
    .filter(Boolean);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rateFor(intent: SpeechIntent, text: string, voice?: SpeechSynthesisVoice): number {
  const userRate = getSpeechRate();
  const userMultiplier = userRate / 0.95;
  const words = text.split(/\s+/).filter(Boolean).length;
  const naturalRate = intent === 'slow'
    ? 0.74
    : intent === 'word'
      ? 0.88
      : intent === 'reading'
        ? 0.96
        : intent === 'example' || words > 7
          ? 0.91
          : 0.95;
  const tuned = voice && isKarenVoice(voice)
    ? naturalRate * (intent === 'reading' ? 0.97 : intent === 'example' ? 0.95 : 0.96)
    : naturalRate;
  return clamp(tuned * userMultiplier, 0.66, 1.08);
}

function prepareSegment(segment: string, intent: SpeechIntent): string {
  if ((intent === 'example' || intent === 'phrase' || intent === 'reading') && !/[.!?…]$/.test(segment)) {
    return `${segment}.`;
  }
  return segment;
}

function startSpeech(
  segments: string[],
  language: SpeechLang,
  intent: SpeechIntent,
  generation: number,
  voice: SpeechSynthesisVoice | undefined,
  index = 0,
): void {
  if (!speechSupported() || generation !== speakGeneration || index >= segments.length) return;

  const segment = prepareSegment(segments[index], intent);
  const utterance = new SpeechSynthesisUtterance(segment);
  utterance.lang = bcpFor(language);
  utterance.rate = rateFor(intent, segment, voice);
  utterance.pitch = voice && isKarenVoice(voice)
    ? (intent === 'word' ? 0.98 : 0.96)
    : (intent === 'word' ? 1.01 : 1);
  utterance.volume = 1;
  if (voice) utterance.voice = voice;

  const continueWithNext = () => {
    if (generation !== speakGeneration) return;
    if (index + 1 >= segments.length) return;
    const pause = /[.!?…]["']?$/.test(segment) ? (intent === 'reading' ? 145 : 115) : 65;
    window.setTimeout(() => startSpeech(segments, language, intent, generation, voice, index + 1), pause);
  };

  utterance.onend = continueWithNext;
  utterance.onerror = event => {
    // interrupted/canceled — нормальный сценарий при повторном нажатии.
    if (event.error !== 'interrupted' && event.error !== 'canceled') continueWithNext();
  };

  try {
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
  } catch {
    // Web Speech API необязателен: при ошибке не ломаем упражнение.
  }
}

export function cancelSpeech(): void {
  speakGeneration += 1;
  if (pendingStartTimer != null) {
    window.clearTimeout(pendingStartTimer);
    pendingStartTimer = null;
  }
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
}

export function speak(text: string, language: SpeechLang, intent: SpeechIntent = 'word'): void {
  if (!speechSupported() || !isSoundOn()) return;
  const clean = normalizeSpeechText(text);
  if (!clean) return;

  cancelSpeech();
  const generation = speakGeneration;
  const segments = splitIntoNaturalSegments(clean);

  // В Safari список голосов часто появляется через несколько десятков мс.
  // Короткая задержка одновременно устраняет резкий старт сразу после cancel().
  const launch = (attempt: number) => {
    if (generation !== speakGeneration) return;
    const voice = getBestVoice(language);
    if (!voice && attempt < 3) {
      pendingStartTimer = window.setTimeout(() => launch(attempt + 1), attempt === 0 ? 70 : 160);
      return;
    }
    pendingStartTimer = null;
    startSpeech(segments, language, intent, generation, voice);
  };

  pendingStartTimer = window.setTimeout(() => launch(0), 38);
}
