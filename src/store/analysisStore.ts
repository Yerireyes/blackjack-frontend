import { create } from 'zustand';
import type {
  AnalyzeDealerResponse,
  AnalyzeHandResponse,
  AnalyzeRoundResponse,
} from '@/engine/contract';
import { currentVersion } from './shoeStore';

export type AnalysisKind = 'hand' | 'dealer' | 'round';
export type AnalysisStatus = 'idle' | 'computing' | 'error';

export interface Slot<T> {
  status: AnalysisStatus;
  /** Último resultado aceptado. Puede ser de una versión anterior mientras se calcula. */
  result: T | null;
  /** Versión del estado con la que se pidió el cálculo en curso o el último. */
  requested: number | null;
  error: string | null;
  /** El cálculo lleva más de 5 s: la UI ofrece cancelar. */
  slow: boolean;
  /** Por qué no hay nada que calcular ahora (mano incompleta, turno del dealer…). */
  reason: string | null;
}

interface Results {
  hand: AnalyzeHandResponse;
  dealer: AnalyzeDealerResponse;
  round: AnalyzeRoundResponse;
}

export interface AnalysisState {
  hand: Slot<AnalyzeHandResponse>;
  dealer: Slot<AnalyzeDealerResponse>;
  round: Slot<AnalyzeRoundResponse>;
  request(kind: AnalysisKind, version: number): void;
  /** Acepta el resultado solo si su `version` es la actual. Devuelve si lo aceptó. */
  receive<K extends AnalysisKind>(kind: K, result: Results[K]): boolean;
  fail(kind: AnalysisKind, version: number, message: string): void;
  markSlow(kind: AnalysisKind, version: number): void;
  /** No hay nada que calcular para el estado actual (mano incompleta, etc.). */
  clear(kind: AnalysisKind, reason?: string): void;
}

const empty = <T>(): Slot<T> => ({
  status: 'idle',
  result: null,
  requested: null,
  error: null,
  slow: false,
  reason: null,
});

export const useAnalysisStore = create<AnalysisState>()((set, get) => ({
  hand: empty(),
  dealer: empty(),
  round: empty(),

  request(kind, version) {
    set((s) => ({
      [kind]: {
        ...s[kind],
        status: 'computing',
        requested: version,
        error: null,
        slow: false,
        reason: null,
      },
    }));
  },

  receive(kind, result) {
    if (result.version !== currentVersion()) return false;
    set({
      [kind]: { ...empty(), result, requested: result.version },
    });
    return true;
  },

  fail(kind, version, message) {
    if (version !== currentVersion()) return;
    set({ [kind]: { ...empty(), status: 'error', requested: version, error: message } });
  },

  markSlow(kind, version) {
    const slot = get()[kind];
    if (slot.status === 'computing' && slot.requested === version) {
      set({ [kind]: { ...slot, slow: true } });
    }
  },

  clear(kind, reason) {
    set({ [kind]: { ...empty(), reason: reason ?? null } });
  },
}));

/** ¿El resultado del slot corresponde exactamente al estado actual? */
export function isCurrent<T extends { version: number }>(slot: Slot<T>, version: number) {
  return slot.status === 'idle' && slot.result !== null && slot.result.version === version;
}
