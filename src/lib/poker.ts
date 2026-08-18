// Утилиты для карт Texas Hold'em
// Карты: { rank: '2'..'A', suit: 'h'|'d'|'c'|'s' }

export type Suit = 'h' | 'd' | 'c' | 's';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export const SUIT_SYMBOL: Record<Suit, string> = {
  h: '♥',
  d: '♦',
  c: '♣',
  s: '♠',
};

export const SUIT_COLOR: Record<Suit, string> = {
  h: '#EF4444',  // червы — красные
  d: '#EF4444',  // бубны — красные
  c: '#1F2937',  // трефы — чёрные (на тёмном фоне будут серыми)
  s: '#1F2937',  // пики — чёрные
};

export function fmtRank(rank: Rank): string {
  if (rank === 'T') return '10';
  return rank;
}

export const HAND_NAMES_RU: Record<number, string> = {
  9: 'Роял-флеш',
  8: 'Стрит-флеш',
  7: 'Каре',
  6: 'Фулл-хаус',
  5: 'Флеш',
  4: 'Стрит',
  3: 'Сет',
  2: 'Две пары',
  1: 'Пара',
  0: 'Старшая карта',
};

const RANK_VALUE: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  T: 10, J: 11, Q: 12, K: 13, A: 14,
};

/**
 * Оценивает лучшую 5-карточную комбинацию из 5-7 карт (стандарт Texas Hold'em).
 * Возвращает рейтинг (0-9) и значение для tie-break.
 */
export interface HandRank {
  rank: number;          // 0-9
  name: string;          // 'Каре', 'Пара' и т.д.
  tiebreak: number[];    // массив для сравнения при равном rank
  best5: Card[];         // 5 лучших карт
}

export function evaluateHand(cards: Card[]): HandRank {
  if (cards.length < 5) {
    return { rank: -1, name: '—', tiebreak: [], best5: [] };
  }

  // Перебираем все 5-карточные комбинации (для 7 карт = 21 комбинация)
  const combinations = combinations5(cards);
  let best: HandRank | null = null;

  for (const combo of combinations) {
    const ev = evaluate5(combo);
    if (!best || compareHand(ev, best) > 0) best = ev;
  }

  return best!;
}

export function compareHand(a: HandRank, b: HandRank): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < a.tiebreak.length; i++) {
    if (a.tiebreak[i] !== b.tiebreak[i]) return a.tiebreak[i] - b.tiebreak[i];
  }
  return 0;
}

function combinations5(cards: Card[]): Card[][] {
  const n = cards.length;
  const result: Card[][] = [];
  for (let a = 0; a < n - 4; a++)
    for (let b = a + 1; b < n - 3; b++)
      for (let c = b + 1; c < n - 2; c++)
        for (let d = c + 1; d < n - 1; d++)
          for (let e = d + 1; e < n; e++)
            result.push([cards[a], cards[b], cards[c], cards[d], cards[e]]);
  return result;
}

function evaluate5(cards: Card[]): HandRank {
  const vals = cards.map(c => RANK_VALUE[c.rank]).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  const isFlush = suits.every(s => s === suits[0]);

  // Стрит: проверяем подряд идущие значения. Также особый случай A-2-3-4-5 (туз как 1)
  let isStraight = false;
  let straightHigh = 0;
  const uniqueSorted = Array.from(new Set(vals)).sort((a, b) => b - a);
  if (uniqueSorted.length === 5) {
    if (uniqueSorted[0] - uniqueSorted[4] === 4) {
      isStraight = true;
      straightHigh = uniqueSorted[0];
    } else if (uniqueSorted[0] === 14 && uniqueSorted[1] === 5 && uniqueSorted[4] === 2) {
      // A-2-3-4-5 (wheel)
      isStraight = true;
      straightHigh = 5;
    }
  }

  // Считаем количество каждого ранга
  const counts: Record<number, number> = {};
  for (const v of vals) counts[v] = (counts[v] || 0) + 1;
  const groups = Object.entries(counts)
    .map(([v, c]) => ({ v: Number(v), c }))
    .sort((a, b) => b.c - a.c || b.v - a.v);

  // Royal Flush: A-K-Q-J-T одной масти
  if (isFlush && isStraight && straightHigh === 14) {
    return { rank: 9, name: HAND_NAMES_RU[9], tiebreak: [14], best5: cards };
  }
  // Straight Flush
  if (isFlush && isStraight) {
    return { rank: 8, name: HAND_NAMES_RU[8], tiebreak: [straightHigh], best5: cards };
  }
  // Four of a Kind (Каре)
  if (groups[0].c === 4) {
    return { rank: 7, name: HAND_NAMES_RU[7], tiebreak: [groups[0].v, groups[1].v], best5: cards };
  }
  // Full House
  if (groups[0].c === 3 && groups[1].c === 2) {
    return { rank: 6, name: HAND_NAMES_RU[6], tiebreak: [groups[0].v, groups[1].v], best5: cards };
  }
  // Flush
  if (isFlush) {
    return { rank: 5, name: HAND_NAMES_RU[5], tiebreak: vals, best5: cards };
  }
  // Straight
  if (isStraight) {
    return { rank: 4, name: HAND_NAMES_RU[4], tiebreak: [straightHigh], best5: cards };
  }
  // Three of a Kind (Сет)
  if (groups[0].c === 3) {
    return { rank: 3, name: HAND_NAMES_RU[3], tiebreak: [groups[0].v, groups[1].v, groups[2].v], best5: cards };
  }
  // Two Pair
  if (groups[0].c === 2 && groups[1].c === 2) {
    return { rank: 2, name: HAND_NAMES_RU[2], tiebreak: [groups[0].v, groups[1].v, groups[2].v], best5: cards };
  }
  // Pair
  if (groups[0].c === 2) {
    return { rank: 1, name: HAND_NAMES_RU[1], tiebreak: [groups[0].v, groups[1].v, groups[2].v, groups[3].v], best5: cards };
  }
  // High Card
  return { rank: 0, name: HAND_NAMES_RU[0], tiebreak: vals, best5: cards };
}
