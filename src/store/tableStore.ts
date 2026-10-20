import { create } from 'zustand';
import { handValue, isPair, toRankIndex, type Card, type Face } from '@/domain/cards';
import { canDoubleTotal, dealerChecksHole, dealerStands, type Rules } from '@/domain/rules';
import { countsValue, MIN_ENGINE_SHOE_VALUE } from '@/domain/shoe';
import { currentRules } from './rulesStore';
import { ShoeError, useShoeStore } from './shoeStore';
import { useUiStore } from './uiStore';

export type Outcome = 'blackjack' | 'win' | 'push' | 'lose' | 'bust' | 'surrender';
export type Phase = 'idle' | 'bots' | 'player' | 'dealer' | 'settled';

export interface PlayerHand {
  id: string;
  cards: Card[];
  fromSplit: boolean;
  /** Mano que salió de dividir ases. */
  splitAces: boolean;
  doubled: boolean;
  surrendered: boolean;
  done: boolean;
  outcome: Outcome | null;
  /** Resultado en unidades de la apuesta inicial. */
  net: number | null;
}

export interface Seat {
  id: string;
  name: string;
  bot: boolean;
  hands: PlayerHand[];
  active: number;
}

export interface DealerState {
  up: Card | null;
  hole: Card | null;
  holeRevealed: boolean;
  hits: Card[];
}

export type Target =
  { kind: 'player' } | { kind: 'dealer' } | { kind: 'other'; seat: number } | { kind: 'discard' };

export type PlayerAction = 'hit' | 'stand' | 'double' | 'split' | 'surrender';

interface HistoryEntry {
  cardId: string;
  target: Target;
}

export interface TableState {
  phase: Phase;
  player: Seat;
  others: Seat[];
  dealer: DealerState;
  discards: Card[];
  round: number;
  sessionNet: number;
  handsPlayed: number;
  /** Aviso breve para la UI (rebarajado, error de entrada manual…). */
  notice: { id: number; text: string; tone: 'info' | 'error' } | null;
  history: HistoryEntry[];

  // Simulación
  deal(): void;
  botAct(seat: number, action: Exclude<PlayerAction, 'split'>): void;
  dealerStep(): 'reveal' | 'hit' | 'settle' | 'none';
  // Jugador (ambas fuentes)
  act(action: PlayerAction): void;
  // Manual
  assignCard(face: Face, target: Target): boolean;
  undoLast(): void;
  revealHole(): void;
  // Ambas
  resetTable(): void;
  notify(text: string, tone?: 'info' | 'error'): void;
}

let uid = 0;
const nextId = (p: string) => `${p}${++uid}`;

export const newHand = (cards: Card[] = [], extra: Partial<PlayerHand> = {}): PlayerHand => ({
  id: nextId('h'),
  cards,
  fromSplit: false,
  splitAces: false,
  doubled: false,
  surrendered: false,
  done: false,
  outcome: null,
  net: null,
  ...extra,
});

const newSeat = (name: string, bot: boolean): Seat => ({
  id: nextId('s'),
  name,
  bot,
  hands: [newHand()],
  active: 0,
});

const emptyDealer = (): DealerState => ({ up: null, hole: null, holeRevealed: false, hits: [] });

export const dealerCards = (d: DealerState): Card[] =>
  [d.up, d.hole, ...d.hits].filter((c): c is Card => c !== null);

/** Cartas del dealer que el jugador puede ver. */
export const visibleDealerCards = (d: DealerState): Card[] =>
  [d.up, d.holeRevealed ? d.hole : null, ...d.hits].filter((c): c is Card => c !== null);

export const activeHand = (seat: Seat): PlayerHand | undefined => seat.hands[seat.active];

// ---- Qué permiten las reglas (lógica de reglas, no de probabilidades) ----

const lockedSplitAces = (h: PlayerHand, rules: Rules) => h.splitAces && !rules.hitSplitAces;

