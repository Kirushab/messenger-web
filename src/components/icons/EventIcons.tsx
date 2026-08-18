// Набор SVG-иконок для страниц событий. Все принимают size + currentColor.
// Стиль: line, strokeWidth 1.8, strokeLinecap/Linejoin round (lucide-like).
import type { CSSProperties } from 'react';

interface IconProps {
  size?: number;
  color?: string;
  style?: CSSProperties;
  strokeWidth?: number;
  className?: string;
}

const base = (size = 18, color = 'currentColor', strokeWidth = 1.8): React.SVGAttributes<SVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: color,
  strokeWidth,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
});

export function IconCalendar({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

export function IconMapPin({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function IconClock({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

export function IconUser({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function IconUsers({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function IconCheck({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function IconX({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function IconHelp({ size, color, style, strokeWidth, className }: IconProps) {
  // Знак вопроса в круге — для «Возможно»
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <circle cx="12" cy="17" r="0.5" fill={color || 'currentColor'} stroke="none" />
    </svg>
  );
}

export function IconCamera({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <rect x="3" y="6" width="18" height="14" rx="4" />
      <path d="M8 6 9.6 3.8h4.8L16 6" />
      <circle cx="12" cy="13" r="3.25" />
      <path d="M17.5 9.25h.01" strokeWidth={Math.max(2.6, strokeWidth || 1.8)} />
    </svg>
  );
}

export function IconWallet({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2" />
      <path d="M22 7H6a3 3 0 0 0 0 6h16" />
      <circle cx="16" cy="10" r="1" fill={color || 'currentColor'} stroke="none" />
    </svg>
  );
}

export function IconList({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="4" cy="6" r="1" fill={color || 'currentColor'} stroke="none" />
      <circle cx="4" cy="12" r="1" fill={color || 'currentColor'} stroke="none" />
      <circle cx="4" cy="18" r="1" fill={color || 'currentColor'} stroke="none" />
    </svg>
  );
}

export function IconShoppingCart({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M2 3h2.5L7 14h12l2-9H6" />
    </svg>
  );
}

export function IconPackage({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <path d="M16.5 9.4 7.55 4.24" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.27 6.96 8.73 5.05 8.73-5.05" />
      <path d="M12 22.08V12" />
    </svg>
  );
}

export function IconCar({ size, color, style, strokeWidth, className }: IconProps) {
  // Чистый боковой профиль: машина смотрит вправо, без фронтальной перспективы.
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <path d="M3 15.5v-2.2c0-.9.65-1.7 1.55-1.88L6.2 11l1.9-3.15A2.2 2.2 0 0 1 9.98 6.8h4.25c.75 0 1.45.38 1.86 1.01L18.2 11l2.15.5c.96.22 1.65 1.08 1.65 2.07v1.93" />
      <path d="M3 15.5h2.2m14 0H22M6.2 11h12" />
      <path d="M8.15 11 9.5 8.55h4.35c.46 0 .9.22 1.17.6L16.35 11" />
      <circle cx="7.4" cy="15.5" r="2.15" />
      <circle cx="17.7" cy="15.5" r="2.15" />
      <path d="M9.55 15.5h6" />
      <path d="M20.55 12.8h1.05" opacity="0.72" />
    </svg>
  );
}

export function IconMapPlane({ size, color = 'currentColor', style, className }: IconProps) {
  return (
    <svg width={size ?? 18} height={size ?? 18} viewBox="0 0 24 24" fill={color} stroke="none" style={style} className={className} aria-hidden="true">
      <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
    </svg>
  );
}

export function IconMapParty({ size, color = 'currentColor', style, className }: IconProps) {
  return (
    <svg width={size ?? 18} height={size ?? 18} viewBox="0 0 24 24" fill={color} stroke="none" style={style} className={className} aria-hidden="true">
      <path d="M12 2l2.6 5.9 6.4.5-4.9 4.2 1.5 6.3L12 15.8 6.4 19.2l1.5-6.3L3 8.7l6.4-.5z" />
    </svg>
  );
}

export function IconGlobe({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
    </svg>
  );
}

export function IconCloud({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <path d="M17.5 19a4.5 4.5 0 1 0-1.41-8.78A6 6 0 1 0 7 16h10.5Z" />
    </svg>
  );
}

export function IconSun({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

export function IconShirt({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
    </svg>
  );
}

export function IconGift({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  );
}

export function IconPartyPopper({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <path d="M5.8 11.3 2 22l10.7-3.79" />
      <path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10" />
      <path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7" />
      <path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z" />
    </svg>
  );
}

export function IconPlane({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </svg>
  );
}

export function IconMusic({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

export function IconCake({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" />
      <path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1" />
      <path d="M2 21h20" />
      <path d="M7 8v3M12 8v3M17 8v3" />
      <path d="M7 4h.01M12 4h.01M17 4h.01" />
    </svg>
  );
}

export function IconMessageSquare({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function IconBed({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9" />
      <circle cx="7" cy="12" r="1.5" />
    </svg>
  );
}

export function IconUtensils({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <path d="M3 2v7c0 1.1.9 2 2 2h0a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </svg>
  );
}

export function IconCoffee({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <path d="M17 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
      <line x1="6" y1="2" x2="6" y2="4" />
      <line x1="10" y1="2" x2="10" y2="4" />
      <line x1="14" y1="2" x2="14" y2="4" />
    </svg>
  );
}

export function IconBriefcase({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

export function IconChevronRight({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function IconChevronLeft({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export function IconMoreHorizontal({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <circle cx="12" cy="12" r="1" fill={color || 'currentColor'} stroke="none" />
      <circle cx="19" cy="12" r="1" fill={color || 'currentColor'} stroke="none" />
      <circle cx="5" cy="12" r="1" fill={color || 'currentColor'} stroke="none" />
    </svg>
  );
}

export function IconPlus({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function IconEdit({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" />
    </svg>
  );
}

export function IconTrash({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export function IconMap({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  );
}

export function IconTarget({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" fill={color || 'currentColor'} stroke="none" />
    </svg>
  );
}

export function IconStar({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export function IconClipboard({ size, color, style, strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
    </svg>
  );
}

export function IconPin({ size, color, style, strokeWidth, className }: IconProps) {
  // Канцелярская кнопка — для закреплённых заметок
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14V8l-2-2H7L5 8v9z" />
      <path d="M9 12h6" />
    </svg>
  );
}

export function IconNavigation({ size, color, style, strokeWidth, className }: IconProps) {
  // Стрелка-навигация для точки сбора
  return (
    <svg {...base(size, color, strokeWidth)} style={style} className={className}>
      <polygon points="3 11 22 2 13 21 11 13 3 11" />
    </svg>
  );
}
