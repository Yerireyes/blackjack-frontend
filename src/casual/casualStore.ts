// Casual: el servidor baraja, reparte, valida, juega el dealer y liquida. Este store solo
// guarda la última respuesta (RoundView / CasualRunView), la pila de fichas que el usuario
// arma para la próxima apuesta y el paso de la animación de liquidación. Nunca calcula
// cartas, resultados ni saldo.
import { create } from 'zustand';
import { useAccountStore } from '@/account/accountStore';
import { errorText } from '@/account/errors';
import { ApiRequestError } from '@/api/http';
import type {
  Action,
  CasualRunView,
  MyRecords,
  Preset,
  RoundView,
  WeeklyLeaderboard,
} from '@/engine/contract';
import {
  canAddChip,
  MIN_BET,
  newChip,
  stackTotal,
  type Chip,
  type ChipValue,
} from '@/store/chipsStore';
import { useShoeStore } from '@/store/shoeStore';
import { useTableStore } from '@/store/tableStore';
import { casualApi } from './api';
import { revealSteps } from './view';

/**
 * - `idle`: no se entró al modo (o no hay sesión).
 * - `loading`: pidiendo la partida y la ronda activas.
 * - `noRun`: sin partida activa: se ofrece crear una.
 * - `playing`: hay partida (y quizá una ronda en juego).
 * - `unavailable`: el servidor no respondió.
 */
export type CasualStatus = 'idle' | 'loading' | 'noRun' | 'playing' | 'unavailable';

export interface CasualState {
  status: CasualStatus;
  run: CasualRunView | null;
  /** Última ronda tal como la mandó el servidor: se reemplaza entera, nunca se edita. */
  round: RoundView | null;
  /** Pasos de la revelación del dealer ya mostrados (ver revealSteps). */
  shown: number;
  revealing: boolean;
  /** Hay una petición en vuelo: no se manda otra intención. */
  busy: boolean;
  /** Pila de la próxima apuesta (solo interfaz; el saldo es del servidor). */
  stack: Chip[];
  /** Resumen de la última partida terminada (retirada o sin fichas). */
  ended: CasualRunView | null;
  board: WeeklyLeaderboard | null;
  records: MyRecords | null;
  enter(): Promise<void>;
  reset(): void;
  createRun(preset: Preset): Promise<void>;
  deal(): Promise<void>;
  act(action: Action): Promise<void>;
  retire(): Promise<void>;
  loadBoards(): Promise<void>;
  addChip(value: ChipValue): number | null;
  removeChip(): void;
  clearStack(): void;
}

/** Pausas de la revelación al liquidar (en ms). Con peek, más larga: se ve el reparto. */
export const REVEAL_FIRST_MS = 700;
export const REVEAL_PEEK_MS = 1600;
export const REVEAL_STEP_MS = 600;
const RETRY_MS = 800;

const MESSAGES: Record<string, string> = {
  display_name_required: 'Elige tu nombre antes de jugar: aparece en el ranking.',
  bet_out_of_range: 'La apuesta debe ser de 10 a 500, en múltiplos de 10.',
  insufficient_funds: 'No te alcanza el saldo para esa apuesta.',
  run_finished: 'La partida terminó.',
  no_active_run: 'La partida terminó.',
};

const notify = (text: string, tone: 'info' | 'error' = 'info') =>
  useTableStore.getState().notify(text, tone);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Una intención (este reparto, esta acción) = una clave de idempotencia. Solo se reutiliza
 * para reintentar la misma petición si no hubo respuesta (red): el servidor devuelve la
 * misma respuesta sin cobrar dos veces.
 */
async function withIdempotency<T>(call: (key: string) => Promise<T>): Promise<T> {
  const key = crypto.randomUUID();
  try {
    return await call(key);
  } catch (e) {
    if (!(e instanceof ApiRequestError && e.status === 0)) throw e;
    await sleep(RETRY_MS);
    return call(key);
  }
}

const isNotFound = (e: unknown) => e instanceof ApiRequestError && e.status === 404;

