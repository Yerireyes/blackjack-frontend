// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AnalyzeHandResponse } from '@/engine/contract';
import { ActionPanel } from './ActionPanel';

// Valores de prueba con forma de respuesta del motor (no son cifras reales).
const response: AnalyzeHandResponse = {
  version: 1,
  actions: [
    { action: 'stand', ev: -0.54095, pWin: 0.2295, pPush: 0, pLose: 0.7705, exact: true },
    { action: 'hit', ev: -0.53468, pWin: 0.2027, pPush: 0.0598, pLose: 0.7375, exact: true },
    { action: 'split', ev: -0.4472, pWin: 0.41, pPush: 0.08, pLose: 0.51, exact: false },
    { action: 'surrender', ev: -0.5, pWin: 0, pPush: 0, pLose: 1, exact: true },
  ],
  best: 'split',
  pBustOnHit: 0.6154,
  dealer: { p17: 0.1, p18: 0.1, p19: 0.1, p20: 0.3, p21: 0.1, pBlackjack: 0, pBust: 0.3 },
  computeMs: 2,
};

const plain = (s: string | null) => (s ?? '').replace(/\u00a0/g, ' ').replace(/\u2212/g, '-');

describe('ActionPanel', () => {
  it('resalta la acción que el motor marca como best (mayor EV)', () => {
    render(<ActionPanel response={response} />);
    const best = screen.getByTestId('action-best');
    expect(best).toHaveAttribute('data-action', 'split');
    expect(within(best).getByText('Recomendada')).toBeInTheDocument();
    // Solo una fila boca arriba.
    expect(screen.getAllByText('Recomendada')).toHaveLength(1);
  });

  it('marca "≈ aproximado" cuando exact es false', () => {
    render(<ActionPanel response={response} />);
    const best = screen.getByTestId('action-best');
    expect(within(best).getByText('≈ aproximado')).toBeInTheDocument();
    expect(screen.getAllByText('≈ aproximado')).toHaveLength(1);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/re-división/);
  });

  it('formatea EV con signo y dos decimales, y probabilidades con coma', () => {
    render(<ActionPanel response={response} />);
    expect(plain(screen.getByTestId('ev-stand').textContent)).toBe('-54,10 %');
    expect(plain(screen.getByTestId('ev-split').textContent)).toBe('≈ -44,72 %');
    expect(plain(screen.getByTestId('action-panel').textContent)).toMatch(/Ganar\s*22,95 %/);
  });

  it('ordena por EV y muestra solo las acciones permitidas', () => {
    render(<ActionPanel response={response} />);
    const order = screen.getAllByRole('listitem').map((li) => li.getAttribute('data-action'));
    expect(order).toEqual(['split', 'surrender', 'hit', 'stand']);
    expect(screen.queryByText('Doblar')).not.toBeInTheDocument();
  });
});
