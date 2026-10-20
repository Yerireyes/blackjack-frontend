// Cartas y totales de mano. Esta capa puede sumar puntos, pero NUNCA calcula
// una probabilidad: eso es trabajo exclusivo del motor.

export type Face = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export type Suit = 'S' | 'H' | 'D' | 'C';

export interface Card {
  id: string;
  face: Face;
  suit: Suit;
}

/** Índice del motor: 0 = As, 1 = 2, ..., 8 = 9, 9 = cualquier carta de valor 10. */
export type RankIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const FACES: readonly Face[] = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
];
export const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C'];
export const RANK_LABELS: readonly string[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export const SUIT_SYMBOL: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const SUIT_NAME: Record<Suit, string> = {
  S: 'picas',
  H: 'corazones',
  D: 'diamantes',
  C: 'tréboles',
};
export const FACE_NAME: Record<Face, string> = {
  A: 'As',
  '2': 'Dos',
  '3': 'Tres',
  '4': 'Cuatro',
  '5': 'Cinco',
  '6': 'Seis',
  '7': 'Siete',
  '8': 'Ocho',
  '9': 'Nueve',
  '10': 'Diez',
  J: 'Jota',
  Q: 'Reina',
  K: 'Rey',
};

export const isRed = (s: Suit) => s === 'H' || s === 'D';

export function toRankIndex(f: Face): RankIndex {
  switch (f) {
    case 'A':
      return 0;
    case '10':
    case 'J':
    case 'Q':
    case 'K':
      return 9;
    default:
      return (Number(f) - 1) as RankIndex;
  }
}

/** Valor duro de la carta (el As vale 1). */
export const hardValue = (f: Face): number => toRankIndex(f) + 1;

/** Cartas físicas de ese rango del motor en un mazo de 52. */
export const perDeck = (r: RankIndex): number => (r === 9 ? 16 : 4);

export interface HandValue {
  /** Mejor total: un As cuenta 11 si no se pasa. */
  total: number;
  soft: boolean;
  bust: boolean;
  /** Dos cartas que suman 21, sin venir de dividir. */
  blackjack: boolean;
}

export function handValue(cards: readonly Pick<Card, 'face'>[], fromSplit = false): HandValue {
  let hard = 0;
  let hasAce = false;
  for (const c of cards) {
    hard += hardValue(c.face);
    if (c.face === 'A') hasAce = true;
  }
  const soft = hasAce && hard + 10 <= 21;
  const total = soft ? hard + 10 : hard;
  return {
    total,
    soft,
    bust: hard > 21,
    blackjack: !fromSplit && cards.length === 2 && total === 21,
  };
}

/** Texto del total como se muestra en la mesa: "17 suave", "Blackjack", "Se pasó". */
export function describeHand(cards: readonly Pick<Card, 'face'>[], fromSplit = false): string {
  if (cards.length === 0) return '';
  const v = handValue(cards, fromSplit);
  if (v.blackjack) return 'Blackjack';
  if (v.bust) return 'Se pasó';
  return v.soft && v.total < 21 ? `${v.total} suave` : String(v.total);
}

export const cardLabel = (c: Pick<Card, 'face' | 'suit'>) =>
  `${FACE_NAME[c.face]} de ${SUIT_NAME[c.suit]}`;

export const isPair = (cards: readonly Pick<Card, 'face'>[]) =>
  cards.length === 2 && toRankIndex(cards[0]!.face) === toRankIndex(cards[1]!.face);