/** Saldo y tope de la próxima apuesta: lo último que dijo el servidor. */
export function casualWallet(s: Pick<CasualState, 'round' | 'run'>) {
  if (s.round && s.round.contextId === s.run?.id) return s.round.wallet;
  if (s.run) return { balance: s.run.balance, maxBet: s.run.maxBet };
  return null;
}

/** La ronda está en juego o animándose: la apuesta no se toca y no se reparte otra. */
export const casualLocked = (s: Pick<CasualState, 'round' | 'busy' | 'revealing'>) =>
  s.busy || s.revealing || s.round?.phase === 'player';

let revealTimer: ReturnType<typeof setTimeout> | null = null;
const stopReveal = () => {
  if (revealTimer) clearTimeout(revealTimer);
  revealTimer = null;
};

export const useCasualStore = create<CasualState>()((set, get) => {
  /** Reemplaza la ronda con la respuesta del servidor; si se liquidó, anima la revelación. */
  const applyRound = (round: RoundView, animate: boolean) => {
    stopReveal();
    const steps = revealSteps(round);
    set({ round, shown: animate ? 0 : steps, revealing: animate && steps > 0 });
    // Cambiaron las cartas: el análisis viejo deja de ser actual.
    useShoeStore.getState().bump();
    if (round.phase !== 'settled') return;
    if (!animate || steps === 0) {
      void afterSettle();
      return;
    }
    const step = () => {
      const shown = get().shown + 1;
      const done = shown >= steps;
      set({ shown, revealing: !done });
      if (done) void afterSettle();
      else revealTimer = setTimeout(step, REVEAL_STEP_MS);
    };
    revealTimer = setTimeout(step, round.peekBlackjack ? REVEAL_PEEK_MS : REVEAL_FIRST_MS);
  };

  /** Tras liquidar: saldo, pico y manos de la partida; si se quedó sin fichas, terminó. */
  const afterSettle = async () => {
    const before = get().run;
    try {
      const run = await casualApi.activeRun();
      set({ run });
      fitStack();
    } catch (e) {
      if (!isNotFound(e)) return fail(e);
      const balance = get().round?.wallet.balance ?? before?.balance ?? 0;
      set({
        status: 'noRun',
        run: null,
        round: null,
        ended: before ? { ...before, balance, status: 'busted' } : null,
      });
      notify('Te quedaste sin fichas: la partida terminó.');
    }
    void get().loadBoards();
  };

  /** Quita fichas de arriba si la pila ya no entra en el tope de la próxima apuesta. */
  const fitStack = () => {
    const max = casualWallet(get())?.maxBet ?? 0;
    const stack = get().stack.slice();
    while (stack.length > 0 && stackTotal(stack) > max) stack.pop();
    if (stack.length !== get().stack.length) set({ stack });
  };

  const askName = () => {
    useAccountStore.getState().openDialog('name');
    notify(MESSAGES.display_name_required!, 'error');
  };

  /** Errores de las acciones de juego, según la sección 7 de la guía del backend. */
  const fail = (e: unknown) => {
    if (!(e instanceof ApiRequestError)) {
      notify('Algo salió mal. Inténtalo de nuevo.', 'error');
      return;
    }
    if (e.status === 401) {
      useAccountStore.getState().sessionLost();
      get().reset();
      return;
    }
    switch (e.code) {
      case 'display_name_required':
        askName();
        return;
      // El estado local quedó desfasado: se recarga lo que dice el servidor.
      case 'run_active':
      case 'round_active':
      case 'action_not_allowed':
      case 'no_active_round':
        void get().enter();
        return;
      case 'run_finished':
      case 'no_active_run':
      case 'insufficient_funds':
        notify(MESSAGES[e.code]!, 'error');
        void get().enter();
        return;
      case 'bet_out_of_range':
        notify(MESSAGES[e.code]!, 'error');
        return;
      default:
        notify(errorText(e), 'error');
    }
  };

  /** Una intención a la vez: mientras hay una en vuelo, las demás se ignoran. */
  const intent = async (call: () => Promise<void>) => {
    if (get().busy) return;
    set({ busy: true });
    try {
      await call();
    } catch (e) {
      fail(e);
    } finally {
      set({ busy: false });
    }
  };

  return {
    status: 'idle',
    run: null,
    round: null,
    shown: 0,
    revealing: false,
    busy: false,
    stack: [newChip(10)],
    ended: null,
    board: null,
    records: null,

    async enter() {
      stopReveal();
      set({ status: 'loading', revealing: false });
      const [run, round] = await Promise.allSettled([
        casualApi.activeRun(),
        casualApi.activeRound(),
      ]);
      const lost = [run, round].find((r) => r.status === 'rejected' && !isNotFound(r.reason)) as
        PromiseRejectedResult | undefined;
      if (lost) {
        if (lost.reason instanceof ApiRequestError && lost.reason.status === 401) {
          fail(lost.reason);
        } else {
          set({ status: 'unavailable' });
        }
        return;
      }
      const activeRun = run.status === 'fulfilled' ? run.value : null;
      set({ run: activeRun, status: activeRun ? 'playing' : 'noRun', round: null, shown: 0 });
      // Retomar: una ronda a medio jugar (recarga o desconexión) sigue desde ahí.
      if (round.status === 'fulfilled') applyRound(round.value, false);
      else useShoeStore.getState().bump();
      fitStack();
      void get().loadBoards();
    },

    reset() {
      stopReveal();
      set({
        status: 'idle',
        run: null,
        round: null,
        shown: 0,
        revealing: false,
        busy: false,
        records: null,
      });
    },

    createRun: (preset) =>
      intent(async () => {
        if (useAccountStore.getState().me?.needsDisplayName) {
          askName();
          return;
        }
        const run = await casualApi.createRun({ preset });
        set({ run, round: null, ended: null, status: 'playing', shown: 0 });
        if (get().stack.length === 0) set({ stack: [newChip(10)] });
        fitStack();
        useShoeStore.getState().bump();
      }),

    deal: () =>
      intent(async () => {
        const s = get();
        if (!s.run || s.revealing || s.round?.phase === 'player') return;
        fitStack();
        const bet = stackTotal(get().stack);
        if (bet < MIN_BET) {
          notify('Pon fichas sobre la mesa para apostar (mínimo 10).', 'error');
          return;
        }
        const runId = s.run.id;
        const round = await withIdempotency((idempotencyKey) =>
          casualApi.deal({ kind: 'casual', contextId: runId, bet, idempotencyKey }),
        );
        applyRound(round, true);
      }),

    act: (action) =>
      intent(async () => {
        const r = get().round;
        if (!r || r.phase !== 'player' || !r.allowed[action]) return;
        const round = await withIdempotency((key) => casualApi.act(r.id, action, key));
        applyRound(round, true);
      }),

    retire: () =>
      intent(async () => {
        const { run, round, revealing } = get();
        // Dentro de la intención `busy` ya está activo: solo cuenta la ronda en juego.
        if (!run || revealing || round?.phase === 'player') return;
        const ended = await casualApi.retire(run.id);
        set({ ended, run: null, round: null, status: 'noRun', shown: 0 });
        useShoeStore.getState().bump();
        void get().loadBoards();
      }),

    async loadBoards() {
      const signedIn = useAccountStore.getState().status === 'signedIn';
      const [board, records] = await Promise.allSettled([
        casualApi.weekly(),
        signedIn ? casualApi.records() : Promise.resolve(null),
      ]);
      set({
        board: board.status === 'fulfilled' ? board.value : get().board,
        records: records.status === 'fulfilled' ? records.value : get().records,
      });
    },

    addChip(value) {
      const s = get();
      const wallet = casualWallet(s);
      if (!wallet || casualLocked(s) || !canAddChip(s.stack, value, wallet.maxBet)) return null;
      const chip = newChip(value);
      set({ stack: [...s.stack, chip] });
      return chip.id;
    },

    removeChip() {
      const s = get();
      if (casualLocked(s) || s.stack.length === 0) return;
      set({ stack: s.stack.slice(0, -1) });
    },

    clearStack() {
      if (!casualLocked(get())) set({ stack: [] });
    },
  };
});
