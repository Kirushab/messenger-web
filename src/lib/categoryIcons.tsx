import React from 'react';

// Пути SVG-иконок категорий точек — один источник для React-компонента (карточка,
// чипы) и для маркеров на карте (innerHTML строкой). Ключи = POINT_CATEGORIES.
const PATHS: Record<string, string> = {
  place: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  food: '<path d="M4 3v6a2 2 0 0 0 4 0V3"/><line x1="6" y1="9" x2="6" y2="21"/><path d="M18 3v18"/><path d="M18 3c-2 0-3 3-3 5.5S16.5 13 18 13"/>',
  bar: '<path d="M5 4h14l-7 8z"/><line x1="12" y1="12" x2="12" y2="20"/><line x1="8" y1="20" x2="16" y2="20"/>',
  home: '<path d="M3 9.5 12 3l9 6.5"/><path d="M5 8.5V21h14V8.5"/><path d="M9.5 21v-6h5v6"/>',
  park: '<circle cx="12" cy="9" r="6"/><line x1="12" y1="15" x2="12" y2="22"/>',
  shop: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  fun: '<path d="M12 3v4"/><path d="M12 17v4"/><path d="M3 12h4"/><path d="M17 12h4"/><path d="M5.6 5.6l2.8 2.8"/><path d="M15.6 15.6l2.8 2.8"/><path d="M18.4 5.6l-2.8 2.8"/><path d="M8.4 15.6l-2.8 2.8"/>',
  sport: '<circle cx="12" cy="12" r="9"/><path d="m12 7 3 2.2-1.1 3.5h-3.8L9 9.2z"/>',
};

export function categoryInner(category: string | null): string {
  return PATHS[category || 'place'] || PATHS.place;
}

// Полная SVG-разметка строкой — для маркеров на карте (makePin innerHTML).
export function categorySvgMarkup(category: string | null, opts?: { size?: number; color?: string; strokeWidth?: number }): string {
  const { size = 20, color = '#fff', strokeWidth = 2 } = opts || {};
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${categoryInner(category)}</svg>`;
}

export function CategoryIcon({ category, size = 16, color = 'currentColor', strokeWidth = 1.8 }: { category: string | null; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: categoryInner(category) }} />
  );
}
