// La mecánica de una ronda contra el servidor, común a Casual y Ranked: guardar la última
// respuesta (RoundView) tal cual, animar la revelación del dealer al liquidar, mandar las
// intenciones con su clave de idempotencia y armar la pila de la próxima apuesta. Nunca
// calcula cartas, resultados ni saldo.
import type { StoreApi, UseBoundStore } from 'zustand';
import { ApiRequestError } from '@/api/http';
import type { Action, RoundKind, RoundView, WalletView } from '@/engine/contract';
import {
  canAddChip,
  MIN_BET,
  newChip,
  stackTotal,
  type Chip,
  type ChipValue,
} from '@/store/chipsStore';
import { useProgressStore } from '@/progress/progressStore';
import { useShoeStore } from '@/store/shoeStore';
import { useTableStore } from '@/store/tableStore';
import { playApi } from './api';
import { revealSteps } from './view';

export interface RoundState {
  /** Última ronda tal como la mandó el servidor: se reemplaza entera, nunca se edita. */
  round: RoundView | null;
  /** Pasos de la revelación del dealer ya mostrados (ver revealSteps). */
  shown: number;
  revealing: boolean;
  /** Hay una petición en vuelo: no se manda otra intención. */
  busy: boolean;
  /** Pila de la próxima apuesta (solo interfaz; el saldo es del servidor). */
  stack: Chip[];
  deal(): Promise<void>;
  act(action: Action): Promise<void>;
  addChip(value: ChipValue): number | null;
  removeChip(): void;
  clearStack(): void;
}

/** El store de un modo visto solo por su parte de ronda (para las piezas comunes). */
export type RoundStore = UseBoundStore<StoreApi<RoundState>>;

/** Pausas de la revelación al liquidar (en ms). Con peek, más larga: se ve el reparto. */
export const REVEAL_FIRST_MS = 700;
export const REVEAL_PEEK_MS = 1600;
export const REVEAL_STEP_MS = 600;
const RETRY_MS = 800;

export const notify = (text: string, tone: 'info' | 'error' = 'info') =>
  useTableStore.getState().notify(text, tone);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Una intención (este reparto, esta acción) = una clave de idempotencia. Solo se reutiliza
 * para reintentar la misma petición si no hubo respuesta (red): el servidor devuelve la
 * misma respuesta sin cobrar dos veces.
 */
export async function withIdempotency<T>(call: (key: string) => Promise<T>): Promise<T> {
  const key = crypto.randomUUID();
  try {
    return await call(key);
  } catch (e) {
    if (!(e instanceof ApiRequestError && e.status === 0)) throw e;
    await sleep(RETRY_MS);
    return call(key);
  }
}

export const isNotFound = (e: unknown) => e instanceof ApiRequestError && e.status === 404;

/** La ronda está en juego o animándose: la apuesta no se toca y no se reparte otra. */
export const roundLocked = (s: Pick<RoundState, 'round' | 'busy' | 'revealing'>) =>
  s.busy || s.revealing || s.round?.phase === 'player';

interface Config {
  kind: RoundKind;
  /** Saldo y tope de la próxima apuesta según lo último que dijo el servidor. */
  wallet(): Pick<WalletView, 'balance' | 'maxBet'> | null;
  /** Casual: la partida a la que va la ronda. Ranked no lo manda. */
  contextId?(): string | undefined;
  /** Se puede repartir (hay partida o cuenta). */
  canDeal(): boolean;
  /** Cada respuesta con ronda (repartir, actuar, retomar), antes de animar. */
  onRound?(round: RoundView): void;
  /** Tras liquidar y terminar la revelación. */
  afterSettle(round: RoundView): void | Promise<void>;
  fail(e: unknown): void;
}

/**
 * Arma la parte de la ronda de un store de zustand. Devuelve el estado inicial con sus
 * acciones y los ayudantes que el store necesita para sus propias intenciones.
 */
export function createRound(
  set: (partial: Partial<RoundState>) => void,
  get: () => RoundState,
  cfg: Config,
) {
  let revealTimer: ReturnType<typeof setTimeout> | null = null;
  const stopReveal = () => {
    if (revealTimer) clearTimeout(revealTimer);
    revealTimer = null;
  };

  /** Reemplaza la ronda con la respuesta del servidor; si se liquidó, anima la revelación. */
  const applyRound = (round: RoundView, animate: boolean) => {
    stopReveal();
    const steps = revealSteps(round);
    set({ round, shown: animate ? 0 : steps, revealing: animate && steps > 0 });
    cfg.onRound?.(round);
    // Cambiaron las cartas: el análisis viejo deja de ser actual.
    useShoeStore.getState().bump();
    if (round.phase !== 'settled') return;
    const done = () => {
      // Los logros se anuncian cuando ya se vio el resultado, no antes.
      useProgressStore.getState().settled(round);
      void cfg.afterSettle(round);
    };
    if (!animate || steps === 0) {
      done();
      return;
    }
    const step = () => {
      const shown = get().shown + 1;
      const last = shown >= steps;
      set({ shown, revealing: !last });
      if (last) done();
      else revealTimer = setTimeout(step, REVEAL_STEP_MS);
    };
    revealTimer = setTimeout(step, round.peekBlackjack ? REVEAL_PEEK_MS : REVEAL_FIRST_MS);
  };

  /** Quita fichas de arriba si la pila ya no entra en el tope de la próxima apuesta. */
  const fitStack = () => {
    const max = cfg.wallet()?.maxBet ?? 0;
    const stack = get().stack.slice();
    while (stack.length > 0 && stackTotal(stack) > max) stack.pop();
    if (stack.length !== get().stack.length) set({ stack });
  };

  /** Una intención a la vez: mientras hay una en vuelo, las demás se ignoran. */
  const intent = async (call: () => Promise<void>) => {
    if (get().busy) return;
    set({ busy: true });
    try {
      await call();
    } catch (e) {
      cfg.fail(e);
    } finally {
      set({ busy: false });
    }
  };

  const state: RoundState = {
    round: null,
    shown: 0,
    revealing: false,
    busy: false,
    stack: [newChip(10)],

    deal: () =>
      intent(async () => {
        const s = get();
        if (!cfg.canDeal() || s.revealing || s.round?.phase === 'player') return;
        fitStack();
        const bet = stackTotal(get().stack);
        if (bet < MIN_BET) {
          notify('Pon fichas sobre la mesa para apostar (mínimo 10).', 'error');
          return;
        }
        const contextId = cfg.contextId?.();
        const round = await withIdempotency((idempotencyKey) =>
          playApi.deal({
            kind: cfg.kind,
            ...(contextId ? { contextId } : {}),
            bet,
            idempotencyKey,
          }),
        );
        applyRound(round, true);
      }),

    act: (action) =>
      intent(async () => {
        const r = get().round;
        if (!r || r.phase !== 'player' || !r.allowed[action]) return;
        const round = await withIdempotency((key) => playApi.act(r.id, action, key));
        applyRound(round, true);
      }),

    addChip(value) {
      const s = get();
      const wallet = cfg.wallet();
      if (!wallet || roundLocked(s) || !canAddChip(s.stack, value, wallet.maxBet)) return null;
      const chip = newChip(value);
      set({ stack: [...s.stack, chip] });
      return chip.id;
    },

    removeChip() {
      const s = get();
      if (roundLocked(s) || s.stack.length === 0) return;
      set({ stack: s.stack.slice(0, -1) });
    },

    clearStack() {
      if (!roundLocked(get())) set({ stack: [] });
    },
  };

  return { state, applyRound, stopReveal, fitStack, intent };
}
