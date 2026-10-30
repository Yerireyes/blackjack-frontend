import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccountStore } from '@/account/accountStore';
import type { Me } from '@/account/types';
import type { CardView, DailyAttemptView, DailyLeaderboard, RoundView } from '@/engine/contract';
import { REVEAL_FIRST_MS, REVEAL_STEP_MS } from '@/play/round';
import { useTableStore } from '@/store/tableStore';
import { json, notFound, stubFetch } from '@/tests/server';
import { useDailyStore } from './dailyStore';
import { dayName, msToNextDay, nextDayIn, previousDay } from './format';

// ---------- datos ----------

const c = (rank: CardView['rank'], suit: CardView['suit'] = 'S'): CardView => ({ rank, suit });

const attempt = (over: Partial<DailyAttemptView> = {}): DailyAttemptView => ({
  id: 'att-1',
  day: '2026-10-29',
  status: 'active',
  balance: 500,
  peak: 500,
  hands: 0,
  handsTotal: 30,
  maxBet: 500,
  penetration: 0,
  startedAt: '2026-10-29T10:00:00Z',
  ...over,
});

/** Ronda del reto en el turno del jugador: sin `shoeCounts` (sin ayudas). */
const inPlay = (over: Partial<RoundView> = {}): RoundView => ({
  id: 'd-1',
  kind: 'daily',
  contextId: 'att-1',
  bet: 100,
  phase: 'player',
  player: {
    hands: [{ cards: [c('10'), c('6')], doubled: false, surrendered: false, fromSplit: false }],
    active: 0,
  },
  dealer: { up: c('9', 'H'), hole: null, hits: [] },
  allowed: { hit: true, stand: true, double: true, split: false, surrender: true },
  peekBlackjack: false,
  wallet: { balance: 400, maxBet: 400 },
  penetration: 0.02,
  ...over,
});

const settled = (over: Partial<RoundView> = {}): RoundView =>
  inPlay({
    phase: 'settled',
    player: {
      hands: [
        {
          cards: [c('10'), c('6')],
          doubled: false,
          surrendered: false,
          fromSplit: false,
          outcome: 'lose',
          net: -100,
        },
      ],
      active: 0,
    },
    dealer: { up: c('9', 'H'), hole: c('7', 'D'), hits: [c('5', 'C')] },
    allowed: { hit: false, stand: false, double: false, split: false, surrender: false },
    result: {
      net: -100,
      review: [
        { handIndex: 0, chosen: 'stand', best: 'hit', evChosen: -0.54, evBest: -0.5, exact: true },
      ],
    },
    ...over,
  });

const board: DailyLeaderboard = { day: '2026-10-29', top: [] };

const me: Me = {
  id: 'u1',
  email: 'ana@example.com',
  displayName: 'Ana',
  needsDisplayName: false,
  hasPassword: true,
  providers: [],
  createdAt: '2026-10-27T12:00:00Z',
};

const ds = () => useDailyStore.getState();
const extras = {
  'GET /daily/leaderboard': () => json(200, board),
  'GET /me/records': () =>
    json(200, { casual: { runs: 0 }, ranked: { seasons: [] }, daily: { finished: 0 } }),
};

