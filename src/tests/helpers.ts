import type { Card, Face, Suit } from '@/domain/cards';
import { presetRules } from '@/domain/rules';
import { applyRules, switchSource } from '@/store/actions';
import { useAnalysisStore } from '@/store/analysisStore';
import { useTableStore } from '@/store/tableStore';
import { useUiStore } from '@/store/uiStore';

let n = 0;
export const card = (face: Face, suit: Suit = 'S'): Card => ({
  id: `t${++n}-${face}${suit}`,
  face,
  suit,
});
export const cards = (...faces: Face[]) => faces.map((f) => card(f));

/** Mesa manual limpia con las reglas de Las Vegas y `decks` mazos. */
export function manualTable(decks = 1) {
  useUiStore.setState({ mode: 'player', knowHole: false, botSeats: 0, source: 'simulation' });
  switchSource('manual');
  applyRules({ ...presetRules('vegas'), decks }, 'custom');
  useAnalysisStore.setState({
    hand: { ...useAnalysisStore.getState().hand, result: null, status: 'idle' },
  });
  return useTableStore.getState();
}
