import { playSound, type Sound } from '@/lib/sound';
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

/** Lo que tarda una ficha en viajar de la bandeja a la mesa: suena al caer. */
const CHIP_FLIGHT = 0.36;

/** Escucha la mesa y las fichas y reproduce los efectos: cartas, oculta, apuesta y resultado. */
export function startSoundSync() {
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
