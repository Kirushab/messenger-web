import type { CSSProperties, SVGAttributes } from 'react';

export type GlyphName =
  | 'folder' | 'book' | 'apple' | 'plane' | 'briefcase' | 'home' | 'numbers' | 'hand'
  | 'heart' | 'music' | 'sport' | 'art' | 'pizza' | 'dog' | 'globe' | 'laptop'
  | 'car' | 'party' | 'workout' | 'relax' | 'archive' | 'cards' | 'checklist'
  | 'speaker' | 'trophy' | 'flame' | 'seedling' | 'smile' | 'chili' | 'dice'
  | 'users' | 'deck' | 'bottle' | 'edit' | 'random' | 'target' | 'camera'
  | 'bed' | 'hotel' | 'tent' | 'ambulance' | 'police' | 'firetruck' | 'phone'
  | 'weather' | 'drop' | 'link' | 'map' | 'search' | 'star' | 'graduation'
  | 'chart' | 'puzzle' | 'mic' | 'shield' | 'robot' | 'ghost' | 'moon' | 'tool'
  | 'confetti';

interface GlyphIconProps {
  name?: GlyphName | string | null;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
}

const base = (size: number, strokeWidth: number): SVGAttributes<SVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  vectorEffect: 'non-scaling-stroke',
});

const Dot = ({ cx, cy }: { cx: number; cy: number }) => <circle cx={cx} cy={cy} r="0.8" fill="currentColor" stroke="none" />;

export function GlyphIcon({ name = 'folder', size = 20, strokeWidth = 1.9, className, style }: GlyphIconProps) {
  const key = normalizeGlyph(name);
  return (
    <svg {...base(size, strokeWidth)} className={className} style={style} aria-hidden="true">
      {renderGlyph(key)}
    </svg>
  );
}

export function normalizeGlyph(value?: string | null, fallback: GlyphName = 'folder'): GlyphName {
  const v = (value || '').trim().toLowerCase();
  const direct = GLYPH_NAMES.has(v as GlyphName) ? v as GlyphName : null;
  if (direct) return direct;
  return LEGACY_EMOJI_TO_GLYPH[value || ''] || LEGACY_EMOJI_TO_GLYPH[v] || fallback;
}

const GLYPH_NAMES = new Set<GlyphName>([
  'folder','book','apple','plane','briefcase','home','numbers','hand','heart','music','sport','art','pizza','dog','globe','laptop','car','party','workout','relax','archive','cards','checklist','speaker','trophy','flame','seedling','smile','chili','dice','users','deck','bottle','edit','random','target','camera','bed','hotel','tent','ambulance','police','firetruck','phone','weather','drop','link','map','search','star','graduation','chart','puzzle','mic','shield','robot','ghost','moon','tool','confetti'
]);

export const LEGACY_EMOJI_TO_GLYPH: Record<string, GlyphName> = {
  '🗂️': 'folder', '🗂': 'folder', '📚': 'book', '🍎': 'apple', '✈️': 'plane', '✈': 'plane', '🛫': 'plane', '💼': 'briefcase',
  '🏠': 'home', '🔢': 'numbers', '👋': 'hand', '❤️': 'heart', '❤': 'heart', '🎵': 'music', '🎼': 'music', '🎶': 'music', '⚽': 'sport',
  '🎨': 'art', '🍕': 'pizza', '🐶': 'dog', '🌍': 'globe', '🌐': 'globe', '💻': 'laptop', '🚗': 'car', '🎉': 'party',
  '💪': 'workout', '🌅': 'relax', '📦': 'archive', '🃏': 'cards', '✅': 'checklist', '✓': 'checklist', '🔊': 'speaker',
  '🏆': 'trophy', '🥇': 'trophy', '🥈': 'trophy', '🥉': 'trophy', '🔥': 'flame', '🌱': 'seedling', '👍': 'smile',
  '😇': 'smile', '🌶️': 'chili', '🌶': 'chili', '🎲': 'dice', '👥': 'users', '🍾': 'bottle', '✏️': 'edit', '✏': 'edit',
  '🎯': 'target', '📷': 'camera', '📸': 'camera', '🏨': 'hotel', '🛏️': 'bed', '🛏': 'bed', '⛺': 'tent',
  '🚓': 'police', '🚑': 'ambulance', '🚒': 'firetruck', '☎️': 'phone', '☎': 'phone', '🆘': 'phone',
  '☀️': 'weather', '☀': 'weather', '🌤️': 'weather', '🌤': 'weather', '☁️': 'weather', '☁': 'weather', '🌧️': 'weather', '🌧': 'weather', '❄️': 'weather', '❄': 'weather', '⛈️': 'weather', '⛈': 'weather',
  '💧': 'drop', '🔗': 'link', '🗺️': 'map', '🗺': 'map', '📍': 'map', '🔍': 'search', '⭐': 'star', '🎓': 'graduation',
  '📊': 'chart', '🧩': 'puzzle', '🎙️': 'mic', '🎙': 'mic', '🎤': 'mic', '🛡️': 'shield', '🛡': 'shield', '🤖': 'robot', '👻': 'ghost', '🌙': 'moon', '🔧': 'tool',
  '🍔': 'pizza', '🌮': 'pizza', '🍩': 'pizza', '🎬': 'cards', '🍿': 'cards', '⚡': 'flame', '🚀': 'plane', '🦸': 'shield',
  '🐉': 'flame', '🏰': 'home', '🎈': 'party', '🎮': 'deck', '🦄': 'star', '💡': 'tool', '👑': 'trophy', '💎': 'star',
  '🎸': 'music', '🏀': 'sport', '🐱': 'dog', '🦊': 'dog', '🏖️': 'relax', '🏖': 'relax', '🦋': 'seedling',
  '🎃': 'flame', '🪐': 'globe', '🎭': 'cards', '❓': 'search', '🤫': 'cards', '🙈': 'cards', '🤐': 'cards', '😈': 'flame',
};

