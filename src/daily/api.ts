// Endpoints del reto diario. Las rondas van por `@/play/api` con `kind: "daily"`.
import { request } from '@/api/http';
import type { DailyAttemptView, DailyLeaderboard } from '@/engine/contract';

export const dailyApi = {
  /** Empieza el intento de hoy (uno por día: si ya existe, `daily_taken`). */
  start: () => request<DailyAttemptView>('POST', '/daily/attempts'),
  /** El intento de hoy, en juego o terminado; 404 `no_daily_attempt` si no hay. */
  me: () => request<DailyAttemptView>('GET', '/daily/me'),
  /** Público: sin sesión no trae `me`. Sin `day`, hoy (UTC). */
  leaderboard: (day?: string) =>
    request<DailyLeaderboard>(
      'GET',
      `/daily/leaderboard${day ? `?day=${encodeURIComponent(day)}` : ''}`,
    ),
};
