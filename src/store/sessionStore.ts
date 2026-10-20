import { create } from 'zustand';
import type { Action, AnalyzeHandResponse } from '@/engine/contract';

export interface SessionState {
  decisions: number;
  optimal: number;
  /** Suma de (EV óptimo − EV elegido), ambos tal como los devolvió el motor. */
  evLost: number;
  record(chosen: Action, analysis: AnalyzeHandResponse): void;
  reset(): void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  decisions: 0,
  optimal: 0,
  evLost: 0,
  record(chosen, analysis) {
    const best = analysis.actions.find((a) => a.action === analysis.best);
    const mine = analysis.actions.find((a) => a.action === chosen);
    if (!best || !mine) return;
    set((s) => ({
      decisions: s.decisions + 1,
      optimal: s.optimal + (chosen === analysis.best ? 1 : 0),
      evLost: s.evLost + Math.max(0, best.ev - mine.ev),
    }));
  },
  reset: () => set({ decisions: 0, optimal: 0, evLost: 0 }),
}));
