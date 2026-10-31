// Reto diario: el intento de hoy (DailyAttemptView), la ronda (mecánica común en
// @/play/round), el ranking del día y los récords. Sin ayudas, como Ranked: la ronda no trae
// `shoeCounts` y aquí no se pide nada al motor. Nunca calcula saldo, manos ni posiciones.
import { create } from 'zustand';
import { useAccountStore } from '@/account/accountStore';
import { errorText } from '@/account/errors';
import { ApiRequestError } from '@/api/http';
import type {
  DailyAttemptView,
  DailyLeaderboard,
  MyRecords,
  RoundKind,
  RoundView,
  WalletView,
} from '@/engine/contract';
import { playApi } from '@/play/api';
import { addReview, EMPTY_TALLY, type Tally } from '@/play/review';
import { createRound, inHand, isNotFound, notify, type RoundState } from '@/play/round';
import { newChip } from '@/store/chipsStore';
import { useShoeStore } from '@/store/shoeStore';
import { dailyApi, type BoardScope } from './api';
import { msToNextDay } from './format';

/**
 * - `idle`: no se entró al modo (o no hay sesión).
 * - `loading`: pidiendo el intento de hoy y la ronda activa.
 * - `none`: todavía no empezó el reto de hoy.
 * - `active`: intento en juego (y quizá una ronda).
 * - `finished`: terminó el reto de hoy; vuelve mañana.
 * - `unavailable`: el servidor no respondió.
 */
export type DailyStatus = 'idle' | 'loading' | 'none' | 'active' | 'finished' | 'unavailable';

export interface DailyState extends RoundState {
  status: DailyStatus;
  attempt: DailyAttemptView | null;
  /** Saldo y tope: lo último que dijo el servidor (la ronda o el intento). */
  wallet: WalletView | null;
  /** Hay una mano a medias en otro modo: hay que terminarla allí antes de repartir aquí. */
  elsewhere: RoundKind | null;
  board: DailyLeaderboard | null;
  /** Día que se mira en el ranking (`AAAA-MM-DD`); null = hoy. */
  boardDay: string | null;
  /** Todos o solo tus amigos (`?scope=friends`). */
  boardScope: BoardScope;
  /** Hoy según el servidor (`AAAA-MM-DD`, UTC): el día del ranking sin `day`. */
  today: string | null;
  records: MyRecords | null;
  tally: Tally;
  enter(): Promise<void>;
  reset(): void;
  start(): Promise<void>;
  loadBoard(day?: string | null): Promise<void>;
  setBoardScope(scope: BoardScope): Promise<void>;
}

const attemptWallet = (a: DailyAttemptView): WalletView => ({
  balance: a.balance,
  maxBet: a.maxBet,
});

const statusOf = (a: DailyAttemptView | null): DailyStatus =>
  a === null ? 'none' : a.status === 'finished' ? 'finished' : 'active';

