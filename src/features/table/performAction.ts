import { isCurrent, useAnalysisStore } from '@/store/analysisStore';
import { useRulesStore } from '@/store/rulesStore';
import { useSessionStore } from '@/store/sessionStore';
import { useShoeStore } from '@/store/shoeStore';
import { playerActions, useTableStore, type PlayerAction } from '@/store/tableStore';
import { autoPlaysPlayer, useUiStore } from '@/store/uiStore';

/** Ejecuta una acción del jugador y, si el análisis está al día, registra la decisión. */
export function performAction(action: PlayerAction) {
  const t = useTableStore.getState();
  const rules = useRulesStore.getState().rules;
  // Como repartidor no juegas la mano del jugador: la juega el motor.
  if (autoPlaysPlayer()) return;
  if (t.phase !== 'player' || !playerActions(t.player, rules)[action]) return;
  const ui = useUiStore.getState();
  if (ui.source === 'manual' && action === 'hit') {
    document.getElementById('card-picker')?.focus();
    return;
  }
  const slot = useAnalysisStore.getState().hand;
  if (
    ui.source === 'simulation' &&
    slot.result &&
    isCurrent(slot, useShoeStore.getState().version)
  ) {
    useSessionStore.getState().record(action, slot.result);
  }
  t.act(action);
}
