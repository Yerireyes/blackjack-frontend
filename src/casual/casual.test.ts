import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccountStore } from '@/account/accountStore';
import type { Me } from '@/account/types';
import { presetRules } from '@/domain/rules';
import type { CardView, CasualRunView, RoundView } from '@/engine/contract';
import { buildCasualHandRequest } from '@/engine/requests';
import { useShoeStore } from '@/store/shoeStore';
import { useTableStore } from '@/store/tableStore';
import { json, notFound, stubFetch } from '@/tests/server';
import {
  REVEAL_FIRST_MS,
  REVEAL_PEEK_MS,
  REVEAL_STEP_MS,
  casualLocked,
  useCasualStore,
} from './casualStore';
import { revealSteps, tableModel } from '@/play/view';

// ---------- datos ----------

const c = (rank: CardView['rank'], suit: CardView['suit'] = 'S'): CardView => ({ rank, suit });
const SHOE: RoundView['shoeCounts'] = [24, 24, 24, 24, 24, 24, 24, 24, 24, 93];

const run = (over: Partial<CasualRunView> = {}): CasualRunView => ({
  id: 'run-1',
  rules: presetRules('vegas'),
  preset: 'vegas',
  status: 'active',
  balance: 500,
  peak: 500,
  hands: 0,
  maxBet: 500,
  penetration: 0.1,
  startedAt: '2026-10-28T10:00:00Z',
  ...over,
});

/** Ronda en el turno del jugador: 10+6 contra un 9 visible. */
const inPlay = (over: Partial<RoundView> = {}): RoundView => ({
  id: 'round-1',
  kind: 'casual',
  contextId: 'run-1',
  bet: 50,
  phase: 'player',
  player: {
    hands: [{ cards: [c('10'), c('6')], doubled: false, surrendered: false, fromSplit: false }],
    active: 0,
  },
  dealer: { up: c('9', 'H'), hole: null, hits: [] },
  allowed: { hit: true, stand: true, double: true, split: false, surrender: true },
  peekBlackjack: false,
  wallet: { balance: 500, maxBet: 500 },
  shoeCounts: SHOE,
  penetration: 0.12,
  ...over,
});

/** La misma ronda liquidada: el dealer revela un 7 (16) y pide un 5 (21). */
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
          net: -50,
        },
      ],
      active: 0,
    },
    dealer: { up: c('9', 'H'), hole: c('7', 'D'), hits: [c('5', 'C')] },
    allowed: { hit: false, stand: false, double: false, split: false, surrender: false },
    wallet: { balance: 450, maxBet: 450 },
    shoeCounts: undefined,
    result: { net: -50 },
    ...over,
  });

const me: Me = {
  id: 'u1',
  email: 'ana@example.com',
  displayName: 'Ana',
  needsDisplayName: false,
  hasPassword: true,
  providers: [],
  createdAt: '2026-10-27T12:00:00Z',
};

// ---------- servidor simulado ----------

const cs = () => useCasualStore.getState();
const board = { weekStart: '2026-10-26T00:00:00Z', top: [] };
const records = { casual: { runs: 1 } };
const boards = {
  'GET /casual/leaderboard/weekly': () => json(200, board),
  'GET /me/records': () => json(200, records),
};

