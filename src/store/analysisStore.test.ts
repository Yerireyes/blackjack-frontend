import { describe, expect, it } from 'vitest';
import type { AnalyzeHandResponse } from '@/engine/contract';
import { useAnalysisStore } from './analysisStore';
import { useShoeStore } from './shoeStore';

const fake = (version: number): AnalyzeHandResponse => ({
  version,
  actions: [],
  best: 'stand',
  pBustOnHit: 0,
  dealer: { p17: 0, p18: 0, p19: 0, p20: 0, p21: 0, pBlackjack: 0, pBust: 0 },
  computeMs: 0,
});

describe('analysisStore', () => {
  it('ignora un resultado cuya versión no es la actual', () => {
    const v = useShoeStore.getState().version;
    useAnalysisStore.getState().request('hand', v);
    useShoeStore.getState().bump();
    expect(useAnalysisStore.getState().receive('hand', fake(v))).toBe(false);
    expect(useAnalysisStore.getState().hand.result).toBeNull();
    expect(useAnalysisStore.getState().hand.status).toBe('computing');
  });

  it('acepta el resultado de la versión actual', () => {
    const v = useShoeStore.getState().version;
    useAnalysisStore.getState().request('hand', v);
    expect(useAnalysisStore.getState().receive('hand', fake(v))).toBe(true);
    expect(useAnalysisStore.getState().hand).toMatchObject({ status: 'idle', requested: v });
  });

  it('un error de una versión vieja no pisa el estado', () => {
    const v = useShoeStore.getState().version;
    useAnalysisStore.getState().request('hand', v + 1);
    useAnalysisStore.getState().fail('hand', v - 1, 'viejo');
    expect(useAnalysisStore.getState().hand.status).toBe('computing');
  });
});