export function allowedActions(seat: Seat, rules: Rules): Record<PlayerAction, boolean> {
  const h = activeHand(seat);
  const none = { hit: false, stand: false, double: false, split: false, surrender: false };
  if (!h || h.done || h.cards.length < 2) return none;
  const v = handValue(h.cards, h.fromSplit);
  if (v.bust || v.blackjack) return none;
  const two = h.cards.length === 2;
  const pairRank = isPair(h.cards) ? toRankIndex(h.cards[0]!.face) : null;
  return {
    hit: !lockedSplitAces(h, rules) && v.total < 21,
    stand: true,
    double:
      two &&
      !h.doubled &&
      !lockedSplitAces(h, rules) &&
      canDoubleTotal(rules, v.total, v.soft) &&
      (!h.fromSplit || rules.doubleAfterSplit),
    split:
      two &&
      pairRank !== null &&
      seat.hands.length < rules.maxSplitHands &&
      !(pairRank === 0 && h.splitAces && !rules.resplitAces),
    surrender:
      two &&
      rules.surrender === 'late' &&
      rules.dealerPeeks &&
      !h.fromSplit &&
      seat.hands.length === 1,
  };
}

export function dealerMustHit(d: DealerState, rules: Rules): boolean {
  if (!d.up || !d.hole) return false;
  const v = handValue(dealerCards(d));
  return !v.blackjack && !v.bust && !dealerStands(rules, v.total, v.soft);
}

const handIsLive = (h: PlayerHand) => !h.surrendered && !handValue(h.cards, h.fromSplit).bust;

/** Liquida una mano frente al dealer, en unidades de la apuesta inicial. */
export function settleHand(
  h: PlayerHand,
  d: DealerState,
  rules: Rules,
): { outcome: Outcome; net: number } {
  const bet = h.doubled ? 2 : 1;
  const dv = handValue(dealerCards(d));
  const pv = handValue(h.cards, h.fromSplit);
  if (h.surrendered) return { outcome: 'surrender', net: -0.5 };
  if (pv.blackjack) {
    return dv.blackjack
      ? { outcome: 'push', net: 0 }
      : { outcome: 'blackjack', net: rules.blackjackPays };
  }
  // Sin peek (regla europea) el blackjack del dealer se lleva todo lo apostado.
  if (dv.blackjack) return { outcome: 'lose', net: -bet };
  if (pv.bust) return { outcome: 'bust', net: -bet };
  if (dv.bust || pv.total > dv.total) return { outcome: 'win', net: bet };
  if (pv.total === dv.total) return { outcome: 'push', net: 0 };
  return { outcome: 'lose', net: -bet };
}

// ---- Store ----

const shoe = () => useShoeStore.getState();
type Draft = Pick<TableState, 'player' | 'others' | 'dealer' | 'discards' | 'history' | 'phase'>;

