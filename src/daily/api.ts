// Endpoints del reto diario. Las rondas van por `@/play/api` con `kind: "daily"`.
import { request } from '@/api/http';
import type { DailyAttemptView, DailyLeaderboard } from '@/engine/contract';

/** Todo el ranking o solo tus amigos. */
export type BoardScope = 'all' | 'friends';

export const dailyApi = {
  /** Empieza el intento de hoy (uno por día: si ya existe, `daily_taken`). */
  start: () => request<DailyAttemptView>('POST', '/daily/attempts'),
  /** El intento de hoy, en juego o terminado; 404 `no_daily_attempt` si no hay. */
  me: () => request<DailyAttemptView>('GET', '/daily/me'),
  /**
   * Público: sin sesión no trae `me`. Sin `day`, hoy (UTC). Con `friends` (con sesión), solo
   * entre el usuario y sus amigos.
   */
  leaderboard: (day?: string, scope: BoardScope = 'all') => {
    const q = new URLSearchParams();
    if (day) q.set('day', day);
    if (scope === 'friends') q.set('scope', 'friends');
    const qs = q.toString();
    return request<DailyLeaderboard>('GET', `/daily/leaderboard${qs ? `?${qs}` : ''}`);
  },
};
