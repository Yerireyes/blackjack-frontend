// Historial de rondas (paginado) y estadísticas, tal como las agrega el servidor: aquí nunca
// se calculan con el historial.
import { create } from 'zustand';
import { useAccountStore } from '@/account/accountStore';
import { ApiRequestError } from '@/api/http';
import type { HistoryItem, MyStats, RoundKind } from '@/engine/contract';
import { statsApi } from './api';

type Load = 'idle' | 'loading' | 'ready' | 'unavailable';

export interface StatsState {
  stats: MyStats | null;
  statsStatus: Load;
  /** Filtro del historial (null = todos los modos). */
  kind: RoundKind | null;
  items: HistoryItem[];
  /** Cursor de la página siguiente; null = no hay más. */
  nextBefore: string | null;
  historyStatus: Load;
  loadingMore: boolean;
  loadStats(): Promise<void>;
  setKind(kind: RoundKind | null): Promise<void>;
  loadMore(): Promise<void>;
  reset(): void;
}

const lost = (e: unknown) => {
  if (e instanceof ApiRequestError && e.status === 401) useAccountStore.getState().sessionLost();
};

export const useStatsStore = create<StatsState>()((set, get) => ({
  stats: null,
  statsStatus: 'idle',
  kind: null,
  items: [],
  nextBefore: null,
  historyStatus: 'idle',
  loadingMore: false,

  async loadStats() {
    if (get().statsStatus === 'idle') set({ statsStatus: 'loading' });
    try {
      set({ stats: await statsApi.stats(), statsStatus: 'ready' });
    } catch (e) {
      lost(e);
      set({ statsStatus: 'unavailable' });
    }
  },

  async setKind(kind) {
    set({ kind, items: [], nextBefore: null, historyStatus: 'loading' });
    try {
      const page = await statsApi.history({ kind: kind ?? undefined });
      // Si mientras tanto se eligió otro filtro, esta respuesta ya no sirve.
      if (get().kind !== kind) return;
      set({ items: page.items, nextBefore: page.nextBefore ?? null, historyStatus: 'ready' });
    } catch (e) {
      lost(e);
      if (get().kind === kind) set({ historyStatus: 'unavailable' });
    }
  },

  async loadMore() {
    const { nextBefore, kind, loadingMore } = get();
    if (!nextBefore || loadingMore) return;
    set({ loadingMore: true });
    try {
      const page = await statsApi.history({ kind: kind ?? undefined, before: nextBefore });
      if (get().kind !== kind) return;
      set({ items: [...get().items, ...page.items], nextBefore: page.nextBefore ?? null });
    } catch (e) {
      lost(e);
    } finally {
      set({ loadingMore: false });
    }
  },

  reset: () =>
    set({ stats: null, statsStatus: 'idle', items: [], nextBefore: null, historyStatus: 'idle' }),
}));
