import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccountStore } from '@/account/accountStore';
import type { Me } from '@/account/types';
import type {
  CardView,
  RankedAccountView,
  RankedLeaderboard,
  ReviewItem,
  RoundView,
} from '@/engine/contract';
import { REVEAL_FIRST_MS, REVEAL_STEP_MS } from '@/play/round';
import { useTableStore } from '@/store/tableStore';
import { json, notFound, stubFetch } from '@/tests/server';
import { endsIn, previousSeason, seasonName } from './format';
import { useRankedStore } from './rankedStore';
import { reviewSummary } from './review';

// ---------- datos ----------

const c = (rank: CardView['rank'], suit: CardView['suit'] = 'S'): CardView => ({ rank, suit });

const account = (over: Partial<RankedAccountView> = {}): RankedAccountView => ({
  id: 'season-acc',
  season: '2026-10',
  seasonEndsAt: '2026-11-01T00:00:00Z',
  balance: 500,
  peak: 500,
  hands: 0,
  refilledTotal: 0,
  net: 0,
  maxBet: 120,
  minHands: 200,
  penetration: 0,
  ...over,
});

/** Ronda Ranked en el turno del jugador: sin `shoeCounts` (sin ayudas). */
const inPlay = (over: Partial<RoundView> = {}): RoundView => ({
  id: 'r-1',
  kind: 'ranked',
  contextId: 'season-acc',
  bet: 100,
  phase: 'player',
  player: {
    hands: [{ cards: [c('10'), c('6')], doubled: false, surrendered: false, fromSplit: false }],
    active: 0,
  },
  dealer: { up: c('9', 'H'), hole: null, hits: [] },
  allowed: { hit: true, stand: true, double: true, split: false, surrender: true },
  peekBlackjack: false,
  wallet: { balance: 400, maxBet: 100 },
  penetration: 0.02,
  ...over,
});

const review = (chosen: ReviewItem['chosen'], best: ReviewItem['best'], loss = 0): ReviewItem => ({
  handIndex: 0,
  chosen,
  best,
  evChosen: -0.5 - loss,
  evBest: -0.5,
  exact: true,
});

/** Liquidada: se plantó con 16 (la óptima era pedir) y el dealer hizo 21. */
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
    wallet: { balance: 400, maxBet: 100 },
    result: { net: -100, review: [review('stand', 'hit', 0.04)] },
    ...over,
  });

const board: RankedLeaderboard = {
  season: '2026-10',
  startsAt: '2026-10-01T00:00:00Z',
  endsAt: '2026-11-01T00:00:00Z',
  closed: false,
  minHands: 200,
  top: [],
};

const me: Me = {
  id: 'u1',
  email: 'ana@example.com',
  displayName: 'Ana',
  needsDisplayName: false,
  hasPassword: true,
  providers: [],
  createdAt: '2026-10-27T12:00:00Z',
};

const rs = () => useRankedStore.getState();
const extras = {
  'GET /ranked/leaderboard': () => json(200, board),
  'GET /me/records': () => json(200, { casual: { runs: 0 }, ranked: { seasons: [] } }),
};

