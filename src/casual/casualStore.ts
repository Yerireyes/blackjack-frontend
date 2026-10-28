// Casual: el servidor baraja, reparte, valida, juega el dealer y liquida. Este store guarda
// la partida (CasualRunView), la ronda (mecánica común en @/play/round), el ranking semanal
// y los récords. Nunca calcula cartas, resultados ni saldo.
import { create } from 'zustand';
import { useAccountStore } from '@/account/accountStore';
import { errorText } from '@/account/errors';
import { ApiRequestError } from '@/api/http';
import type {
  CasualRunView,
  MyRecords,
  Preset,
  RoundKind,
  WeeklyLeaderboard,
} from '@/engine/contract';
import { playApi } from '@/play/api';
import { createRound, isNotFound, notify, roundLocked, type RoundState } from '@/play/round';
import { newChip } from '@/store/chipsStore';
import { useShoeStore } from '@/store/shoeStore';
import { casualApi } from './api';

export { REVEAL_FIRST_MS, REVEAL_PEEK_MS, REVEAL_STEP_MS } from '@/play/round';

/**
 * - `idle`: no se entró al modo (o no hay sesión).
 * - `loading`: pidiendo la partida y la ronda activas.
 * - `noRun`: sin partida activa: se ofrece crear una.
 * - `playing`: hay partida (y quizá una ronda en juego).
 * - `unavailable`: el servidor no respondió.
 */
export type CasualStatus = 'idle' | 'loading' | 'noRun' | 'playing' | 'unavailable';

export interface CasualState extends RoundState {
  status: CasualStatus;
  run: CasualRunView | null;
  /** Hay una mano a medias en otro modo: hay que terminarla allí antes de repartir aquí. */
  elsewhere: RoundKind | null;
  /** Resumen de la última partida terminada (retirada o sin fichas). */
  ended: CasualRunView | null;
  board: WeeklyLeaderboard | null;
  records: MyRecords | null;
  enter(): Promise<void>;
  reset(): void;
  createRun(preset: Preset): Promise<void>;
  retire(): Promise<void>;
  loadBoards(): Promise<void>;
}

const MESSAGES: Record<string, string> = {
  display_name_required: 'Elige tu nombre antes de jugar: aparece en el ranking.',
  bet_out_of_range: 'La apuesta debe ser de 10 a 500, en múltiplos de 10.',
  insufficient_funds: 'No te alcanza el saldo para esa apuesta.',
  run_finished: 'La partida terminó.',
  no_active_run: 'La partida terminó.',
};

/** Saldo y tope de la próxima apuesta: lo último que dijo el servidor. */
export function casualWallet(s: Pick<CasualState, 'round' | 'run'>) {
  if (s.round && s.round.contextId === s.run?.id) return s.round.wallet;
  if (s.run) return { balance: s.run.balance, maxBet: s.run.maxBet };
  return null;
}

/** La ronda está en juego o animándose: la apuesta no se toca y no se reparte otra. */
export const casualLocked = roundLocked;

export const useCasualStore = create<CasualState>()((set, get) => {
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
      // El estado local quedó desfasado (o la mano en juego es de Ranked): se recarga.
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

  const { state, applyRound, stopReveal, fitStack, intent } = createRound(set, get, {
    kind: 'casual',
    wallet: () => casualWallet(get()),
    contextId: () => get().run?.id,
    canDeal: () => get().run !== null && get().elsewhere === null,
    afterSettle,
    fail,
  });

  return {
    ...state,
    status: 'idle',
    run: null,
    elsewhere: null,
    ended: null,
    board: null,
    records: null,

    async enter() {
      stopReveal();
      set({ status: 'loading', revealing: false });
      const [run, round] = await Promise.allSettled([casualApi.activeRun(), playApi.activeRound()]);
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
      const active = round.status === 'fulfilled' ? round.value : null;
      const elsewhere = active && active.kind !== 'casual' ? active.kind : null;
      set({
        run: activeRun,
        status: activeRun ? 'playing' : 'noRun',
        round: null,
        shown: 0,
        elsewhere,
      });
      // Retomar: una ronda a medio jugar (recarga o desconexión) sigue desde ahí.
      if (active && !elsewhere) applyRound(active, false);
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
        elsewhere: null,
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
        signedIn ? playApi.records() : Promise.resolve(null),
      ]);
      set({
        board: board.status === 'fulfilled' ? board.value : get().board,
        records: records.status === 'fulfilled' ? records.value : get().records,
      });
    },
  };
});
