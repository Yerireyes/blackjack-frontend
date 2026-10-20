import { useAnalysisStore, type AnalysisKind, type Slot } from '@/store/analysisStore';
import { useShoeStore } from '@/store/shoeStore';

export interface AnalysisView<T> {
  slot: Slot<T>;
  /** Resultado a mostrar (puede ser de una versión anterior: ver `stale`). */
  result: T | null;
  /** Hay un resultado pero no es del estado actual: se muestra atenuado. */
  stale: boolean;
  computing: boolean;
}

export function useAnalysis<K extends AnalysisKind>(kind: K) {
  const slot = useAnalysisStore((s) => s[kind]);
  const version = useShoeStore((s) => s.version);
  const result = slot.result;
  const stale = result !== null && result.version !== version;
  return {
    slot,
    result,
    stale,
    computing: slot.status === 'computing',
  } as AnalysisView<NonNullable<(typeof slot)['result']>>;
}