beforeEach(() => {
  useAccountStore.setState({ status: 'signedIn', me, dialog: null });
  ds().reset();
  useDailyStore.setState({
    stack: [{ id: -1, value: 100 }],
    board: null,
    boardDay: null,
    tally: { decisions: 0, optimal: 0, evLost: 0 },
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ---------- store ----------

describe('dailyStore', () => {
  it('sin intento hoy ofrece empezar; tras empezar no se puede volver a empezar', async () => {
    const calls = stubFetch({
      'GET /daily/me': notFound('no_daily_attempt'),
      'GET /play/active': notFound('no_active_round'),
      'POST /daily/attempts': () => json(201, attempt()),
      ...extras,
    });
    await ds().enter();
    expect(ds()).toMatchObject({ status: 'none', attempt: null });
    // «Hoy» lo dice el servidor (el ranking sin `day`), no el reloj local.
    await vi.waitFor(() => expect(ds().today).toBe('2026-10-29'));

    await ds().start();
    expect(ds()).toMatchObject({ status: 'active', wallet: { balance: 500, maxBet: 500 } });
    await ds().start();
    expect(calls.filter((x) => x.key === 'POST /daily/attempts')).toHaveLength(1);
  });

  it('retoma la ronda del reto en juego; si es de otro modo, no deja repartir aquí', async () => {
    stubFetch({
      'GET /daily/me': () => json(200, attempt({ hands: 3 })),
      'GET /play/active': () => json(200, inPlay()),
      ...extras,
    });
    await ds().enter();
    expect(ds()).toMatchObject({ status: 'active', elsewhere: null });
    expect(ds().round?.id).toBe('d-1');

    const calls = stubFetch({
      'GET /daily/me': () => json(200, attempt()),
      'GET /play/active': () => json(200, inPlay({ kind: 'ranked', contextId: 'season-acc' })),
      ...extras,
    });
    await ds().enter();
    expect(ds()).toMatchObject({ elsewhere: 'ranked', round: null });
    await ds().deal();
    expect(calls.some((x) => x.key === 'POST /play/rounds')).toBe(false);
  });

  it('reparte con kind daily y sin contextId; tras liquidar refresca las manos', async () => {
    vi.useFakeTimers();
    useDailyStore.setState({
      status: 'active',
      attempt: attempt(),
      wallet: { balance: 500, maxBet: 500 },
    });
    const calls = stubFetch({
      'POST /play/rounds': () => json(201, settled()),
      'GET /daily/me': () => json(200, attempt({ hands: 1, balance: 400, maxBet: 400 })),
      ...extras,
    });
    await ds().deal();
    const body = calls[0]!.body as Record<string, unknown>;
    expect(body).toMatchObject({ kind: 'daily', bet: 100 });
    expect(body).not.toHaveProperty('contextId');

    await vi.advanceTimersByTimeAsync(REVEAL_FIRST_MS + REVEAL_STEP_MS);
    expect(ds().attempt?.hands).toBe(1);
    expect(ds().tally).toMatchObject({ decisions: 1, optimal: 0 });
  });

  it('con maxBet 0 en la ronda liquidada el reto terminó y la última mano sigue a la vista', async () => {
    vi.useFakeTimers();
    useDailyStore.setState({
      status: 'active',
      attempt: attempt({ hands: 29 }),
      wallet: { balance: 500, maxBet: 500 },
    });
    stubFetch({
      'POST /play/rounds': () => json(201, settled({ wallet: { balance: 400, maxBet: 0 } })),
      'GET /daily/me': () =>
        json(200, attempt({ status: 'finished', hands: 30, balance: 400, maxBet: 0 })),
      ...extras,
    });
    await ds().deal();
    await vi.advanceTimersByTimeAsync(REVEAL_FIRST_MS + REVEAL_STEP_MS);
    expect(ds().status).toBe('finished');
    expect(ds().round?.id).toBe('d-1');
    expect(useTableStore.getState().notice?.text).toMatch(/Terminaste el reto de hoy/);
  });

  it('daily_taken avisa y recarga el intento (ya terminado)', async () => {
    stubFetch({
      'POST /daily/attempts': () => json(409, { code: 'daily_taken', message: 'Ya.' }),
      'GET /daily/me': () => json(200, attempt({ status: 'finished', hands: 30, maxBet: 0 })),
      'GET /play/active': notFound('no_active_round'),
      ...extras,
    });
    await ds().start();
    await vi.waitFor(() => expect(ds().status).toBe('finished'));
    expect(useTableStore.getState().notice?.text).toMatch(/Ya jugaste el reto de hoy/);
  });

  it('el ranking de otro día se pide con ?day', async () => {
    const calls = stubFetch({
      'GET /daily/leaderboard?day=2026-10-28': () => json(200, { ...board, day: '2026-10-28' }),
    });
    await ds().loadBoard('2026-10-28');
    expect(calls[0]!.key).toBe('GET /daily/leaderboard?day=2026-10-28');
    expect(ds().board?.day).toBe('2026-10-28');
  });
});

// ---------- fechas ----------

describe('fechas del reto', () => {
  it('nombra el día en UTC y calcula el anterior', () => {
    expect(dayName('2026-10-29')).toBe('jueves, 29 de octubre');
    expect(previousDay('2026-11-01')).toBe('2026-10-31');
  });

  it('cuenta lo que falta hasta las 00:00 UTC', () => {
    const now = Date.parse('2026-10-29T18:40:00Z');
    expect(msToNextDay(now)).toBe((5 * 60 + 20) * 60_000);
    expect(nextDayIn(now)).toBe('Nuevo reto en 5 h 20 min');
  });
});