beforeEach(() => {
  useAccountStore.setState({ status: 'signedIn', me, dialog: null });
  rs().reset();
  useRankedStore.setState({
    stack: [{ id: -1, value: 100 }],
    board: null,
    boardSeason: null,
    tally: { decisions: 0, optimal: 0, evLost: 0 },
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ---------- store ----------

describe('rankedStore', () => {
  it('al entrar pide la cuenta de la temporada y retoma la ronda Ranked en juego', async () => {
    stubFetch({
      'GET /ranked/me': () => json(200, account()),
      'GET /play/active': () => json(200, inPlay()),
      ...extras,
    });
    await rs().enter();
    expect(rs()).toMatchObject({ status: 'ready', elsewhere: null });
    expect(rs().round?.id).toBe('r-1');
    expect(rs().wallet).toEqual({ balance: 400, maxBet: 100 });
  });

  it('si la mano en juego es de Casual no la dibuja ni deja repartir aquí', async () => {
    const calls = stubFetch({
      'GET /ranked/me': () => json(200, account()),
      'GET /play/active': () => json(200, inPlay({ kind: 'casual', contextId: 'run-1' })),
      ...extras,
    });
    await rs().enter();
    expect(rs()).toMatchObject({ elsewhere: 'casual', round: null });
    await rs().deal();
    expect(calls.some((x) => x.key === 'POST /play/rounds')).toBe(false);
  });

  it('reparte con kind ranked y sin contextId; la revisión llega al terminar la revelación', async () => {
    vi.useFakeTimers();
    useRankedStore.setState({
      status: 'ready',
      account: account(),
      wallet: { balance: 500, maxBet: 120 },
    });
    const calls = stubFetch({
      'POST /play/rounds': () => json(201, settled()),
      'GET /ranked/me': () =>
        json(200, account({ balance: 400, hands: 1, net: -100, maxBet: 100 })),
      ...extras,
    });
    await rs().deal();
    const body = calls[0]!.body as Record<string, unknown>;
    expect(body).toMatchObject({ kind: 'ranked', bet: 100 });
    expect(body).not.toHaveProperty('contextId');

    expect(rs().tally.decisions).toBe(0);
    await vi.advanceTimersByTimeAsync(REVEAL_FIRST_MS + REVEAL_STEP_MS);
    expect(rs().revealing).toBe(false);
    // La sesión suma la revisión del servidor; la cuenta se refresca (manos y neto).
    expect(rs().tally).toMatchObject({ decisions: 1, optimal: 0 });
    expect(rs().tally.evLost).toBeCloseTo(4);
    expect(rs().account).toMatchObject({ hands: 1, net: -100 });
  });

  it('el saldo es lo último que dijo el servidor: la cuenta recargada gana a la ronda vieja', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
    const at = '2026-10-28T13:00:00Z';
    useRankedStore.setState({ status: 'ready', account: account() });
    stubFetch({
      'POST /play/rounds': () =>
        json(201, settled({ wallet: { balance: 0, maxBet: 0, refillAvailableAt: at } })),
      'GET /ranked/me': [
        () => json(200, account({ balance: 0, maxBet: 0, refillAvailableAt: at, hands: 1 })),
        // A la hora de la recarga la cuenta vuelve con 100.
        () => json(200, account({ balance: 100, maxBet: 20, hands: 1, refilledTotal: 100 })),
      ],
      ...extras,
    });
    useRankedStore.setState({ wallet: { balance: 100, maxBet: 100 } });
    await rs().deal();
    await vi.advanceTimersByTimeAsync(REVEAL_FIRST_MS + REVEAL_STEP_MS);
    expect(rs().wallet).toMatchObject({ maxBet: 0, refillAvailableAt: at });

    await vi.advanceTimersByTimeAsync(60 * 60 * 1000 + 1000);
    expect(rs().wallet).toEqual({ balance: 100, maxBet: 20 });
    expect(rs().round?.wallet.maxBet).toBe(0);
  });

  it('refill_pending avisa con la hora de la recarga', async () => {
    const at = '2026-10-29T09:30:00Z';
    useRankedStore.setState({
      status: 'ready',
      account: account(),
      wallet: { balance: 500, maxBet: 120 },
    });
    stubFetch({
      'POST /play/rounds': () => json(409, { code: 'refill_pending', message: 'Espera.' }),
      'GET /ranked/me': () => json(200, account({ balance: 5, maxBet: 0, refillAvailableAt: at })),
      ...extras,
    });
    await rs().deal();
    await vi.waitFor(() =>
      expect(useTableStore.getState().notice?.text).toMatch(
        /La recarga a 100 estará disponible el/,
      ),
    );
    expect(rs().wallet?.maxBet).toBe(0);
  });

  it('una temporada que no existe deja el ranking vacío', async () => {
    stubFetch({ 'GET /ranked/leaderboard?season=2025-01': notFound('not_found') });
    useRankedStore.setState({ board });
    await rs().loadBoard('2025-01');
    expect(rs()).toMatchObject({ board: null, boardSeason: '2025-01' });
  });
});

// ---------- presentación ----------

describe('reviewSummary', () => {
  it('sin decisiones: la mano terminó en el reparto', () => {
    expect(reviewSummary([], 100).text).toMatch(/terminó en el reparto/);
  });

  it('todas óptimas', () => {
    const s = reviewSummary([review('hit', 'hit'), review('stand', 'stand')], 50);
    expect(s).toMatchObject({ decisions: 2, optimal: 2, evLost: 0 });
    expect(s.text).toMatch(/2 de 2/);
  });

  it('cuenta el EV perdido en unidades y en fichas, aproximado si dividir lo fue', () => {
    const s = reviewSummary(
      [review('stand', 'hit', 0.1), { ...review('hit', 'hit'), exact: false }],
      50,
    );
    expect(s.optimal).toBe(1);
    expect(s.chipsLost).toBeCloseTo(5);
    // formatPct separa el % con un espacio duro (U+00A0).
    expect(s.text).toBe(
      '1 de 2 decisiones óptimas · perdiste ≈ 10,00 % de la apuesta en EV (≈ 5 fichas).',
    );
  });
});

describe('fechas de temporada', () => {
  it('nombra la temporada y la anterior', () => {
    expect(seasonName('2026-10')).toBe('octubre de 2026');
    expect(previousSeason('2026-01')).toBe('2025-12');
  });

  it('cuenta lo que falta para el cierre', () => {
    const now = Date.parse('2026-10-28T00:00:00Z');
    expect(endsIn('2026-11-01T00:00:00Z', now)).toBe('Quedan 4 días');
    expect(endsIn('2026-10-28T05:00:00Z', now)).toBe('Quedan 5 horas');
    expect(endsIn('2026-10-28T01:00:00Z', now)).toBe('Termina en menos de 2 horas');
  });
});
