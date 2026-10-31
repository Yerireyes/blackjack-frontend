// De RoomState (lo que manda el servidor) a lo que dibuja la mesa de la sala. Funciones puras.
import type { Card } from '@/domain/cards';
import type {
  CardView,
  RoomState,
  RoundView,
  SeatRoundView,
  TableRoundView,
} from '@/engine/contract';
import type { TableHand } from '@/play/view';

/** Pasos de la revelación del dealer en `results`: voltear la oculta y cada carta pedida. */
export const revealStepsOf = (r: TableRoundView) =>
  r.phase === 'settled' ? (r.dealer.hole ? 1 : 0) + r.dealer.hits.length : 0;

const toCard = (c: CardView, id: string): Card => ({ id, face: c.rank, suit: c.suit });

export interface DealerModel {
  cards: Card[];
  holeHidden: boolean;
}

/** El dealer con `shown` pasos de revelación (ids estables por ronda para animar). */
export function dealerModel(r: TableRoundView, roundNo: number, shown: number): DealerModel {
  const settled = r.phase === 'settled';
  const hole = r.dealer.hole;
  const holeShown = hole !== null && (!settled || shown >= 1);
  const hitsShown = settled ? Math.max(0, shown - (hole ? 1 : 0)) : r.dealer.hits.length;
  return {
    cards: [
      toCard(r.dealer.up, `r${roundNo}-up`),
      holeShown
        ? toCard(hole, `r${roundNo}-hole`)
        : { id: `r${roundNo}-hole`, face: 'A', suit: 'S' },
      ...r.dealer.hits.slice(0, hitsShown).map((c, i) => toCard(c, `r${roundNo}-hit${i}`)),
    ],
    holeHidden: !holeShown,
  };
}

/** Las manos de un asiento; los resultados solo cuando terminó la revelación. */
export function seatHands(s: SeatRoundView, roundNo: number, resultShown: boolean): TableHand[] {
  return s.hands.map((h, i) => ({
    id: `r${roundNo}-s${s.seat}-h${i}`,
    cards: h.cards.map((c, j) => toCard(c, `r${roundNo}-s${s.seat}-h${i}-${j}`)),
    fromSplit: h.fromSplit,
    doubled: h.doubled,
    outcome: resultShown ? (h.outcome ?? null) : null,
    net: resultShown ? (h.net ?? null) : null,
  }));
}

/** ¿Ya se ve la liquidación entera (dealer revelado)? */
export const resultShownOf = (room: RoomState, shown: number) =>
  room.phase === 'results' && !!room.round && shown >= revealStepsOf(room.round);

/**
 * Mi decisión con la forma de una RoundView, para pedirle al motor el EV con las mismas
 * funciones que Casual: mi turno o, con As visible, mi seguro pendiente. Solo con ayudas
 * (`shoeCounts`).
 */
export function myDecisionAsRound(room: RoomState, mySeat: number): RoundView | null {
  const r = room.round;
  if (!r || room.phase !== 'playing' || !room.shoeCounts) return null;
  const seat = r.seats.find((s) => s.seat === mySeat);
  if (!seat) return null;
  const insurance = r.phase === 'insurance';
  if (insurance ? seat.insured !== undefined : r.turn !== mySeat) return null;
  return {
    id: 'room',
    kind: 'casual',
    contextId: room.info.code,
    bet: seat.bet,
    phase: insurance ? 'insurance' : 'player',
    player: { hands: seat.hands, active: seat.active },
    dealer: r.dealer,
    allowed: r.allowed,
    peekBlackjack: r.peekBlackjack,
    wallet: { balance: 0, maxBet: 0 },
    penetration: room.penetration,
    shoeCounts: room.shoeCounts,
  };
}