function renderGlyph(name: GlyphName) {
  switch (name) {
    case 'folder': return <><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h4l2 2.2H19A2.5 2.5 0 0 1 21.5 8.7v8.8A2.5 2.5 0 0 1 19 20H5.5A2.5 2.5 0 0 1 3 17.5z" /></>;
    case 'book': return <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H21"/><path d="M6.5 2H21v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M9 7h7M9 11h5"/></>;
    case 'apple': return <><path d="M12 6c2.2-2.2 4.6-1.5 5.8.2 1.7 2.3.5 7.4-2.1 10.4-1.4 1.7-2.4 1.4-3.7.9-1.3.5-2.3.8-3.7-.9-2.6-3-3.8-8.1-2.1-10.4C7.4 4.5 9.8 3.8 12 6z"/><path d="M12 6c0-2 1.1-3.4 3-4"/></>;
    case 'plane': return <><path d="M21 16v-2L13 9V3.8a1.8 1.8 0 0 0-3.6 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.8-1 3.8 1v-1.5L13 19v-5.5z"/></>;
    case 'briefcase': return <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/></>;
    case 'home': return <><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V21h14V10.5"/><path d="M9.5 21v-6h5v6"/></>;
    case 'numbers': return <><path d="M8 4 6 20M18 4l-2 16M4 9h17M3 15h17"/></>;
    case 'hand': return <><path d="M18 12V7.5a1.5 1.5 0 0 0-3 0V12"/><path d="M15 11V6.5a1.5 1.5 0 0 0-3 0V12"/><path d="M12 11V7.5a1.5 1.5 0 0 0-3 0V14"/><path d="M9 13.5 7.5 12A1.8 1.8 0 0 0 5 14.5l3.6 4.3A6 6 0 0 0 13.2 21H14a5 5 0 0 0 5-5v-4"/></>;
    case 'heart': return <><path d="M20.8 8.6c0 5.1-8.8 10.4-8.8 10.4S3.2 13.7 3.2 8.6A4.6 4.6 0 0 1 12 6.5a4.6 4.6 0 0 1 8.8 2.1z"/></>;
    case 'music': return <><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></>;
    case 'sport': return <><path d="M13 5.5 17.5 8 16 13l-4 2.4L8 13 6.5 8z"/><path d="M8 13 6 18"/><path d="M16 13l2 5"/><path d="M10.2 17.5h3.6"/><path d="M9.2 7.1h5.6"/></>;
    case 'art': return <><path d="M12 3a9 9 0 0 0 0 18h1.5a1.8 1.8 0 0 0 .5-3.5 1.5 1.5 0 0 1 .4-3h1.1A5.5 5.5 0 0 0 21 9c0-3.3-3.7-6-9-6z"/><Dot cx={7.5} cy={10}/><Dot cx={10.5} cy={7}/><Dot cx={14.5} cy={7.5}/><Dot cx={16.8} cy={11}/></>;
    case 'pizza': return <><path d="M6 19c1.5-6.2 5.5-10.8 12-14-.3 6.8-3.9 11.2-10.5 14"/><path d="M8.2 16.2c2.1-4 5.1-7 9.1-9.3"/><Dot cx={11.1} cy={11.4}/><Dot cx={14.1} cy={9.2}/><Dot cx={9.1} cy={14.8}/></>;
    case 'dog': return <><path d="M7 13V9l2-3h6l2 3v4"/><path d="M7 13c0 4 2.2 7 5 7s5-3 5-7"/><path d="M7 9 4.5 6.5M17 9l2.5-2.5"/><Dot cx={10} cy={12}/><Dot cx={14} cy={12}/><path d="M11 15h2"/></>;
    case 'globe': return <><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/></>;
    case 'laptop': return <><rect x="4" y="5" width="16" height="11" rx="2"/><path d="M2 20h20l-2-4H4z"/></>;
    case 'car': return <><path d="M5 11.5 6.7 7a2.2 2.2 0 0 1 2.05-1.4h6.5A2.2 2.2 0 0 1 17.3 7l1.7 4.5"/><path d="M4.5 11.5h15A1.5 1.5 0 0 1 21 13v4.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5V13a1.5 1.5 0 0 1 1.5-1.5Z"/><path d="M7 19v1.5M17 19v1.5M7.2 15h.01M16.8 15h.01"/><path d="M6.5 11.5h11" opacity="0.72"/></>;
    case 'party': return <><path d="M5.8 11.3 2 22l10.7-3.8"/><path d="M11 13c1.9 1.9 2.8 4.2 2 5s-3.1-.1-5-2-2.8-4.2-2-5 3.1.1 5 2z"/><path d="M16 4h.01M21 7h.01M18 11h.01M14 7l2-2M20 3l-1 2"/></>;
    case 'workout': return <><path d="M6 8v8M18 8v8M2 11v2M22 11v2M6 12h12"/><path d="M4 9v6M20 9v6"/></>;
    case 'relax': return <><path d="M4 17c3.5-5.5 12.5-5.5 16 0"/><path d="M12 5v4M5 9l3 2M19 9l-3 2"/><path d="M3 20h18"/></>;
    case 'archive': return <><path d="M3 7h18v14H3z"/><path d="M3 3h18v4H3zM9 11h6"/></>;
    case 'cards': return <><rect x="7" y="3" width="11" height="15" rx="2" transform="rotate(8 12.5 10.5)"/><rect x="4" y="6" width="11" height="15" rx="2"/></>;
    case 'checklist': return <><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/></>;
    case 'speaker': return <><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15 9.5a4 4 0 0 1 0 5M18 7a8 8 0 0 1 0 10"/></>;
    case 'trophy': return <><path d="M17 4H7v5a5 5 0 0 0 10 0z"/><path d="M7 6H4a2 2 0 0 0 2 5h1M17 6h3a2 2 0 0 1-2 5h-1M12 14v5M8 21h8"/></>;
    case 'flame': return <><path d="M12 22c4 0 7-2.8 7-6.7 0-3.1-2-5.7-5.8-9.7.2 3.1-1.2 4.8-2.9 6.2.1-2.3-.7-3.8-2.2-5C6.6 9.6 5 12 5 15.2 5 19.1 8 22 12 22z"/></>;
    case 'seedling': return <><path d="M12 21V11"/><path d="M12 11C8 11 5 8.5 4 5c4 0 7 2.5 8 6z"/><path d="M12 13c4 0 7-2.5 8-6-4 0-7 2.5-8 6z"/></>;
    case 'smile': return <><circle cx="12" cy="12" r="9"/><Dot cx={9} cy={10}/><Dot cx={15} cy={10}/><path d="M8 14c1.2 2 6.8 2 8 0"/></>;
    case 'chili': return <><path d="M17 4c-1.5 0-2.6.9-3 2.4"/><path d="M14 6c4 2 5 6.5 2 9.5-3.5 3.5-8.5 2.5-11 5 1-4 1.5-8 5-11.5 1.2-1.2 2.6-2.1 4-3z"/></>;
    case 'dice': return <><rect x="4" y="4" width="16" height="16" rx="3"/><Dot cx={9} cy={9}/><Dot cx={15} cy={9}/><Dot cx={12} cy={12}/><Dot cx={9} cy={15}/><Dot cx={15} cy={15}/></>;
    case 'users': return <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></>;
    case 'deck': return <><rect x="5" y="5" width="14" height="16" rx="2"/><path d="M8 2h9a2 2 0 0 1 2 2v13"/><path d="M9 10h6M9 14h6"/></>;
    case 'bottle': return <><path d="M10 2h4v4l1.5 2v11a3 3 0 0 1-3 3h-1a3 3 0 0 1-3-3V8L10 6z"/><path d="M9 13h6"/></>;
    case 'edit': return <><path d="M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/></>;
    case 'random': return <><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6M4 4l5 5"/></>;
    case 'target': return <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/></>;
    case 'camera': return <><rect x="3" y="6" width="18" height="14" rx="4"/><path d="M8 6 9.6 3.8h4.8L16 6"/><circle cx="12" cy="13" r="3.25"/><path d="M17.5 9.25h.01"/></>;
    case 'bed': return <><path d="M3 5v14M3 13h18a2 2 0 0 1 2 2v4M3 19h20M7 9h6a2 2 0 0 1 2 2v2"/></>;
    case 'hotel': return <><path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M16 9h2a2 2 0 0 1 2 2v10M8 7h.01M12 7h.01M8 11h.01M12 11h.01M8 15h.01M12 15h.01"/></>;
    case 'tent': return <><path d="M3 20 12 4l9 16z"/><path d="M12 4v16M8 20l4-7 4 7"/></>;
    case 'ambulance': return <><path d="M3 7h10v10H3zM13 10h4l4 4v3h-8z"/><path d="M7 9v4M5 11h4"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></>;
    case 'police': return <><path d="M12 3 4 6v5c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6z"/><path d="M9 12h6M12 9v6"/></>;
    case 'firetruck': return <><path d="M3 8h11v8H3zM14 11h4l3 3v2h-7z"/><path d="M7 8V5h4v3"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></>;
    case 'phone': return <><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.4 2.1L8 9.9a16 16 0 0 0 6 6l1.4-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.8 2z"/></>;
    case 'weather': return <><circle cx="9" cy="9" r="4"/><path d="M9 1v2M9 15v2M1 9h2M15 9h2M4 4l1.4 1.4M12.6 12.6 14 14M14 4l-1.4 1.4M4 14l1.4-1.4"/><path d="M15 20h2.5a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.7 2"/></>;
    case 'drop': return <><path d="M12 22a7 7 0 0 0 7-7c0-5-7-13-7-13S5 10 5 15a7 7 0 0 0 7 7z"/></>;
    case 'link': return <><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></>;
    case 'map': return <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></>;
    case 'search': return <><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></>;
    case 'star': return <><path d="M12 2 15 8.3l7 .9-5.1 4.8 1.3 7-6.2-3.4L5.8 21l1.3-7L2 9.2l7-.9z"/></>;
    case 'graduation': return <><path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3.5 2 8.5 2 12 0v-5"/><path d="M22 10v6"/></>;
    case 'chart': return <><path d="M18 20V10M12 20V4M6 20v-6"/></>;
    case 'puzzle': return <><path d="M8 3h4v4a2 2 0 1 0 4 0V3h5v6h-4a2 2 0 1 0 0 4h4v8h-7v-4a2 2 0 1 0-4 0v4H3v-6h4a2 2 0 1 0 0-4H3V3h5z"/></>;
    case 'mic': return <><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/></>;
    case 'shield': return <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>;
    case 'robot': return <><rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 7V3M8 3h8"/><Dot cx={9} cy={13}/><Dot cx={15} cy={13}/><path d="M9 17h6"/></>;
    case 'ghost': return <><path d="M5 21V10a7 7 0 0 1 14 0v11l-3-2-3 2-3-2-3 2z"/><Dot cx={9} cy={11}/><Dot cx={15} cy={11}/></>;
    case 'moon': return <><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></>;
    case 'tool': return <><path d="M14.7 6.3a4 4 0 0 0 5 5L11 20l-4-4 8.7-8.7z"/><path d="M6 18 3 21"/></>;
    case 'confetti': return <><path d="M5.8 11.3 2 22l10.7-3.8"/><path d="M11 13c1.9 1.9 2.8 4.2 2 5s-3.1-.1-5-2-2.8-4.2-2-5 3.1.1 5 2z"/><path d="M17 4h.01M21 8h.01M17 10l3-3M14 6l1-3"/></>;
    default: return <><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h4l2 2.2H19A2.5 2.5 0 0 1 21.5 8.7v8.8A2.5 2.5 0 0 1 19 20H5.5A2.5 2.5 0 0 1 3 17.5z" /></>;
  }
}
