import { FACES, SUITS, perDeck, toRankIndex, type Card, type Face, type RankIndex } from './cards';
import { shuffle, type RandomInt } from './shuffle';

/** Conteos por rango del motor: [A, 2, …, 9, T]. */
export type Counts = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export const emptyCounts = (): Counts => [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

/** Todas las cartas de `decks` mazos, en orden. Los ids son estables entre zapatos. */
export function createCards(decks: number): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (const face of FACES) cards.push({ id: `${d}-${face}${suit}`, face, suit });
    }
  }
  return cards;
}

export const createShoe = (decks: number, randomInt?: RandomInt): Card[] =>
  shuffle(createCards(decks), randomInt);

export function toCounts(...groups: readonly (readonly Card[])[]): Counts {
  const c = emptyCounts();
  for (const g of groups) for (const card of g) c[toRankIndex(card.face)]++;
  return c;
}

export function countByFace(cards: readonly Card[]): Record<Face, number> {
  const out = Object.fromEntries(FACES.map((f) => [f, 0])) as Record<Face, number>;
  for (const c of cards) out[c.face]++;
  return out;
}

/** Cartas de un rango del motor en un zapato completo. */
export const rankCapacity = (decks: number, r: RankIndex) => perDeck(r) * decks;

/** Cartas de una cara (A, 2, …, K) en un zapato completo. */
export const faceCapacity = (decks: number) => 4 * decks;

export const sumCounts = (c: readonly number[]) => c.reduce((a, b) => a + b, 0);

/** Suma de valores (As = 1). El motor exige al menos 60 para poder calcular. */
export const countsValue = (c: readonly number[]) => c.reduce((acc, n, i) => acc + n * (i + 1), 0);

export const MIN_ENGINE_SHOE_VALUE = 60;

/** Resta una carta de un rango a un vector de conteos (copia). */
export function withoutRank(c: Counts, r: RankIndex): Counts {
  const out = c.slice() as Counts;
  if (out[r] <= 0) throw new Error('No quedan cartas de ese rango para descontar');
  out[r]--;
  return out;
}
