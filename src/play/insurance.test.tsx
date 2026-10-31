// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccountStore } from '@/account/accountStore';
import type { Me } from '@/account/types';
import { useDailyStore } from '@/daily/dailyStore';
import { presetRules } from '@/domain/rules';
import type { CardView, DailyAttemptView, RoundView } from '@/engine/contract';
import { buildCasualHandRequest } from '@/engine/requests';
import { json, stubFetch } from '@/tests/server';
import { InsuranceAsk } from './Insurance';
import { REVEAL_PEEK_MS, REVEAL_STEP_MS, roundLocked } from './round';
import { isNatural } from './view';

const c = (rank: CardView['rank'], suit: CardView['suit'] = 'S'): CardView => ({ rank, suit });

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

const attempt: DailyAttemptView = {
  id: 'att-1',
  day: '2026-10-30',
  status: 'active',
  balance: 400,
  peak: 500,
  hands: 3,
  handsTotal: 30,
  maxBet: 400,
  penetration: 0.1,
  startedAt: '2026-10-30T10:00:00Z',
};

const NONE = { hit: false, stand: false, double: false, split: false, surrender: false };

/** Ronda con As del dealer, esperando la decisión del seguro (la oculta sigue en null). */
const asking = (over: Partial<RoundView> = {}): RoundView => ({
  id: 'r-1',
  kind: 'daily',
  contextId: 'att-1',
  bet: 100,
  phase: 'insurance',
  player: {
    hands: [{ cards: [c('10'), c('9')], doubled: false, surrendered: false, fromSplit: false }],
    active: 0,
  },
  dealer: { up: c('A', 'H'), hole: null, hits: [] },
  allowed: { ...NONE, insurance: true },
  peekBlackjack: false,
  wallet: { balance: 400, maxBet: 400 },
  penetration: 0.1,
  ...over,
});

const ds = () => useDailyStore.getState();

beforeEach(() => {
  useAccountStore.setState({ status: 'signedIn', me, dialog: null });
  ds().reset();
  useDailyStore.setState({ status: 'active', attempt, wallet: { balance: 400, maxBet: 400 } });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('seguro en las rondas individuales', () => {
  it('con la pregunta pendiente no se reparte otra ronda ni se toca la apuesta', () => {
    useDailyStore.setState({ round: asking() });
    expect(roundLocked(ds())).toBe(true);
  });

  it('decidir manda take con su clave y aplica la respuesta (peek con blackjack: liquidada)', async () => {
    vi.useFakeTimers();
    useDailyStore.setState({ round: asking() });
    const settled = asking({
      phase: 'settled',
      insured: true,
      peekBlackjack: true,
      allowed: NONE,
      dealer: { up: c('A', 'H'), hole: c('K'), hits: [] },
      result: { net: 0, insuranceNet: 100 },
    });
    const calls = stubFetch({
      'POST /play/rounds/r-1/insurance': () => json(200, settled),
      'GET /daily/me': () => json(200, attempt),
      'GET /daily/leaderboard': () => json(200, { day: '2026-10-30', top: [] }),
      'GET /me/records': () =>
        json(200, { casual: { runs: 0 }, ranked: { seasons: [] }, daily: { finished: 0 } }),
    });
    await ds().insure(true);
    expect(calls[0]!.body).toMatchObject({ take: true });
    expect(typeof (calls[0]!.body as { idempotencyKey: string }).idempotencyKey).toBe('string');
    expect(ds().round?.insured).toBe(true);
    // Con peek, la revelación espera más: se ve el reparto antes de voltear la oculta.
    expect(ds().revealing).toBe(true);
    await vi.advanceTimersByTimeAsync(REVEAL_PEEK_MS + REVEAL_STEP_MS);
    expect(ds().revealing).toBe(false);
  });

  it('sin fichas para el seguro, tomarlo no se manda; rechazarlo sí', async () => {
    useDailyStore.setState({ round: asking({ allowed: { ...NONE, insurance: false } }) });
    const calls = stubFetch({
      'POST /play/rounds/r-1/insurance': () =>
        json(200, asking({ phase: 'player', insured: false })),
    });
    await ds().insure(true);
    expect(calls).toHaveLength(0);
    await ds().insure(false);
    expect(calls[0]!.body).toMatchObject({ take: false });
    expect(ds().round?.phase).toBe('player');
  });

  it('el motor también analiza en la fase del seguro (para dar insuranceEv)', () => {
    const r = asking({ kind: 'casual', shoeCounts: [20, 24, 24, 24, 24, 24, 24, 24, 24, 96] });
    const built = buildCasualHandRequest(1, presetRules('vegas'), r);
    expect(built.ok).toBe(true);
    expect(buildCasualHandRequest(1, presetRules('vegas'), { ...r, phase: 'settled' }).ok).toBe(
      false,
    );
  });
});

describe('la pregunta', () => {
  it('con blackjack propio es «dinero par»; sin una mano natural, «seguro»', () => {
    expect(isNatural([{ face: 'A' }, { face: 'K' }], false)).toBe(true);
    expect(isNatural([{ face: 'A' }, { face: 'K' }], true)).toBe(false);
    expect(isNatural([{ face: '9' }, { face: '2' }, { face: 'K' }], false)).toBe(false);

    render(<InsuranceAsk natural cost={50} canTake ev={-0.08} onDecide={() => {}} testId="t" />);
    expect(screen.getByText('¿Dinero par?')).toBeTruthy();
    // El motor dice que no conviene: «No» queda marcado como recomendado.
    expect(screen.getByRole('button', { name: 'No (recomendada)' })).toBeTruthy();
  });

  it('si no alcanzan las fichas, solo «No»', () => {
    const decide = vi.fn();
    render(<InsuranceAsk natural={false} cost={50} canTake={false} onDecide={decide} testId="t" />);
    expect(screen.getByText('¿Seguro?')).toBeTruthy();
    expect(screen.queryByTestId('t-insurance-yes')).toBeNull();
    screen.getByTestId('t-insurance-no').click();
    expect(decide).toHaveBeenCalledWith(false);
  });
});
