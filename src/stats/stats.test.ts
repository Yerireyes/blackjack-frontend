import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccountStore } from '@/account/accountStore';
import type { Me } from '@/account/types';
import { handValue } from '@/domain/cards';
import { presetRules } from '@/domain/rules';
import type { AnalyzeHandResponse, DecisionSpot, HistoryItem, SpotStats } from '@/engine/contract';
import { applyRules, switchSource } from '@/store/actions';
import { useChipsStore } from '@/store/chipsStore';
import { useTableStore } from '@/store/tableStore';
import { useUiStore } from '@/store/uiStore';
import { setStack } from '@/tests/helpers';
import { json, stubFetch } from '@/tests/server';
import { pickWeighted, spotFaces, spotLabel } from './spots';
import { useStatsStore } from './statsStore';
import { useTrainingStore } from './trainingStore';

const me: Me = {
  id: 'u1',
  email: 'ana@example.com',
  displayName: 'Ana',
  needsDisplayName: false,
  hasPassword: true,
  providers: [],
  createdAt: '2026-10-27T12:00:00Z',
  isAdmin: false,
};

const spot = (over: Partial<DecisionSpot> = {}): DecisionSpot => ({
  kind: 'hard',
  total: 16,
  dealerUp: 9,
  ...over,
});
const weak = (s: DecisionSpot, evLost = 1): SpotStats => ({
  spot: s,
  decisions: 4,
  optimal: 1,
  evLost,
});

const item = (id: string): HistoryItem => ({
  id,
  kind: 'casual',
  contextId: 'run-1',
  bet: 10,
  net: 10,
  settledAt: '2026-10-31T10:00:00Z',
  player: { hands: [], active: 0 },
  dealer: { up: { rank: '9', suit: 'H' }, hole: { rank: '7', suit: 'S' }, hits: [] },
  peekBlackjack: false,
});

afterEach(() => vi.unstubAllGlobals());

describe('situaciones de decisión', () => {
  it('se nombran como en la mesa', () => {
    expect(spotLabel(spot())).toBe('16 duro contra 10');
    expect(spotLabel(spot({ kind: 'soft', total: 18, dealerUp: 8 }))).toBe('18 suave contra 9');
    expect(spotLabel(spot({ kind: 'pair', total: 16, pair: 7, dealerUp: 5 }))).toBe(
      'Par de 8 contra 6',
    );
    expect(spotLabel(spot({ kind: 'pair', total: 12, pair: 0, dealerUp: 0 }))).toBe(
      'Par de ases contra As',
    );
  });

  it('dos cartas que reproducen cada situación (duras sin pareja)', () => {
    for (let t = 4; t <= 20; t++) {
      for (let i = 0; i < 20; i++) {
        const f = spotFaces(spot({ total: t }))!;
        const v = handValue(f.map((face) => ({ face })));
        expect(v).toMatchObject({ total: t, soft: false });
        // Sin pareja (no se ofrece dividir), salvo 4 y 20, que solo salen así.
        if (t !== 4 && t !== 20) expect(f[0]).not.toBe(f[1]);
      }
    }
    const soft = spotFaces(spot({ kind: 'soft', total: 17 }))!;
    expect(handValue(soft.map((face) => ({ face })))).toMatchObject({ total: 17, soft: true });
    const pair = spotFaces(spot({ kind: 'pair', total: 20, pair: 9 }))!;
    expect(handValue(pair.map((face) => ({ face }))).total).toBe(20);
    // Con dos cartas no hay decisión en 21 ni en 21 suave.
    expect(spotFaces(spot({ total: 21 }))).toBeNull();
    expect(spotFaces(spot({ kind: 'soft', total: 21 }))).toBeNull();
  });

  it('elige más seguido las que más EV costaron', () => {
    const items = [weak(spot({ total: 12 }), 9), weak(spot({ total: 13 }), 1)];
    expect(pickWeighted(items, () => 0.5)?.spot.total).toBe(12);
    expect(pickWeighted(items, () => 0.95)?.spot.total).toBe(13);
  });
});

describe('historial', () => {
  beforeEach(() => {
    useAccountStore.setState({ status: 'signedIn', me, dialog: null });
    useStatsStore.getState().reset();
  });

  it('pagina con before y filtra por modo', async () => {
    const calls = stubFetch({
      'GET /me/history?limit=20&kind=ranked': () =>
        json(200, { items: [item('a'), item('b')], nextBefore: 'cur-1' }),
      'GET /me/history?limit=20&kind=ranked&before=cur-1': () => json(200, { items: [item('c')] }),
    });
    await useStatsStore.getState().setKind('ranked');
    expect(useStatsStore.getState().nextBefore).toBe('cur-1');
    await useStatsStore.getState().loadMore();
    expect(useStatsStore.getState().items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(useStatsStore.getState().nextBefore).toBeNull();
    await useStatsStore.getState().loadMore();
    expect(calls).toHaveLength(2);
  });
});

describe('entrenamiento dirigido', () => {
  const analysis = (best: 'hit' | 'stand'): AnalyzeHandResponse =>
    ({
      version: 1,
      best,
      actions: [
        { action: 'hit', ev: -0.5, pWin: 0, pPush: 0, pLose: 0, exact: true },
        { action: 'stand', ev: -0.54, pWin: 0, pPush: 0, pLose: 0, exact: true },
      ],
    }) as unknown as AnalyzeHandResponse;

  beforeEach(() => {
    useChipsStore.setState({ player: 1000, house: 1000, round: null });
    setStack('player', 10);
    useUiStore.setState({ mode: 'player', botSeats: 2, knowHole: false, source: 'manual' });
    switchSource('simulation');
    applyRules(presetRules('vegas'), 'custom');
    useTrainingStore.getState().stop();
  });

  it('Práctica reparte la situación elegida, sin otros asientos', () => {
    useTrainingStore.getState().start([weak(spot({ total: 16, dealerUp: 9 }))]);
    expect(useUiStore.getState()).toMatchObject({ screen: 'practice', botSeats: 0 });
    useTableStore.getState().deal();
    const t = useTableStore.getState();
    expect(t.others).toHaveLength(0);
    const hand = t.player.hands[0]!.cards;
    expect(handValue(hand)).toMatchObject({ total: 16, soft: false });
    expect(['10', 'J', 'Q', 'K']).toContain(t.dealer.up?.face);
    expect(useTrainingStore.getState().current).toEqual(spot({ total: 16, dealerUp: 9 }));
  });

  it('cuenta solo la primera decisión de cada mano y dice cuál era la óptima', () => {
    const train = useTrainingStore.getState();
    train.start([weak(spot())]);
    train.next();
    useTrainingStore.getState().record('stand', analysis('hit'));
    useTrainingStore.getState().record('hit', analysis('hit'));
    const s = useTrainingStore.getState();
    expect(s).toMatchObject({ decisions: 1, optimal: 0 });
    expect(s.last).toMatchObject({ chosen: 'stand', best: 'hit' });
    expect(s.last!.lost).toBeCloseTo(0.04);
  });
});
