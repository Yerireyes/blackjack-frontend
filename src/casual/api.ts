// Endpoints de Casual. Los tipos vienen generados en contract.ts (no se copian a mano).
// Las rondas (`/play/*`) son comunes con Ranked: están en `@/play/api`.
import { request } from '@/api/http';
import type { CasualRunView, CreateCasualRunRequest, WeeklyLeaderboard } from '@/engine/contract';

export const casualApi = {
  activeRun: () => request<CasualRunView>('GET', '/casual/runs/active'),
  createRun: (body: CreateCasualRunRequest) => request<CasualRunView>('POST', '/casual/runs', body),
  retire: (runId: string) => request<CasualRunView>('POST', `/casual/runs/${runId}/retire`),
  /** Público: sin sesión no trae `me`. */
  weekly: () => request<WeeklyLeaderboard>('GET', '/casual/leaderboard/weekly'),
};
