// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccountStore } from '@/account/accountStore';
import type { Me } from '@/account/types';
import { hashOf, routeFromHash } from '@/app/route';
import { presetRules } from '@/domain/rules';
import type { RoomState, ServerMessage, TableRoundView } from '@/engine/contract';
import { buildCasualHandRequest } from '@/engine/requests';
import { newChip } from '@/store/chipsStore';
import { useTableStore } from '@/store/tableStore';
import { useUiStore } from '@/store/uiStore';
import { json, notFound, stubFetch } from '@/tests/server';
import { normalizeCode } from './api';
import { maxBetOf, mySeatOf, myTurnOf, REVEAL_STEP_MS, useRoomsStore } from './roomsStore';
import { dealerModel, myTurnAsRound, revealStepsOf } from './view';

// ---------- WebSocket simulado ----------

class FakeSocket {
  static OPEN = 1;
  static all: FakeSocket[] = [];
  readyState = 0;
  sent: unknown[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(readonly url: string) {
    FakeSocket.all.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(msg: ServerMessage) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
  drop() {
    this.readyState = 3;
    this.onclose?.();
  }
}
const last = () => FakeSocket.all[FakeSocket.all.length - 1]!;

// ---------- datos ----------

const me: Me = {
  id: 'u1',
  email: 'ana@example.com',
  displayName: 'Ana',
  needsDisplayName: false,
  hasPassword: true,
  providers: [],
  createdAt: '2026-10-27T12:00:00Z',
};

const info = {
  code: 'K7Q2XP',
  name: 'Mesa de Ana',
  visibility: 'public' as const,
  host: 'Ana',
  seats: 5,
  seated: 2,
  spectators: 0,
  maxSpectators: 10,
  rules: presetRules('vegas'),
  preset: 'vegas' as const,
  aids: true,
  createdAt: '2026-10-30T10:00:00Z',
};

const c = (rank: '2' | '5' | '9' | '10' | 'K' | 'A', suit: 'S' | 'H' = 'S') => ({ rank, suit });

const round = (over: Partial<TableRoundView> = {}): TableRoundView => ({
  phase: 'player',
  seats: [
    {
      seat: 1,
      bet: 50,
      hands: [{ cards: [c('10'), c('5')], doubled: false, surrendered: false, fromSplit: false }],
      active: 0,
      done: false,
    },
    {
      seat: 3,
      bet: 20,
      hands: [
        { cards: [c('9'), c('9', 'H')], doubled: false, surrendered: false, fromSplit: false },
      ],
      active: 0,
      done: false,
    },
  ],
  dealer: { up: c('K', 'H'), hole: null, hits: [] },
  turn: 1,
  allowed: { hit: true, stand: true, double: true, split: false, surrender: true },
  peekBlackjack: false,
  ...over,
});

const state = (over: Partial<RoomState> = {}): RoomState => ({
  info,
  hostId: 'p-ana',
  seats: [
    { seat: 1, player: { id: 'p-ana', displayName: 'Ana' }, stack: 450, connected: true },
    { seat: 2, stack: 0, connected: false },
    {
      seat: 3,
      player: { id: 'p-beto', displayName: 'Beto', title: 'titleRookie' },
      stack: 480,
      connected: true,
    },
    { seat: 4, stack: 0, connected: false },
    { seat: 5, stack: 0, connected: false },
  ],
  spectators: [],
  phase: 'playing',
  timerMs: 20_000,
  round: round(),
  shoeCounts: [24, 24, 24, 24, 24, 24, 24, 24, 24, 92],
  penetration: 0.05,
  leaderboard: [],
  ...over,
});

const rs = () => useRoomsStore.getState();

/** Conectado a la sala, con `welcome` y un primer `state`. */
function enter(first: RoomState = state()) {
  rs().join('K7Q2XP');
  last().open();
  last().receive({ type: 'welcome', playerId: 'p-ana' });
  last().receive({ type: 'state', room: first });
}

beforeEach(() => {
  FakeSocket.all = [];
  vi.stubGlobal('WebSocket', FakeSocket);
  useAccountStore.setState({ status: 'signedIn', me, dialog: null });
  useUiStore.setState({ screen: 'rooms', roomCode: 'K7Q2XP' });
  rs().leave();
  useRoomsStore.setState({ stack: [newChip(10)] });
});
afterEach(() => {
  rs().leave();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ---------- direcciones ----------

describe('direcciones de las salas', () => {
  it('el lobby y cada sala tienen la suya; el código no distingue mayúsculas', () => {
    expect(routeFromHash('#/salas')).toEqual({ screen: 'rooms', roomCode: null });
    expect(routeFromHash('#/salas/k7q2xp')).toEqual({ screen: 'rooms', roomCode: 'K7Q2XP' });
    expect(hashOf({ screen: 'rooms', roomCode: 'K7Q2XP' })).toBe('#/salas/K7Q2XP');
    expect(hashOf({ screen: 'casual', roomCode: 'K7Q2XP' })).toBe('#/casual');
    expect(normalizeCode(' k7q-2xp ')).toBe('K7Q2XP');
  });
});

// ---------- mesa ----------

describe('sala en tiempo real', () => {
  it('conecta al WebSocket de la sala y reemplaza el estado con cada `state`', () => {
    enter();
    expect(last().url).toMatch(/\/api\/v1\/rooms\/K7Q2XP\/ws$/);
    expect(rs()).toMatchObject({ conn: 'open', me: 'p-ana' });
    expect(mySeatOf(rs())?.seat).toBe(1);
    expect(myTurnOf(rs())).toBe(true);

    last().receive({ type: 'state', room: state({ round: round({ turn: 3 }) }) });
    expect(myTurnOf(rs())).toBe(false);
    expect(rs().room?.round?.turn).toBe(3);
  });

  it('solo manda acciones en mi turno y permitidas por el servidor', () => {
    enter();
    rs().act('split');
    rs().act('hit');
    expect(last().sent).toEqual([{ type: 'action', action: 'hit' }]);

    last().receive({ type: 'state', room: state({ round: round({ turn: 3 }) }) });
    rs().act('stand');
    expect(last().sent).toHaveLength(1);
  });

  it('apuesta lo de la pila de fichas, sin pasar de mi pila', () => {
    enter(state({ phase: 'betting', round: undefined }));
    rs().addChip(100);
    rs().bet();
    expect(last().sent).toEqual([{ type: 'bet', amount: 110 }]);

    // Con 30 fichas en la pila, el tope es 30 y las fichas de más se quitan solas.
    useRoomsStore.setState({ stack: [newChip(100)] });
    last().receive({
      type: 'state',
      room: state({
        phase: 'betting',
        round: undefined,
        seats: state().seats.map((s) => (s.seat === 1 ? { ...s, stack: 30 } : s)),
      }),
    });
    expect(maxBetOf(rs())).toBe(30);
    expect(rs().stack).toHaveLength(0);
  });

  it('quien entra mirando y se sienta empieza con una ficha de 10 lista para apostar', () => {
    const spectating = state({
      phase: 'betting',
      round: undefined,
      seats: state().seats.map((s) => (s.seat === 1 ? { seat: 1, stack: 0, connected: false } : s)),
    });
    enter(spectating);
    expect(rs().stack).toHaveLength(1);
    useRoomsStore.setState({ stack: [] });
    last().receive({ type: 'state', room: state({ phase: 'betting', round: undefined }) });
    expect(rs().stack.map((c) => c.value)).toEqual([10]);
  });

  it('al pasar a resultados anima la oculta y las cartas del dealer en orden', () => {
    vi.useFakeTimers();
    enter();
    const settled = round({
      phase: 'settled',
      turn: undefined,
      dealer: { up: c('K', 'H'), hole: c('5'), hits: [c('2'), c('A')] },
    });
    last().receive({
      type: 'state',
      room: state({ phase: 'results', timerMs: 5000, round: settled }),
    });
    expect(revealStepsOf(settled)).toBe(3);
    expect(rs().shown).toBe(0);
    expect(dealerModel(settled, rs().roundNo, 0).holeHidden).toBe(true);
    vi.advanceTimersByTime(500 + REVEAL_STEP_MS * 2);
    expect(rs().shown).toBe(3);
    expect(dealerModel(settled, rs().roundNo, 3).cards).toHaveLength(4);
  });

  it('`closed` vuelve al lobby con el aviso; `error` avisa sin cortar', () => {
    enter();
    last().receive({ type: 'error', code: 'seat_taken', message: 'x' });
    expect(useTableStore.getState().notice?.text).toBe('Ese asiento ya está ocupado.');
    expect(rs().conn).toBe('open');

    last().receive({ type: 'closed', reason: 'kicked' });
    expect(useTableStore.getState().notice?.text).toMatch(/te sacó de la sala/);
    expect(useUiStore.getState().roomCode).toBeNull();
    expect(rs()).toMatchObject({ conn: 'idle', room: null });
  });

  it('si se corta sin `closed`, reconecta con espera creciente', async () => {
    vi.useFakeTimers();
    enter();
    last().drop();
    expect(rs().conn).toBe('reconnecting');
    expect(FakeSocket.all).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeSocket.all).toHaveLength(2);
    last().open();
    expect(rs().conn).toBe('open');
  });

  it('si no se puede entrar y la sala no existe, vuelve al lobby', async () => {
    stubFetch({ 'GET /rooms/K7Q2XP': notFound('room_not_found') });
    rs().join('K7Q2XP');
    last().drop();
    await vi.waitFor(() => expect(useUiStore.getState().roomCode).toBeNull());
    expect(useTableStore.getState().notice?.text).toMatch(/no existe o ya cerró/);
  });

  it('si la sala existe pero no deja entrar, lo dice y ofrece reintentar', async () => {
    stubFetch({ 'GET /rooms/K7Q2XP': () => json(200, info) });
    rs().join('K7Q2XP');
    last().drop();
    await vi.waitFor(() => expect(rs().conn).toBe('failed'));
    expect(rs().failure).toMatch(/No se pudo entrar/);
  });
});

// ---------- ayudas ----------

describe('ayudas en la sala', () => {
  it('con ayudas, en mi turno, el motor recibe mi mano y el zapato de la sala', () => {
    const turn = myTurnAsRound(state(), 1)!;
    const built = buildCasualHandRequest(1, info.rules, turn);
    expect(built.ok && built.req.hand).toEqual([9, 4]);
    expect(built.ok && built.req.shoe[9]).toBe(92);
  });

  it('sin `shoeCounts` (sala sin ayudas) o fuera de mi turno, nada', () => {
    expect(myTurnAsRound(state({ shoeCounts: undefined }), 1)).toBeNull();
    expect(myTurnAsRound(state(), 3)).toBeNull();
  });
});
