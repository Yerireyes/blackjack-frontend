// Endpoints de Ranked. Las rondas van por `@/play/api` con `kind: "ranked"`.
import { request } from '@/api/http';
import type { RankedAccountView, RankedLeaderboard } from '@/engine/contract';

export const rankedApi = {
  /** Crea la cuenta de la temporada la primera vez y aplica la recarga si toca. */
  me: () => request<RankedAccountView>('GET', '/ranked/me'),
  /** Público: sin sesión no trae `me`. Sin `season`, la temporada actual. */
  leaderboard: (season?: string) =>
    request<RankedLeaderboard>(
      'GET',
      `/ranked/leaderboard${season ? `?season=${encodeURIComponent(season)}` : ''}`,
    ),
};
