// Historial de rondas y estadísticas agregadas (con sesión). Las rondas de las salas no están:
// viven en memoria.
import { request } from '@/api/http';
import type { HistoryPage, MyStats, RoundKind } from '@/engine/contract';

export const HISTORY_PAGE = 20;

export const statsApi = {
  history: ({ kind, before }: { kind?: RoundKind; before?: string } = {}) => {
    const q = new URLSearchParams({ limit: String(HISTORY_PAGE) });
    if (kind) q.set('kind', kind);
    if (before) q.set('before', before);
    return request<HistoryPage>('GET', `/me/history?${q}`);
  },
  stats: () => request<MyStats>('GET', '/me/stats'),
};
