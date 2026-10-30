// Logros y cosméticos del usuario, tal como los dice el servidor: nunca se calcula aquí si
// un logro se cumple ni si un cosmético se tiene. Los avisos de logro salen de
// `result.unlocked` al terminar de verse cada ronda; lo puesto se aplica a toda la mesa.
import { create } from 'zustand';
import { useAccountStore } from '@/account/accountStore';
import { errorText } from '@/account/errors';
import { ApiRequestError } from '@/api/http';
import type {
  AchievementId,
  CosmeticId,
  CosmeticItem,
  CosmeticSlot,
  EquippedCosmetics,
  MyAchievements,
  MyCosmetics,
  RoundView,
} from '@/engine/contract';
import { useTableStore } from '@/store/tableStore';
import { progressApi } from './api';
import { DEFAULT_EQUIPPED, isKnownAchievement } from './catalog';

/**
 * - `idle`: sin sesión (todo de serie, logros sin cargar).
 * - `loading`: pidiendo logros y cosméticos.
 * - `ready`: cargados.
 * - `unavailable`: el servidor no respondió (la mesa sigue con lo de serie).
 */
export type ProgressStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

export interface Toast {
  key: number;
  id: AchievementId;
}

export interface ProgressState {
  status: ProgressStatus;
  achievements: MyAchievements | null;
  cosmetics: MyCosmetics | null;
  /** Catálogo público de cosméticos (con el logro que desbloquea cada uno). */
  catalog: CosmeticItem[] | null;
  /** Avisos de logro en pantalla, del más antiguo al más nuevo. */
  toasts: Toast[];
  /** Hay un cambio de cosmético en vuelo: no se manda otro. */
  saving: boolean;
  load(): Promise<void>;
  reset(): void;
  loadCatalog(): Promise<void>;
  /** Una ronda liquidada y ya vista: avisa de sus logros nuevos y refresca la racha. */
  settled(round: RoundView): void;
  equip(slot: CosmeticSlot, id: CosmeticId | null): Promise<void>;
  dismiss(key: number): void;
}

/** Lo que se ve en la mesa: lo puesto en el servidor o, sin sesión, lo de serie. */
export const equippedOf = (s: Pick<ProgressState, 'cosmetics'>): EquippedCosmetics =>
  s.cosmetics?.equipped ?? DEFAULT_EQUIPPED;

const notify = (text: string, tone: 'info' | 'error' = 'info') =>
  useTableStore.getState().notify(text, tone);

const signedIn = () => useAccountStore.getState().status === 'signedIn';

export const useProgressStore = create<ProgressState>()((set, get) => {
  /**
   * Logros ya anunciados o que el usuario ya tenía: una respuesta repetida por idempotencia
   * trae los mismos `unlocked` y no se vuelven a anunciar.
   */
  const announced = new Set<AchievementId>();
  let toastKey = 0;

  const remember = (a: MyAchievements) => {
    for (const u of a.unlocked) if (isKnownAchievement(u.id)) announced.add(u.id);
  };

  const refreshAchievements = async () => {
    try {
      const achievements = await progressApi.achievements();
      if (!signedIn()) return;
      remember(achievements);
      set({ achievements });
    } catch {
      // La racha es un extra: sin ella se juega igual.
    }
  };

  const refreshCosmetics = async () => {
    try {
      const cosmetics = await progressApi.cosmetics();
      if (signedIn()) set({ cosmetics });
    } catch {
      // Se queda con lo que tenía: la mesa se sigue viendo igual.
    }
  };

  return {
    status: 'idle',
    achievements: null,
    cosmetics: null,
    catalog: null,
    toasts: [],
    saving: false,

    async load() {
      set({ status: 'loading' });
      const [achievements, cosmetics] = await Promise.allSettled([
        progressApi.achievements(),
        progressApi.cosmetics(),
      ]);
      if (!signedIn()) return;
      if (achievements.status === 'fulfilled') remember(achievements.value);
      set({
        status:
          achievements.status === 'fulfilled' && cosmetics.status === 'fulfilled'
            ? 'ready'
            : 'unavailable',
        achievements: achievements.status === 'fulfilled' ? achievements.value : null,
        cosmetics: cosmetics.status === 'fulfilled' ? cosmetics.value : null,
      });
    },

    reset() {
      announced.clear();
      set({ status: 'idle', achievements: null, cosmetics: null, toasts: [], saving: false });
    },

    async loadCatalog() {
      try {
        set({ catalog: await progressApi.catalog() });
      } catch {
        // Sin catálogo no se sabe qué logro desbloquea cada uno: se muestran sin pista.
      }
    },

    settled(round) {
      if (!signedIn()) return;
      const unlocked = round.result?.unlocked ?? [];
      const fresh = unlocked.filter((id) => isKnownAchievement(id) && !announced.has(id));
      for (const id of fresh) announced.add(id);
      if (fresh.length > 0) {
        set({
          toasts: [...get().toasts, ...fresh.map((id) => ({ key: ++toastKey, id }))],
        });
      }
      // La racha solo cuenta decisiones revisadas (Ranked y el reto diario).
      if (unlocked.length > 0 || round.kind === 'ranked' || round.kind === 'daily') {
        void refreshAchievements();
      }
      // Un logro nuevo puede traer cosméticos nuevos.
      if (unlocked.length > 0) void refreshCosmetics();
    },

    async equip(slot, id) {
      const current = get().cosmetics;
      if (!current || get().saving || current.equipped[slot] === id) return;
      const equipped = { ...current.equipped, [slot]: id };
      // Se ve al instante; si el servidor no lo acepta, vuelve a lo que había.
      set({ saving: true, cosmetics: { ...current, equipped } });
      try {
        const saved = await progressApi.equip(equipped);
        if (signedIn()) set({ cosmetics: saved });
      } catch (e) {
        set({ cosmetics: current });
        if (e instanceof ApiRequestError && e.status === 401) {
          useAccountStore.getState().sessionLost();
        } else if (e instanceof ApiRequestError && e.code === 'cosmetic_locked') {
          notify('Todavía no lo desbloqueaste.', 'error');
          void refreshCosmetics();
        } else {
          notify(errorText(e), 'error');
        }
      } finally {
        set({ saving: false });
      }
    },

    dismiss(key) {
      set({ toasts: get().toasts.filter((t) => t.key !== key) });
    },
  };
});