export const useTableStore = create<TableState>()((set, get) => {
  /** Copia profunda de la mesa, la modifica y la guarda. Sube la versión del zapato. */
  const mutate = (fn: (d: Draft) => void) => {
    const s = get();
    const d: Draft = structuredClone({
      player: s.player,
      others: s.others,
      dealer: s.dealer,
      discards: s.discards,
      history: s.history,
      phase: s.phase,
    });
    fn(d);
    set(d);
    shoe().bump();
  };

  const isSim = () => useUiStore.getState().source === 'simulation';

  const draw = (hidden = false) => shoe().drawCard({ hidden });

  /** Pasa a la siguiente mano pendiente del jugador o al turno del dealer. */
  const advancePlayer = (d: Draft, rules: Rules) => {
    const seat = d.player;
    for (let i = seat.active; i < seat.hands.length; i++) {
      const h = seat.hands[i]!;
      if (h.done) continue;
      seat.active = i;
      if (isSim() && h.cards.length === 1) {
        h.cards.push(draw());
        const v = handValue(h.cards, true);
        if (lockedSplitAces(h, rules) || v.total === 21) {
          h.done = true;
          continue;
        }
      }
      if (h.cards.length >= 2 || !isSim()) return;
    }
    // Sin manos pendientes.
    seat.active = Math.max(0, Math.min(seat.active, seat.hands.length - 1));
    if (isSim()) d.phase = 'dealer';
    else if (seat.hands.every((h) => h.done)) d.phase = 'dealer';
  };

  const finishSettle = (d: Draft, rules: Rules) => {
    let net = 0;
    for (const seat of [d.player, ...d.others]) {
      for (const h of seat.hands) {
        if (h.cards.length === 0) continue;
        const r = settleHand(h, d.dealer, rules);
        h.outcome = r.outcome;
        h.net = r.net;
        h.done = true;
        if (!seat.bot) net += r.net;
      }
    }
    d.phase = 'settled';
    return net;
  };

  const settleNow = (d: Draft, rules: Rules) => {
    const net = finishSettle(d, rules);
    set((s) => ({ sessionNet: s.sessionNet + net, handsPlayed: s.handsPlayed + 1 }));
  };

  const afterBots = (d: Draft) => {
    const pending = d.player.hands.some((h) => !h.done);
    d.phase = pending ? 'player' : 'dealer';
  };

  return {
    phase: 'idle',
    player: newSeat('Tú', false),
    others: [],
    dealer: emptyDealer(),
    discards: [],
    round: 0,
    sessionNet: 0,
    handsPlayed: 0,
    notice: null,
    history: [],

    notify(text, tone = 'info') {
      set({ notice: { id: Date.now(), text, tone } });
    },

    resetTable() {
      set((s) => ({
        phase: isSim() ? 'idle' : 'player',
        player: newSeat('Tú', false),
        others: [],
        dealer: emptyDealer(),
        discards: [],
        history: [],
        round: s.round + 1,
      }));
      shoe().bump();
    },

    deal() {
      const { phase } = get();
      if (!isSim() || (phase !== 'idle' && phase !== 'settled')) return;
      const rules = currentRules();
      const bots = useUiStore.getState().botSeats;

      // Rebaraja al llegar a la penetración o si no alcanzan las cartas para la ronda.
      const seats = bots + 1;
      const need = MIN_ENGINE_SHOE_VALUE + 31 * seats * 2 + 26;
      const s = shoe();
      if (s.dealtFraction() >= rules.penetration || countsValue(s.toCounts()) < need) {
        s.newShoe(rules.decks);
        get().notify('Se alcanzó la penetración: zapato nuevo barajado.');
      }

      set((st) => ({
        player: newSeat('Tú', false),
        others: Array.from({ length: bots }, (_, i) => newSeat(`Asiento ${i + 1}`, true)),
        dealer: emptyDealer(),
        discards: [],
        history: [],
        round: st.round + 1,
      }));

      mutate((d) => {
        const order = [...d.others, d.player];
        for (const seat of order) seat.hands[0]!.cards.push(draw());
        d.dealer.up = draw();
        for (const seat of order) seat.hands[0]!.cards.push(draw());
        d.dealer.hole = draw(true);

        // Naturales: la mano queda terminada; se liquida al final.
        for (const seat of order) {
          const h = seat.hands[0]!;
          if (handValue(h.cards).blackjack) h.done = true;
        }

        // Peek: si el dealer tiene blackjack, se revela y la ronda termina.
        const upRank = toRankIndex(d.dealer.up.face);
        if (dealerChecksHole(rules, upRank) && handValue([d.dealer.up, d.dealer.hole]).blackjack) {
          d.dealer.holeRevealed = true;
          shoe().reveal(d.dealer.hole.id);
          settleNow(d, rules);
          return;
        }
        if (d.others.some((seat) => seat.hands.some((h) => !h.done))) d.phase = 'bots';
        else afterBots(d);
      });
    },

    botAct(seatIndex, action) {
      if (get().phase !== 'bots') return;
      mutate((d) => {
        const seat = d.others[seatIndex];
        const h = seat && activeHand(seat);
        if (!seat || !h || h.done) return;
        if (action === 'hit') {
          h.cards.push(draw());
          const v = handValue(h.cards);
          if (v.bust || v.total === 21) h.done = true;
        } else if (action === 'double') {
          h.doubled = true;
          h.cards.push(draw());
          h.done = true;
        } else if (action === 'surrender') {
          h.surrendered = true;
          h.done = true;
        } else {
          h.done = true;
        }
        if (d.others.every((st) => st.hands.every((x) => x.done))) afterBots(d);
      });
    },

    act(action) {
      const st = get();
      if (st.phase !== 'player') return;
      const rules = currentRules();
      if (!allowedActions(st.player, rules)[action]) return;
      const sim = isSim();
      try {
        mutate((d) => {
          const seat = d.player;
          const h = seat.hands[seat.active]!;
          switch (action) {
            case 'hit': {
              if (!sim) {
                // En manual, la carta se agrega con el selector.
                return;
              }
              h.cards.push(draw());
              const v = handValue(h.cards, h.fromSplit);
              if (v.bust || v.total === 21) h.done = true;
              break;
            }
            case 'stand':
              h.done = true;
              break;
            case 'double':
              h.doubled = true;
              if (sim) {
                h.cards.push(draw());
                h.done = true;
              }
              break;
            case 'surrender':
              h.surrendered = true;
              h.done = true;
              break;
            case 'split': {
              const [a, b] = h.cards as [Card, Card];
              const aces = a.face === 'A';
              const h1 = newHand([a], { fromSplit: true, splitAces: aces });
              const h2 = newHand([b], { fromSplit: true, splitAces: aces });
              seat.hands.splice(seat.active, 1, h1, h2);
              if (sim) {
                h1.cards.push(draw());
                const v = handValue(h1.cards, true);
                if (lockedSplitAces(h1, rules) || v.total === 21) h1.done = true;
              }
              break;
            }
          }
          if (h.done || (action === 'split' && seat.hands[seat.active]!.done)) {
            advancePlayer(d, rules);
          }
        });
      } catch (e) {
        if (e instanceof ShoeError) get().notify(e.message, 'error');
        else throw e;
      }
    },

    dealerStep() {
      const st = get();
      if (st.phase !== 'dealer') return 'none';
      const rules = currentRules();
      let did: 'reveal' | 'hit' | 'settle' | 'none' = 'none';
      mutate((d) => {
        const dl = d.dealer;
        if (!dl.up) return;
        if (dl.hole && !dl.holeRevealed) {
          dl.holeRevealed = true;
          shoe().reveal(dl.hole.id);
          did = 'reveal';
          return;
        }
        const anyLive = [d.player, ...d.others].some((seat) =>
          seat.hands.some(
            (h) =>
              h.cards.length > 0 && handIsLive(h) && !handValue(h.cards, h.fromSplit).blackjack,
          ),
        );
        if (isSim() && anyLive && dealerMustHit(dl, rules)) {
          dl.hits.push(draw());
          did = 'hit';
          return;
        }
        if (!dl.hole) return;
        settleNow(d, rules);
        did = 'settle';
      });
      return did;
    },

    assignCard(face, target) {
      if (isSim()) return false;
      const rules = currentRules();
      const mode = useUiStore.getState().mode;
      try {
        mutate((d) => {
          if (d.phase === 'settled' || d.phase === 'idle') d.phase = 'player';
          switch (target.kind) {
            case 'player': {
              const seat = d.player;
              const h = seat.hands[seat.active];
              if (!h || h.done) throw new ShoeError('La mano activa ya terminó.');
              const card = shoe().markSeen(face);
              h.cards.push(card);
              const v = handValue(h.cards, h.fromSplit);
              if (v.bust || (h.doubled && h.cards.length >= 3) || lockedSplitAndFull(h, rules)) {
                h.done = true;
                advancePlayer(d, rules);
              }
              d.history.push({ cardId: card.id, target });
              break;
            }
            case 'dealer': {
              const dl = d.dealer;
              let card: Card;
              if (!dl.up) {
                card = shoe().markSeen(face);
                dl.up = card;
              } else if (!dl.hole) {
                // En modo dealer la oculta es conocida solo por el dealer: no se descuenta.
                const hidden = mode === 'dealer';
                card = hidden ? shoe().markHidden(face) : shoe().markSeen(face);
                dl.hole = card;
                dl.holeRevealed = !hidden;
              } else {
                if (!dl.holeRevealed) {
                  throw new ShoeError('Revela primero la carta oculta del dealer.');
                }
                const v = handValue(dealerCards(dl));
                if (v.bust || v.blackjack) throw new ShoeError('El dealer ya terminó su mano.');
                card = shoe().markSeen(face);
                dl.hits.push(card);
              }
              d.history.push({ cardId: card.id, target });
              break;
            }
            case 'other': {
              if (target.seat > d.others.length || target.seat >= 6) {
                throw new ShoeError('La mesa admite hasta 6 manos además de la tuya.');
              }
              if (target.seat === d.others.length) {
                d.others.push(newSeat(`Mano ${target.seat + 1}`, false));
              }
              const card = shoe().markSeen(face);
              d.others[target.seat]!.hands[0]!.cards.push(card);
              d.history.push({ cardId: card.id, target });
              break;
            }
            case 'discard': {
              const card = shoe().markSeen(face);
              d.discards.push(card);
              d.history.push({ cardId: card.id, target });
              break;
            }
          }
        });
        return true;
      } catch (e) {
        if (e instanceof ShoeError) {
          get().notify(e.message, 'error');
          return false;
        }
        throw e;
      }
    },

    undoLast() {
      const last = get().history.at(-1);
      if (!last || isSim()) return;
      mutate((d) => {
        d.history.pop();
        const id = last.cardId;
        const drop = (cards: Card[]) => {
          const i = cards.findIndex((c) => c.id === id);
          if (i !== -1) cards.splice(i, 1);
          return i !== -1;
        };
        switch (last.target.kind) {
          case 'player':
            d.player.hands.forEach((h, i) => {
              if (drop(h.cards)) {
                h.done = false;
                d.player.active = i;
              }
            });
            d.phase = 'player';
            break;
          case 'dealer':
            if (d.dealer.hits.length > 0) drop(d.dealer.hits);
            else if (d.dealer.hole?.id === id) {
              d.dealer.hole = null;
              d.dealer.holeRevealed = false;
            } else if (d.dealer.up?.id === id) d.dealer.up = null;
            break;
          case 'other': {
            const seat = d.others[last.target.seat];
            if (seat) {
              drop(seat.hands[0]!.cards);
              if (seat.hands[0]!.cards.length === 0 && last.target.seat === d.others.length - 1) {
                d.others.pop();
              }
            }
            break;
          }
          case 'discard':
            drop(d.discards);
            break;
        }
        shoe().returnCards([id]);
      });
    },

    revealHole() {
      mutate((d) => {
        const dl = d.dealer;
        if (!dl.hole || dl.holeRevealed) return;
        dl.holeRevealed = true;
        shoe().reveal(dl.hole.id);
      });
    },
  };
});

function lockedSplitAndFull(h: PlayerHand, rules: Rules) {
  return lockedSplitAces(h, rules) && h.cards.length >= 2;
}

/** Ids de todas las cartas que están ahora en la mesa (no se pueden devolver al zapato). */
export function tableCardIds(s: Pick<TableState, 'player' | 'others' | 'dealer' | 'discards'>) {
  const ids = new Set<string>();
  for (const seat of [s.player, ...s.others])
    for (const h of seat.hands) for (const c of h.cards) ids.add(c.id);
  for (const c of dealerCards(s.dealer)) ids.add(c.id);
  return ids;
}
