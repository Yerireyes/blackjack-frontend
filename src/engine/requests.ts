// Traduce el estado de la mesa a pedidos para el motor. Funciones puras: lo que
// sale de aquí es exactamente lo que ve el motor, y los tests lo verifican.
import { handValue, toRankIndex, type Card, type RankIndex } from '@/domain/cards';
import type { Rules } from '@/domain/rules';
import { withoutRank, type Counts } from '@/domain/shoe';
import {
  activeHand,
  allowedActions,
  type DealerState,
  type Phase,
  type Seat,
} from '@/store/tableStore';
import type { AnalyzeDealerRequest, AnalyzeHandRequest, AnalyzeRoundRequest } from './contract';

export type Built<T> = { ok: true; req: T } | { ok: false; reason: string };

const ranks = (cards: readonly Card[]): RankIndex[] => cards.map((c) => toRankIndex(c.face));

export interface HandInput {
  version: number;
  rules: Rules;
  /** shoeStore.toCounts(): sin ver, incluida la oculta mientras no se revele. */
  counts: Counts;
  player: Seat;
  dealer: DealerState;
  phase: Phase;
  /** Unidades extra que cubren las fichas (playerSpare); sin límite si se omite. */
  spare?: number;
}

export function buildHandRequest(s: HandInput): Built<AnalyzeHandRequest> {
  const h = activeHand(s.player);
  if (!s.dealer.up && !h?.cards.length) {
    return { ok: false, reason: 'Reparte o ingresa una mano para ver el EV de cada acción.' };
  }
  if (!s.dealer.up) return { ok: false, reason: 'Falta la carta visible del dealer.' };
  if (!h || h.cards.length < 2) return { ok: false, reason: 'Esperando las cartas de tu mano.' };
  const v = handValue(h.cards, h.fromSplit);
  if (v.bust) return { ok: false, reason: 'Tu mano se pasó.' };
  if (s.phase !== 'player') return { ok: false, reason: 'No es tu turno.' };
  if (h.done) return { ok: false, reason: 'Tu mano ya terminó.' };
  if (h.doubled) return { ok: false, reason: 'Doblaste: falta tu última carta.' };
  if (s.dealer.holeRevealed) {
    return { ok: false, reason: 'La carta oculta ya se reveló: el turno del jugador terminó.' };
  }
  const allowed = allowedActions(s.player, s.rules, s.spare);
  return {
    ok: true,
    req: {
      version: s.version,
      rules: s.rules,
      shoe: s.counts,
      hand: ranks(h.cards),
      dealerUp: toRankIndex(s.dealer.up.face),
      splitHandsSoFar: s.player.hands.length - 1,
      isSplitAces: h.splitAces,
      allowed: { double: allowed.double, split: allowed.split, surrender: allowed.surrender },
    },
  };
}

export interface DealerInput {
  version: number;
  rules: Rules;
  counts: Counts;
  dealer: DealerState;
  /** "Conozco mi carta oculta" (modo dealer). */
  knowHole: boolean;
}

export function buildDealerRequest(s: DealerInput): Built<AnalyzeDealerRequest> {
  const d = s.dealer;
  if (!d.up) return { ok: false, reason: 'Falta la carta visible del dealer.' };
  const up = toRankIndex(d.up.face);
  const holeKnown = d.hole !== null && (d.holeRevealed || s.knowHole);
  if (!holeKnown || !d.hole) {
    return {
      ok: true,
      req: { version: s.version, rules: s.rules, shoe: s.counts, up },
    };
  }
  const hole = toRankIndex(d.hole.face);
  // Revelada ya no está en los conteos; si solo la conoce el dealer, se descuenta aquí.
  const shoe = d.holeRevealed ? s.counts : withoutRank(s.counts, hole);
  return {
    ok: true,
    req: {
      version: s.version,
      rules: s.rules,
      shoe,
      up,
      hole,
      ...(d.hits.length > 0 ? { drawn: ranks(d.hits) } : {}),
    },
  };
}

/** Manos de jugadores que entran en analyzeRound, en el mismo orden, con su etiqueta. */
export function roundHands(player: Seat, others: Seat[]) {
  return [player, ...others].flatMap((seat) =>
    seat.hands
      .map((h, i) => ({
        label: seat.hands.length > 1 ? `${seat.name} · mano ${i + 1}` : seat.name,
        cards: h.cards,
        h,
      }))
      .filter(({ h }) => h.cards.length >= 2 && !h.surrendered && !handValue(h.cards).bust),
  );
}

export interface RoundInput {
  version: number;
  rules: Rules;
  counts: Counts;
  player: Seat;
  others: Seat[];
  dealer: DealerState;
}

export function buildRoundRequest(s: RoundInput): Built<AnalyzeRoundRequest> {
  if (!s.dealer.up) return { ok: false, reason: 'Falta la carta visible del dealer.' };
  if (s.dealer.holeRevealed) return { ok: false, reason: 'La ronda ya pasó al dealer.' };
  const hands = roundHands(s.player, s.others).map((h) => ranks(h.cards));
  if (hands.length === 0) return { ok: false, reason: 'No hay manos de jugadores en la mesa.' };
  return {
    ok: true,
    req: {
      version: s.version,
      rules: s.rules,
      shoe: s.counts,
      up: toRankIndex(s.dealer.up.face),
      hands,
    },
  };
}

/** Pedido para que un bot decida con el motor (no divide para simplificar la mesa). */
export function buildBotRequest(
  version: number,
  rules: Rules,
  counts: Counts,
  seat: Seat,
  dealer: DealerState,
): AnalyzeHandRequest | null {
  const h = activeHand(seat);
  if (!h || !dealer.up || h.cards.length < 2 || h.done) return null;
  const allowed = allowedActions(seat, rules);
  return {
    version,
    rules,
    shoe: counts,
    hand: ranks(h.cards),
    dealerUp: toRankIndex(dealer.up.face),
    splitHandsSoFar: 0,
    isSplitAces: false,
    allowed: { double: allowed.double, split: false, surrender: allowed.surrender },
  };
}