beforeEach(() => {
  useAccountStore.setState({ status: 'signedIn', me, dialog: null });
  cs().reset();
  useCasualStore.setState({ stack: [{ id: -1, value: 50 }], ended: null, board: null });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ---------- modelo de la mesa ----------

describe('tableModel', () => {
  it('en el turno del jugador la oculta va boca abajo y no hay resultados', () => {
    const m = tableModel(inPlay(), 0);
    expect(m.holeHidden).toBe(true);
    expect(m.dealer.map((x) => x.id)).toEqual(['round-1-up', 'round-1-hole']);
    expect(m.hands[0]!.outcome).toBeNull();
    expect(m.resultShown).toBe(false);
  });

  it('al liquidar revela la oculta, después cada carta y al final el resultado', () => {
    const r = settled();
    expect(revealSteps(r)).toBe(2);
    const step0 = tableModel(r, 0);
    expect(step0.holeHidden).toBe(true);
    expect(step0.dealer).toHaveLength(2);
    const step1 = tableModel(r, 1);
    expect(step1.holeHidden).toBe(false);
    expect(step1.dealer.map((x) => x.face)).toEqual(['9', '7']);
    expect(step1.hands[0]!.outcome).toBeNull();
    const step2 = tableModel(r, 2);
    expect(step2.dealer.map((x) => x.face)).toEqual(['9', '7', '5']);
    expect(step2.hands[0]).toMatchObject({ outcome: 'lose', net: -50 });
    expect(step2.resultShown).toBe(true);
  });

  it('la oculta conserva su id al voltearse (se anima en su lugar)', () => {
    expect(tableModel(inPlay(), 0).dealer[1]!.id).toBe(tableModel(settled(), 2).dealer[1]!.id);
  });
});

// ---------- pedido al motor ----------

describe('buildCasualHandRequest', () => {
  const rules = presetRules('vegas');

  it('usa shoeCounts y el allowed del servidor', () => {
    const b = buildCasualHandRequest(7, rules, inPlay());
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.req).toMatchObject({
      version: 7,
      shoe: SHOE,
      hand: [9, 5],
      dealerUp: 8,
      splitHandsSoFar: 0,
      isSplitAces: false,
      allowed: { double: true, split: false, surrender: true },
    });
  });

  it('marca ases divididos y no pide nada con la ronda liquidada', () => {
    const split = inPlay({
      player: {
        hands: [
          { cards: [c('A'), c('5')], doubled: false, surrendered: false, fromSplit: true },
          { cards: [c('A', 'H')], doubled: false, surrendered: false, fromSplit: true },
        ],
        active: 0,
      },
    });
    const b = buildCasualHandRequest(1, rules, split);
    expect(b.ok && b.req.isSplitAces).toBe(true);
    expect(b.ok && b.req.splitHandsSoFar).toBe(1);
    expect(buildCasualHandRequest(1, rules, settled()).ok).toBe(false);
  });
});

// ---------- store ----------

describe('casualStore', () => {
  it('al entrar retoma la ronda en juego tal cual', async () => {
    stubFetch({
      'GET /casual/runs/active': () => json(200, run()),
      'GET /play/active': () => json(200, inPlay()),
      ...boards,
    });
    await cs().enter();
    expect(cs().status).toBe('playing');
    expect(cs().round?.id).toBe('round-1');
    expect(casualLocked(cs())).toBe(true);
  });

  it('si la mano en juego es de Ranked no la dibuja ni deja repartir aquí', async () => {
    const calls = stubFetch({
      'GET /casual/runs/active': () => json(200, run()),
      'GET /play/active': () => json(200, inPlay({ kind: 'ranked', contextId: 'season-1' })),
      ...boards,
    });
    await cs().enter();
    expect(cs()).toMatchObject({ status: 'playing', elsewhere: 'ranked', round: null });
    await cs().deal();
    expect(calls.some((c) => c.key === 'POST /play/rounds')).toBe(false);
  });

  it('sin partida ofrece crear una', async () => {
    stubFetch({
      'GET /casual/runs/active': notFound('no_active_run'),
      'GET /play/active': notFound('no_active_round'),
      ...boards,
    });
    await cs().enter();
    expect(cs().status).toBe('noRun');
  });

  it('con el nombre provisional pide elegirlo antes de crear la partida', async () => {
    useAccountStore.setState({ me: { ...me, needsDisplayName: true } });
    const calls = stubFetch({});
    await cs().createRun('vegas');
    expect(calls).toHaveLength(0);
    expect(useAccountStore.getState().dialog).toBe('name');
  });

  it('display_name_required del servidor también abre el diálogo del nombre', async () => {
    stubFetch({
      'POST /casual/runs': () => json(409, { code: 'display_name_required', message: 'Nombre.' }),
    });
    await cs().createRun('europe');
    expect(useAccountStore.getState().dialog).toBe('name');
    expect(useTableStore.getState().notice?.text).toMatch(/Elige tu nombre/);
  });

  it('reparte con la pila, una clave por intención, y anima la liquidación', async () => {
    vi.useFakeTimers();
    useCasualStore.setState({ status: 'playing', run: run() });
    const calls = stubFetch({
      'POST /play/rounds': () => json(201, settled()),
      'GET /casual/runs/active': () => json(200, run({ balance: 450, hands: 1 })),
      ...boards,
    });
    const v0 = useShoeStore.getState().version;
    await cs().deal();
    const body = calls[0]!.body as Record<string, unknown>;
    expect(body).toMatchObject({ kind: 'casual', contextId: 'run-1', bet: 50 });
    expect(body.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(useShoeStore.getState().version).toBeGreaterThan(v0);

    expect(cs()).toMatchObject({ shown: 0, revealing: true });
    await vi.advanceTimersByTimeAsync(REVEAL_FIRST_MS);
    expect(cs().shown).toBe(1);
    await vi.advanceTimersByTimeAsync(REVEAL_STEP_MS);
    expect(cs()).toMatchObject({ shown: 2, revealing: false });
    // Tras liquidar se refresca la partida (saldo, pico, manos).
    expect(cs().run?.hands).toBe(1);
  });

  it('con peek la pausa antes de revelar es más larga', async () => {
    vi.useFakeTimers();
    useCasualStore.setState({ status: 'playing', run: run() });
    stubFetch({
      'POST /play/rounds': () => json(201, settled({ peekBlackjack: true })),
      'GET /casual/runs/active': () => json(200, run()),
      ...boards,
    });
    await cs().deal();
    await vi.advanceTimersByTimeAsync(REVEAL_FIRST_MS);
    expect(cs().shown).toBe(0);
    await vi.advanceTimersByTimeAsync(REVEAL_PEEK_MS - REVEAL_FIRST_MS);
    expect(cs().shown).toBe(1);
  });

  it('sin respuesta (red) reintenta una vez con la misma clave', async () => {
    vi.useFakeTimers();
    useCasualStore.setState({ status: 'playing', run: run() });
    const calls = stubFetch({
      'POST /play/rounds': [
        () => {
          throw new TypeError('sin red');
        },
        () => json(201, inPlay()),
      ],
    });
    const done = cs().deal();
    await vi.advanceTimersByTimeAsync(1000);
    await done;
    const keys = calls
      .filter((x) => x.key === 'POST /play/rounds')
      .map((x) => (x.body as { idempotencyKey: string }).idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(cs().round?.phase).toBe('player');
  });

  it('una acción no permitida por el servidor no se manda', async () => {
    useCasualStore.setState({ status: 'playing', run: run(), round: inPlay() });
    const calls = stubFetch({});
    await cs().act('split');
    expect(calls).toHaveLength(0);
  });

  it('action_not_allowed recarga el estado del servidor', async () => {
    useCasualStore.setState({ status: 'playing', run: run(), round: inPlay() });
    const calls = stubFetch({
      'POST /play/rounds/round-1/actions': () =>
        json(409, { code: 'action_not_allowed', message: 'No.' }),
      'GET /casual/runs/active': () => json(200, run()),
      'GET /play/active': () => json(200, inPlay({ id: 'round-1' })),
      ...boards,
    });
    await cs().act('hit');
    await vi.waitFor(() => expect(calls.some((x) => x.key === 'GET /play/active')).toBe(true));
  });

  it('sin fichas al liquidar la partida termina (busted)', async () => {
    useCasualStore.setState({ status: 'playing', run: run({ balance: 50 }) });
    stubFetch({
      'POST /play/rounds': () =>
        json(
          201,
          settled({
            wallet: { balance: 0, maxBet: 0 },
            dealer: { up: c('9'), hole: null, hits: [] },
          }),
        ),
      'GET /casual/runs/active': notFound('no_active_run'),
      ...boards,
    });
    await cs().deal();
    await vi.waitFor(() => expect(cs().status).toBe('noRun'));
    expect(cs().ended).toMatchObject({ status: 'busted', balance: 0 });
  });

  it('un 401 cierra la sesión y limpia Casual', async () => {
    useCasualStore.setState({ status: 'playing', run: run() });
    stubFetch({
      'POST /play/rounds': () => json(401, { code: 'unauthorized', message: 'Sesión.' }),
    });
    await cs().deal();
    expect(useAccountStore.getState().status).toBe('anonymous');
    expect(cs().status).toBe('idle');
  });

  it('las fichas respetan el tope del servidor y no se tocan con la ronda en juego', () => {
    useCasualStore.setState({ status: 'playing', run: run({ maxBet: 60 }), stack: [] });
    expect(cs().addChip(50)).not.toBeNull();
    expect(cs().addChip(50)).toBeNull();
    expect(cs().addChip(10)).not.toBeNull();
    useCasualStore.setState({ round: inPlay() });
    cs().removeChip();
    expect(cs().stack).toHaveLength(2);
  });

  it('retirarse cierra la partida y guarda el resumen', async () => {
    useCasualStore.setState({ status: 'playing', run: run() });
    stubFetch({
      'POST /casual/runs/run-1/retire': () => json(200, run({ status: 'retired', balance: 620 })),
      ...boards,
    });
    await cs().retire();
    expect(cs()).toMatchObject({ status: 'noRun', run: null });
    expect(cs().ended).toMatchObject({ status: 'retired', balance: 620 });
  });
});