export const useDailyStore = create<DailyState>()((set, get) => {
  let dayTimer: ReturnType<typeof setTimeout> | null = null;

  /** A las 00:00 UTC empieza otro reto: se vuelve a preguntar (sin cortar una mano en juego). */
  const scheduleDayChange = () => {
    if (dayTimer) clearTimeout(dayTimer);
    dayTimer = setTimeout(() => {
      dayTimer = null;
      if (inHand(get().round) || get().revealing) scheduleDayChange();
      else void get().enter();
    }, msToNextDay() + 2000);
  };

  const setAttempt = (attempt: DailyAttemptView | null) =>
    set({
      attempt,
      status: statusOf(attempt),
      wallet: attempt ? attemptWallet(attempt) : null,
    });

  /** Tras liquidar: manos y saldo del intento; si `maxBet` llegó a 0, el reto terminó. */
  const afterSettle = async (round: RoundView) => {
    set({ tally: addReview(get().tally, round) });
    try {
      setAttempt(await dailyApi.me());
      fitStack();
    } catch (e) {
      if (!isNotFound(e)) return fail(e);
      // Cambió el día durante la mano: el intento de ayer quedó sin terminar.
      setAttempt(null);
      notify('Cambió el día (00:00 UTC): el reto de ayer quedó sin terminar.');
    }
    if (round.wallet.maxBet === 0) notify('Terminaste el reto de hoy.');
    void get().loadBoard(get().boardDay);
    if (get().status === 'finished') void loadRecords();
  };

  const loadRecords = async () => {
    try {
      set({ records: await playApi.records() });
    } catch {
      // Los récords son un extra: sin ellos el reto se juega igual.
    }
  };

  const askName = () => {
    useAccountStore.getState().openDialog('name');
    notify('Elige tu nombre antes de jugar: aparece en el ranking.', 'error');
  };

  /** Errores de las acciones de juego, según la sección 5 de la guía del reto. */
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
      case 'daily_taken':
        notify('Ya jugaste el reto de hoy. Vuelve mañana.', 'error');
        void get().enter();
        return;
      case 'daily_finished':
        notify('Terminaste el reto de hoy.');
        void get().enter();
        return;
      case 'no_daily_attempt':
        if (get().status === 'active') {
          notify('Cambió el día (00:00 UTC): el reto de ayer quedó sin terminar.');
        }
        void get().enter();
        return;
      case 'bet_out_of_range':
        notify('La apuesta debe ser de 10 a 500, en múltiplos de 10.', 'error');
        return;
      case 'insufficient_funds':
        notify('No te alcanza el saldo para esa apuesta.', 'error');
        void get().enter();
        return;
      // El estado local quedó desfasado (o la mano en juego es de otro modo): se recarga.
      case 'round_active':
      case 'action_not_allowed':
      case 'no_active_round':
        void get().enter();
        return;
      default:
        notify(errorText(e), 'error');
    }
  };

  const { state, applyRound, stopReveal, fitStack, intent } = createRound(set, get, {
    kind: 'daily',
    wallet: () => get().wallet,
    onRound: (round) => set({ wallet: round.wallet }),
    canDeal: () => get().status === 'active' && get().elsewhere === null,
    afterSettle,
    fail,
  });

  return {
    ...state,
    status: 'idle',
    attempt: null,
    wallet: null,
    elsewhere: null,
    board: null,
    boardDay: null,
    boardScope: 'all',
    today: null,
    records: null,
    tally: EMPTY_TALLY,

    async enter() {
      stopReveal();
      set({ status: 'loading', revealing: false });
      const [attempt, round] = await Promise.allSettled([dailyApi.me(), playApi.activeRound()]);
      const lost = [attempt, round].find(
        (r) => r.status === 'rejected' && !isNotFound(r.reason),
      ) as PromiseRejectedResult | undefined;
      if (lost) {
        if (lost.reason instanceof ApiRequestError && lost.reason.status === 401) {
          fail(lost.reason);
        } else {
          set({ status: 'unavailable' });
        }
        return;
      }
      const active = round.status === 'fulfilled' ? round.value : null;
      const elsewhere = active && active.kind !== 'daily' ? active.kind : null;
      set({ round: null, shown: 0, elsewhere });
      setAttempt(attempt.status === 'fulfilled' ? attempt.value : null);
      // Retomar: una ronda a medio jugar (recarga o desconexión) sigue desde ahí. Puede ser de
      // ayer si cambió el día: esa mano todavía se puede terminar.
      if (active && !elsewhere) applyRound(active, false);
      else useShoeStore.getState().bump();
      fitStack();
      scheduleDayChange();
      void get().loadBoard(get().boardDay);
      if (useAccountStore.getState().status === 'signedIn') void loadRecords();
    },

    reset() {
      stopReveal();
      if (dayTimer) clearTimeout(dayTimer);
      dayTimer = null;
      set({
        status: 'idle',
        attempt: null,
        wallet: null,
        round: null,
        shown: 0,
        revealing: false,
        busy: false,
        elsewhere: null,
        records: null,
      });
    },

    start: () =>
      intent(async () => {
        if (useAccountStore.getState().me?.needsDisplayName) {
          askName();
          return;
        }
        // Un solo intento por día: si ya hay uno, el botón ni siquiera se muestra.
        if (get().attempt) return;
        setAttempt(await dailyApi.start());
        set({ round: null, shown: 0, tally: EMPTY_TALLY });
        if (get().stack.length === 0) set({ stack: [newChip(10)] });
        fitStack();
        useShoeStore.getState().bump();
      }),

    async loadBoard(day = null) {
      set({ boardDay: day });
      // Amigos solo con sesión (sin ella el servidor responde 401).
      const scope = useAccountStore.getState().status === 'signedIn' ? get().boardScope : 'all';
      const current = () => get().boardDay === day && get().boardScope === scope;
      try {
        const board = await dailyApi.leaderboard(day ?? undefined, scope);
        if (day === null) set({ today: board.day });
        // Si mientras tanto se eligió otro día u otro alcance, esta respuesta ya no sirve.
        if (current()) set({ board });
      } catch {
        if (current()) set({ board: null });
      }
    },

    async setBoardScope(boardScope) {
      set({ boardScope });
      await get().loadBoard(get().boardDay);
    },
  };
});
