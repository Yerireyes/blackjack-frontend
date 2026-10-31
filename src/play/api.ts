// Rondas contra el servidor: las mismas rutas para Casual y Ranked (`kind` dice cuál).
import { request } from '@/api/http';
import type { Action, MyRecords, NewRoundRequest, RoundView } from '@/engine/contract';

export const playApi = {
  /** La ronda en juego, de cualquiera de los dos modos (mirar `kind`). */
  activeRound: () => request<RoundView>('GET', '/play/active'),
  deal: (body: NewRoundRequest) => request<RoundView>('POST', '/play/rounds', body),
  act: (roundId: string, action: Action, idempotencyKey: string) =>
    request<RoundView>('POST', `/play/rounds/${roundId}/actions`, { action, idempotencyKey }),
  /** Con un As visible, antes del peek: tomar (`take`) o rechazar el seguro. */
  insurance: (roundId: string, take: boolean, idempotencyKey: string) =>
    request<RoundView>('POST', `/play/rounds/${roundId}/insurance`, { take, idempotencyKey }),
  records: () => request<MyRecords>('GET', '/me/records'),
};
