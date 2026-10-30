// Ranked: la cuenta de la temporada (RankedAccountView), la ronda (mecánica común en
// @/play/round), el ranking de la temporada y los récords. Sin ayudas: la ronda no trae
// `shoeCounts` y aquí no se pide nada al motor. Nunca calcula saldo, neto ni posiciones.
import { create } from 'zustand';
import { useAccountStore } from '@/account/accountStore';
import { errorText } from '@/account/errors';
import { ApiRequestError } from '@/api/http';
import type {
  MyRecords,
  RankedAccountView,
  RankedLeaderboard,
  RoundKind,
  RoundView,
  WalletView,
} from '@/engine/contract';
import { playApi } from '@/play/api';
import { addReview, EMPTY_TALLY, type Tally } from '@/play/review';
import { createRound, isNotFound, notify, type RoundState } from '@/play/round';
import { useShoeStore } from '@/store/shoeStore';
import { rankedApi } from './api';
import { formatWhen } from './format';

/**
 * - `idle`: no se entró al modo (o no hay sesión).
 * - `loading`: pidiendo la cuenta de la temporada y la ronda activa.
 * - `ready`: con cuenta (y quizá una ronda en juego).
 * - `unavailable`: el servidor no respondió.
 */
export type RankedStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

export interface RankedState extends RoundState {
  status: RankedStatus;
  account: RankedAccountView | null;
  /** Saldo, tope y recarga: lo último que dijo el servidor (la ronda o la cuenta). */
  wallet: WalletView | null;
  /** Hay una mano a medias en otro modo: hay que terminarla allí antes de repartir aquí. */
  elsewhere: RoundKind | null;
  board: RankedLeaderboard | null;
  /** Temporada que se mira en el ranking (`AAAA-MM`); null = la actual. */
  boardSeason: string | null;
  records: MyRecords | null;
  /** Revisiones de esta sesión, sumadas tal como las manda el servidor. */
  tally: Tally;
  enter(): Promise<void>;
  reset(): void;
  loadBoard(season?: string | null): Promise<void>;
  loadRecords(): Promise<void>;
}

const accountWallet = ({ balance, maxBet, refillAvailableAt }: RankedAccountView): WalletView =>
  refillAvailableAt ? { balance, maxBet, refillAvailableAt } : { balance, maxBet };

// setTimeout no admite esperas de más de ~24,8 días; la recarga es como mucho a 24 h.
const MAX_WAIT_MS = 2 ** 31 - 1;

export const useRankedStore = create<RankedState>()((set, get) => {
  let refillTimer: ReturnType<typeof setTimeout> | null = null;

  /** Sin saldo: al llegar la hora de la recarga, la cuenta ya vuelve recargada. */
  const scheduleRefill = () => {
    if (refillTimer) clearTimeout(refillTimer);
    refillTimer = null;
    const at = get().wallet?.refillAvailableAt;
    if (!at) return;
    const wait = Math.min(MAX_WAIT_MS, Math.max(0, Date.parse(at) - Date.now()) + 1000);
    refillTimer = setTimeout(() => void refreshAccount(), wait);
  };

  const refreshAccount = async () => {
    try {
      const account = await rankedApi.me();
      set({ account, wallet: accountWallet(account) });
      fitStack();
      scheduleRefill();
    } catch (e) {
      fail(e);
    }
  };

  /** Tras liquidar: manos, neto y posición cambiaron; el saldo ya vino en el wallet. */
  const afterSettle = async (round: RoundView) => {
    set({ tally: addReview(get().tally, round) });
    await refreshAccount();
    void get().loadBoard(get().boardSeason);
  };

  const askName = () => {
    useAccountStore.getState().openDialog('name');
    notify('Elige tu nombre antes de jugar: aparece en el ranking.', 'error');
  };

  /** Errores de las acciones de juego, según la sección 6 de la guía de Ranked. */
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
      case 'bet_out_of_range': {
        const max = get().wallet?.maxBet ?? 10;
        notify(`En Ranked la apuesta es de 10 a ${max}, en múltiplos de 10.`, 'error');
        void refreshAccount();
        return;
      }
      case 'refill_pending':
        void refreshAccount().then(() => {
          const at = get().wallet?.refillAvailableAt;
          notify(
            at
              ? `Te quedaste sin fichas. La recarga a 100 estará disponible el ${formatWhen(at)}.`
              : 'Te quedaste sin fichas: espera a la recarga.',
            'error',
          );
        });
        return;
      // El estado local quedó desfasado (o la mano en juego es de Casual): se recarga.
      case 'round_active':
      case 'action_not_allowed':
      case 'no_active_round':
        void get().enter();
        return;
      default:
        notify(errorText(e), 'error');
    }
  };

  const { state, applyRound, stopReveal, fitStack } = createRound(set, get, {
    kind: 'ranked',
    wallet: () => get().wallet,
    onRound: (round) => set({ wallet: round.wallet }),
    canDeal: () => get().account !== null && get().elsewhere === null,
    afterSettle,
    fail,
  });

  return {
    ...state,
    status: 'idle',
    account: null,
    wallet: null,
    elsewhere: null,
    board: null,
    boardSeason: null,
    records: null,
    tally: EMPTY_TALLY,

    async enter() {
      stopReveal();
      set({ status: 'loading', revealing: false });
      const [account, round] = await Promise.allSettled([rankedApi.me(), playApi.activeRound()]);
      const lost = [account, round].find(
        (r) => r.status === 'rejected' && !(r === round && isNotFound(r.reason)),
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
      const elsewhere = active && active.kind !== 'ranked' ? active.kind : null;
      const view = (account as PromiseFulfilledResult<RankedAccountView>).value;
      set({
        account: view,
        wallet: accountWallet(view),
        status: 'ready',
        round: null,
        shown: 0,
        elsewhere,
      });
      // Retomar: una ronda a medio jugar (recarga o desconexión) sigue desde ahí.
      if (active && !elsewhere) applyRound(active, false);
      else useShoeStore.getState().bump();
      fitStack();
      scheduleRefill();
      void get().loadBoard(get().boardSeason);
      void get().loadRecords();
    },

    reset() {
      stopReveal();
      if (refillTimer) clearTimeout(refillTimer);
      refillTimer = null;
      set({
        status: 'idle',
        account: null,
        wallet: null,
        round: null,
        shown: 0,
        revealing: false,
        busy: false,
        elsewhere: null,
        records: null,
      });
    },

    async loadBoard(season = null) {
      set({ boardSeason: season });
      try {
        const board = await rankedApi.leaderboard(season ?? undefined);
        // Si mientras tanto se eligió otra temporada, esta respuesta ya no sirve.
        if (get().boardSeason === season) set({ board });
      } catch (e) {
        if (isNotFound(e) && get().boardSeason === season) set({ board: null });
      }
    },

    async loadRecords() {
      if (useAccountStore.getState().status !== 'signedIn') return;
      try {
        set({ records: await playApi.records() });
      } catch {
        // Los récords son un extra: sin ellos el modo se juega igual.
      }
    },
  };
});
