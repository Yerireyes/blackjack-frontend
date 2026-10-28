// Endpoints de Casual. Los tipos vienen generados en contract.ts (no se copian a mano).
import { request } from '@/api/http';
import type {
  Action,
  CasualRunView,
  CreateCasualRunRequest,
  MyRecords,
  NewRoundRequest,
  RoundView,
  WeeklyLeaderboard,
} from '@/engine/contract';

export const casualApi = {
  activeRun: () => request<CasualRunView>('GET', '/casual/runs/active'),
  createRun: (body: CreateCasualRunRequest) => request<CasualRunView>('POST', '/casual/runs', body),
  retire: (runId: string) => request<CasualRunView>('POST', `/casual/runs/${runId}/retire`),
  activeRound: () => request<RoundView>('GET', '/play/active'),
  deal: (body: NewRoundRequest) => request<RoundView>('POST', '/play/rounds', body),
  act: (roundId: string, action: Action, idempotencyKey: string) =>
    request<RoundView>('POST', `/play/rounds/${roundId}/actions`, { action, idempotencyKey }),
  /** Público: sin sesión no trae `me`. */
  weekly: () => request<WeeklyLeaderboard>('GET', '/casual/leaderboard/weekly'),
  records: () => request<MyRecords>('GET', '/me/records'),
};
