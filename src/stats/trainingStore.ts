// Entrenamiento dirigido: Práctica reparte manos que caen en tus puntos débiles (los
// `weakSpots` que da el servidor), más seguido los que más EV te costaron. Todo en el
// navegador: estas manos no se mandan al backend.
import { create } from 'zustand';
import type { Face } from '@/domain/cards';
import type { Action, AnalyzeHandResponse, DecisionSpot, SpotStats } from '@/engine/contract';
import { useUiStore } from '@/store/uiStore';
import { faceOfRank, pickWeighted, spotFaces } from './spots';

export interface DrillDeal {
  player: [Face, Face];
  up: Face;
}

export interface DrillVerdict {
  spot: DecisionSpot;
  chosen: Action;
  best: Action;
  /** EV perdido frente a la óptima, en unidades de la apuesta (0 si fue la óptima). */
  lost: number;
}

export interface TrainingState {
  active: boolean;
  spots: SpotStats[];
  /** La situación de la mano en la mesa. */
  current: DecisionSpot | null;
  /** Ya se registró la primera decisión de esta mano (la que se entrena). */
  decided: boolean;
  last: DrillVerdict | null;
  decisions: number;
  optimal: number;
  start(spots: SpotStats[]): void;
  stop(): void;
  /** Lo llama Práctica al repartir: las cartas de la próxima situación (o null). */
  next(): DrillDeal | null;
  record(chosen: Action, analysis: AnalyzeHandResponse): void;
}

export const useTrainingStore = create<TrainingState>()((set, get) => ({
  active: false,
  spots: [],
  current: null,
  decided: false,
  last: null,
  decisions: 0,
  optimal: 0,

  start(spots) {
    if (spots.length === 0) return;
    set({
      active: true,
      spots,
      current: null,
      decided: false,
      last: null,
      decisions: 0,
      optimal: 0,
    });
    // Las situaciones son del jugador: simulación, sin otros asientos.
    const ui = useUiStore.getState();
    ui.setMode('player');
    ui.setSource('simulation');
    ui.setBotSeats(0);
    ui.setScreen('practice');
  },

  stop: () => set({ active: false, current: null, decided: false }),

  next() {
    const { active, spots } = get();
    if (!active) return null;
    // Algunas situaciones no se arman con dos cartas: se prueba unas cuantas veces.
    for (let i = 0; i < 12; i++) {
      const s = pickWeighted(spots);
      const player = s && spotFaces(s.spot);
      if (s && player) {
        set({ current: s.spot, decided: false });
        return { player, up: faceOfRank(s.spot.dealerUp) };
      }
    }
    return null;
  },

  record(chosen, analysis) {
    const { active, decided, current } = get();
    if (!active || decided || !current) return;
    const best = analysis.actions.find((a) => a.action === analysis.best);
    const mine = analysis.actions.find((a) => a.action === chosen);
    if (!best || !mine) return;
    const ok = chosen === analysis.best;
    set({
      decided: true,
      decisions: get().decisions + 1,
      optimal: get().optimal + (ok ? 1 : 0),
      last: {
        spot: current,
        chosen,
        best: analysis.best,
        lost: ok ? 0 : Math.max(0, best.ev - mine.ev),
      },
    });
  },
}));
