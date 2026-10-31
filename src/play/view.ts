// De RoundView (lo que manda el servidor) a lo que dibuja la mesa. Funciones puras.
import { handValue, type Card } from '@/domain/cards';
import type { CardView, HandOutcome, RoundView } from '@/engine/contract';

/**
 * Pasos de la revelación del dealer al liquidar: voltear la oculta y luego cada carta que
 * pidió, en orden. Durante el turno del jugador no hay nada que revelar.
 */
export const revealSteps = (r: RoundView) =>
  r.phase === 'settled' ? (r.dealer.hole ? 1 : 0) + r.dealer.hits.length : 0;

/** ¿Ya se ve todo lo que trajo la liquidación (cartas del dealer y resultados)? */
export const fullyShown = (r: RoundView, shown: number) => shown >= revealSteps(r);

const toCard = (c: CardView, id: string): Card => ({ id, face: c.rank, suit: c.suit });

export interface TableHand {
  id: string;
  cards: Card[];
  fromSplit: boolean;
  doubled: boolean;
  outcome: HandOutcome | null;
  net: number | null;
}

export interface TableModel {
  /** Visible, oculta (boca abajo o volteada) y las pedidas que ya se mostraron. */
  dealer: Card[];
  holeHidden: boolean;
  hands: TableHand[];
  /** Resultados visibles: la revelación terminó. */
  resultShown: boolean;
}

/**
 * Lo que se dibuja con `shown` pasos de revelación. Los ids son estables por ronda y
 * posición, así la oculta se voltea en su lugar y las cartas nuevas entran animadas.
 */
export function tableModel(r: RoundView, shown: number): TableModel {
  const settled = r.phase === 'settled';
  const hole = r.dealer.hole;
  const holeShown = hole !== null && (!settled || shown >= 1);
  const hitsShown = settled ? Math.max(0, shown - (hole ? 1 : 0)) : r.dealer.hits.length;
  const resultShown = settled && fullyShown(r, shown);

  const dealer = [
    toCard(r.dealer.up, `${r.id}-up`),
    // Mientras está oculta se dibuja el dorso; la figura de relleno nunca se ve.
    holeShown
      ? toCard(hole, `${r.id}-hole`)
      : { id: `${r.id}-hole`, face: 'A' as const, suit: 'S' as const },
    ...r.dealer.hits.slice(0, hitsShown).map((c, i) => toCard(c, `${r.id}-hit${i}`)),
  ];

  return {
    dealer,
    holeHidden: !holeShown,
    hands: r.player.hands.map((h, i) => ({
      id: `${r.id}-hand${i}`,
      cards: h.cards.map((c, j) => toCard(c, `${r.id}-hand${i}-${j}`)),
      fromSplit: h.fromSplit,
      doubled: h.doubled,
      outcome: resultShown ? (h.outcome ?? null) : null,
      net: resultShown ? (h.net ?? null) : null,
    })),
    resultShown,
  };
}

/** Cartas que hay en la mesa con `shown` pasos (para los sonidos de reparto). */
export function cardsOnTable(r: RoundView, shown: number) {
  const m = tableModel(r, shown);
  return m.dealer.length + m.hands.reduce((n, h) => n + h.cards.length, 0);
}

/** Blackjack natural (dos cartas que suman 21, sin dividir): el seguro se llama «dinero par». */
export const isNatural = (cards: Pick<Card, 'face'>[], fromSplit: boolean) =>
  !fromSplit && cards.length === 2 && handValue(cards, false).total === 21;
