// Endpoints de logros y cosméticos. Los logros nuevos de cada ronda llegan en
// `result.unlocked`; aquí, la lista completa, la racha y lo que se tiene puesto.
import { request } from '@/api/http';
import type {
  CosmeticItem,
  EquippedCosmetics,
  MyAchievements,
  MyCosmetics,
} from '@/engine/contract';

export const progressApi = {
  achievements: () => request<MyAchievements>('GET', '/me/achievements'),
  /** Público: el catálogo en orden, con el logro que desbloquea cada uno. */
  catalog: () => request<CosmeticItem[]>('GET', '/cosmetics'),
  cosmetics: () => request<MyCosmetics>('GET', '/me/cosmetics'),
  /** Reemplaza lo puesto entero (los cuatro campos; `title: null` lo quita). */
  equip: (equipped: EquippedCosmetics) => request<MyCosmetics>('PUT', '/me/cosmetics', equipped),
};
