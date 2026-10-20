// Acciones que coordinan varios stores. Toda regla nueva o cambio de fuente
// reinicia el zapato y la mesa, y por lo tanto invalida cualquier cálculo previo.
import type { PresetId, Rules } from '@/domain/rules';
import { useRulesStore } from './rulesStore';
import { useShoeStore } from './shoeStore';
import { useTableStore } from './tableStore';
import { useUiStore, type Source } from './uiStore';

const freshShoe = (decks: number, source: Source) =>
  // En manual el orden no importa: el usuario dice qué carta salió.
  useShoeStore.getState().newShoe(decks, { shuffled: source === 'simulation' });

export function applyRules(rules: Rules, preset: PresetId | 'custom') {
  useRulesStore.getState().setRules(rules, preset);
  freshShoe(rules.decks, useUiStore.getState().source);
  useTableStore.getState().resetTable();
}

export function switchSource(source: Source) {
  if (useUiStore.getState().source === source) return;
  useUiStore.getState().setSource(source);
  freshShoe(useRulesStore.getState().rules.decks, source);
  useTableStore.getState().resetTable();
}

/** Rebaraja / zapato nuevo con las reglas actuales. */
export function reshuffle() {
  freshShoe(useRulesStore.getState().rules.decks, useUiStore.getState().source);
  useTableStore.getState().resetTable();
}

/** Nueva ronda manual: las cartas de la mesa siguen fuera del zapato. */
export function clearRound() {
  useTableStore.getState().resetTable();
}

/** ¿Hay cartas en juego que se perderían con un reinicio? */
export function hasCardsInPlay() {
  const s = useShoeStore.getState();
  return s.seen.length > 0 || s.hidden.length > 0;
}
