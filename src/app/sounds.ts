import { playSound, type Sound } from '@/lib/sound';
import { useCasualStore } from '@/casual/casualStore';
import type { RoundStore } from '@/play/round';
import { useDailyStore } from '@/daily/dailyStore';
import { useRankedStore } from '@/ranked/rankedStore';
import { mySeatOf, useRoomsStore, type RoomsState } from '@/rooms/roomsStore';
import { dealerModel, resultShownOf } from '@/rooms/view';
import { cardsOnTable, fullyShown, revealSteps } from '@/play/view';
import { useChipsStore } from '@/store/chipsStore';
import { dealerCards, useTableStore, type TableState } from '@/store/tableStore';
import { useUiStore } from '@/store/uiStore';

const CARD_GAP = 0.11;
const MAX_CARD_SOUNDS = 8;

const cardCount = (s: TableState) =>
  [s.player, ...s.others].reduce(
    (n, seat) => n + seat.hands.reduce((m, h) => m + h.cards.length, 0),
    0,
  ) +
  dealerCards(s.dealer).length +
  s.discards.length;

/** Sonido del resultado de la ronda para el jugador, sumando todas sus manos. */
function outcomeSound(s: TableState): Sound | null {
  const hands = s.player.hands.filter((h) => h.outcome !== null);
  if (hands.length === 0) return null;
  if (hands.some((h) => h.outcome === 'blackjack')) return 'blackjack';
  const net = hands.reduce((n, h) => n + (h.net ?? 0), 0);
  return net > 0 ? 'win' : net < 0 ? 'lose' : 'push';
}

/** Casual, Ranked y el reto: lo que se ve de la ronda del servidor (con la revelación paso a paso). */
function startRoundSounds(store: RoundStore, screen: 'casual' | 'ranked' | 'daily') {
  store.subscribe((s, prev) => {
    // Desde el inicio también se carga la partida (para ofrecer continuarla): sin sonidos.
    const ui = useUiStore.getState();
    if (!ui.sound || ui.screen !== screen) return;
    const diff = s.stack.length - prev.stack.length;
    if (diff > 0) playSound('chip', CHIP_FLIGHT);
    else if (diff < 0) playSound('chipOff');

    const r = s.round;
    if (!r) return;
    const same = prev.round?.id === r.id;
    // Ronda nueva: todas sus cartas son nuevas.
    const before = same ? cardsOnTable(prev.round!, prev.shown) : 0;
    let at = 0;
    const added = cardsOnTable(r, s.shown) - before;
    for (let i = 0; i < Math.min(added, MAX_CARD_SOUNDS); i++) {
      playSound('card', at);
      at += CARD_GAP;
    }
    const holeNow = r.phase !== 'settled' ? false : s.shown >= 1 && r.dealer.hole !== null;
    const holeBefore =
      same &&
      prev.round!.phase === 'settled' &&
      prev.shown >= 1 &&
      prev.round!.dealer.hole !== null;
    if (holeNow && !holeBefore) playSound('flip', at);

    const done = r.phase === 'settled' && fullyShown(r, s.shown);
    const doneBefore =
      same && prev.round!.phase === 'settled' && prev.shown >= revealSteps(prev.round!);
    if (done && !doneBefore && r.result) {
      const blackjack = r.player.hands.some((h) => h.outcome === 'blackjack');
      const net = r.result.net;
      playSound(blackjack ? 'blackjack' : net > 0 ? 'win' : net < 0 ? 'lose' : 'push', at + 0.15);
    }
  });
}

/** Lo que tarda una ficha en viajar de la bandeja a la mesa: suena al caer. */
const CHIP_FLIGHT = 0.36;

export type RoomSnapshot = Pick<RoomsState, 'room' | 'me' | 'roundNo' | 'shown' | 'stack'>;
export interface TimedSound {
  sound: Sound;
  at: number;
}

/** Cartas a la vista en la sala: las de todos los asientos y las del dealer ya mostradas. */
function roomCards(s: RoomSnapshot) {
  const r = s.room?.round;
  if (!r) return 0;
  const seats = r.seats.reduce((n, x) => n + x.hands.reduce((m, h) => m + h.cards.length, 0), 0);
  return seats + dealerModel(r, s.roundNo, s.shown).cards.length;
}

const holeHidden = (s: RoomSnapshot) =>
  !s.room?.round || dealerModel(s.room.round, s.roundNo, s.shown).holeHidden;

