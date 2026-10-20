import { beforeEach, describe, expect, it } from 'vitest';
import { presetRules } from '@/domain/rules';
import { sumCounts } from '@/domain/shoe';
import { applyRules, switchSource } from '@/store/actions';
import { useRulesStore } from '@/store/rulesStore';
import { useShoeStore } from '@/store/shoeStore';
import { useTableStore } from '@/store/tableStore';
import { useUiStore } from '@/store/uiStore';
import { buildDealerRequest, buildHandRequest, buildRoundRequest } from './requests';

const t = () => useTableStore.getState();
const input = () => ({
  version: useShoeStore.getState().version,
  rules: useRulesStore.getState().rules,
  counts: useShoeStore.getState().toCounts(),
  player: t().player,
  others: t().others,
  dealer: t().dealer,
  phase: t().phase,
});

describe('pedidos al motor', () => {
  beforeEach(() => {
    useUiStore.setState({ mode: 'player', source: 'simulation', knowHole: false });
    switchSource('manual');
    applyRules({ ...presetRules('vegas'), decks: 1 }, 'custom');
  });

  it('analyzeHand recibe exactamente la mesa: 10,6 vs 10 con 1 mazo', () => {
    t().assignCard('10', { kind: 'player' });
    t().assignCard('6', { kind: 'player' });
    t().assignCard('K', { kind: 'dealer' });
    t().assignCard('9', { kind: 'other', seat: 0 });
    t().assignCard('9', { kind: 'other', seat: 0 });
    const b = buildHandRequest(input());
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.req.hand).toEqual([9, 5]);
    expect(b.req.dealerUp).toBe(9);
    expect(b.req.shoe).toEqual([4, 4, 4, 4, 4, 3, 4, 4, 2, 14]);
    expect(b.req.version).toBe(useShoeStore.getState().version);
    expect(b.req.splitHandsSoFar).toBe(0);
    expect(b.req.allowed).toEqual({ double: true, split: false, surrender: true });
  });

  it('no pide nada con la mano incompleta', () => {
    t().assignCard('10', { kind: 'player' });
    expect(buildHandRequest(input()).ok).toBe(false);
  });

  it('tras dividir, el pedido sigue a la mano activa', () => {
    t().assignCard('8', { kind: 'player' });
    t().assignCard('8', { kind: 'player' });
    t().assignCard('6', { kind: 'dealer' });
    t().act('split');
    t().assignCard('3', { kind: 'player' });
    let b = buildHandRequest(input());
    expect(b.ok && b.req.hand).toEqual([7, 2]);
    expect(b.ok && b.req.splitHandsSoFar).toBe(1);
    t().act('stand');
    t().assignCard('2', { kind: 'player' });
    b = buildHandRequest(input());
    expect(b.ok && b.req.hand).toEqual([7, 1]);
  });

  it('analyzeDealer: la oculta conocida se descuenta solo en el pedido', () => {
    useUiStore.setState({ mode: 'dealer' });
    t().assignCard('10', { kind: 'dealer' });
    t().assignCard('6', { kind: 'dealer' });
    expect(sumCounts(useShoeStore.getState().toCounts())).toBe(51);
    const off = buildDealerRequest({ ...input(), knowHole: false });
    expect(off.ok && off.req.hole).toBeUndefined();
    expect(off.ok && sumCounts(off.req.shoe)).toBe(51);
    const on = buildDealerRequest({ ...input(), knowHole: true });
    expect(on.ok && on.req.hole).toBe(5);
    expect(on.ok && sumCounts(on.req.shoe)).toBe(50);
  });

  it('analyzeDealer: las cartas que pidió el dealer van en drawn', () => {
    useUiStore.setState({ mode: 'dealer' });
    t().assignCard('10', { kind: 'dealer' });
    t().assignCard('2', { kind: 'dealer' });
    t().revealHole();
    t().assignCard('3', { kind: 'dealer' });
    const b = buildDealerRequest({ ...input(), knowHole: false });
    expect(b.ok && b.req.hole).toBe(1);
    expect(b.ok && b.req.drawn).toEqual([2]);
    expect(b.ok && sumCounts(b.req.shoe)).toBe(49);
  });

  it('analyzeRound junta todas las manos vivas de la mesa', () => {
    t().assignCard('10', { kind: 'player' });
    t().assignCard('7', { kind: 'player' });
    t().assignCard('5', { kind: 'other', seat: 0 });
    t().assignCard('5', { kind: 'other', seat: 0 });
    t().assignCard('9', { kind: 'dealer' });
    const b = buildRoundRequest(input());
    expect(b.ok && b.req.hands).toEqual([
      [9, 6],
      [4, 4],
    ]);
  });
});