/** Resultado de mi asiento (blackjack o el neto, seguro incluido); nada si solo miro. */
function myRoomOutcome(s: RoomSnapshot): Sound | null {
  const seat = mySeatOf(s);
  const mine = seat && s.room?.round?.seats.find((x) => x.seat === seat.seat);
  if (!mine) return null;
  if (mine.hands.some((h) => h.outcome === 'blackjack')) return 'blackjack';
  const net = mine.net ?? mine.hands.reduce((n, h) => n + (h.net ?? 0), 0);
  return net > 0 ? 'win' : net < 0 ? 'lose' : 'push';
}

/**
 * Los sonidos de un cambio en la sala: cartas nuevas en cualquier asiento o en el dealer, la
 * oculta al voltearse, mis fichas (las de los demás no suenan: con 7 asientos saturaría) y el
 * resultado de mi asiento al terminar la revelación. Función pura (sin `ui`).
 */
export function roomSoundsOf(prev: RoomSnapshot, s: RoomSnapshot): TimedSound[] {
  const out: TimedSound[] = [];
  if (!s.room || !prev.room) return out;
  const same = s.roundNo === prev.roundNo;

  // Mis fichas: la pila de la próxima apuesta (solo interfaz) y la apuesta ya hecha.
  if (s.room === prev.room) {
    const diff = s.stack.length - prev.stack.length;
    if (diff > 0) out.push({ sound: 'chip', at: CHIP_FLIGHT });
    else if (diff < 0) out.push({ sound: 'chipOff', at: 0 });
  } else {
    const bet = mySeatOf(s)?.bet;
    const betBefore = mySeatOf(prev)?.bet;
    if (bet !== undefined && betBefore === undefined) out.push({ sound: 'chip', at: 0 });
    else if (bet === undefined && betBefore !== undefined && s.room.phase === 'betting')
      out.push({ sound: 'chipOff', at: 0 });
  }

  let at = 0;
  const added = roomCards(s) - (same ? roomCards(prev) : 0);
  for (let i = 0; i < Math.min(added, MAX_CARD_SOUNDS); i++) {
    out.push({ sound: 'card', at });
    at += CARD_GAP;
  }
  if (same && holeHidden(prev) && !holeHidden(s)) out.push({ sound: 'flip', at });

  if (same && !resultShownOf(prev.room, prev.shown) && resultShownOf(s.room, s.shown)) {
    const sound = myRoomOutcome(s);
    if (sound) out.push({ sound, at: at + 0.15 });
  }
  return out;
}

/**
 * Las salas: cada `state` reemplaza la mesa. El primero al entrar o al reconectar es la foto
 * completa: no suena (como la carga inicial de las otras pantallas).
 */
function startRoomSounds() {
  let resync = true;
  useRoomsStore.subscribe((s, prev) => {
    if (s.conn !== 'open') resync = true;
    if (resync && s.room && s.room !== prev.room) {
      resync = false;
      return;
    }
    const ui = useUiStore.getState();
    if (!ui.sound || ui.screen !== 'rooms') return;
    for (const { sound, at } of roomSoundsOf(prev, s)) playSound(sound, at);
  });
}

/** Escucha la mesa y las fichas y reproduce los efectos: cartas, oculta, apuesta y resultado. */
export function startSoundSync() {
  startRoundSounds(useCasualStore as unknown as RoundStore, 'casual');
  startRoundSounds(useRankedStore as unknown as RoundStore, 'ranked');
  startRoundSounds(useDailyStore as unknown as RoundStore, 'daily');
  startRoomSounds();
  useChipsStore.subscribe((s, prev) => {
    if (!useUiStore.getState().sound || s.stacks === prev.stacks) return;
    for (const bank of ['player', 'house'] as const) {
      const diff = s.stacks[bank].length - prev.stacks[bank].length;
      if (diff > 0) playSound('chip', CHIP_FLIGHT);
      else if (diff < 0) playSound('chipOff');
    }
  });

  return useTableStore.subscribe((s, prev) => {
    if (!useUiStore.getState().sound) return;
    let at = 0;

    const added = cardCount(s) - cardCount(prev);
    for (let i = 0; i < Math.min(added, MAX_CARD_SOUNDS); i++) {
      playSound('card', at);
      at += CARD_GAP;
    }

    if (s.dealer.holeRevealed && !prev.dealer.holeRevealed && s.dealer.hole) {
      playSound('flip', at);
      at += 0.15;
    }

    if (s.phase === 'settled' && prev.phase !== 'settled') {
      const sound = outcomeSound(s);
      if (sound) playSound(sound, at + 0.15);
    }
  });
}
