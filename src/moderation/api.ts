// Moderación: reportar a otro usuario (cualquiera con sesión) y el panel de administración
// (solo `me.isAdmin`; el servidor responde 403 `not_admin` a los demás). Estos tipos no salen
// de contract.ts: son de cuentas, como `Me`, y se declaran según «Front — Moderación.md».
import { request } from '@/api/http';

export type ReportReason = 'name' | 'behavior' | 'cheating' | 'other';

export interface Report {
  id: string;
  reporter: { id: string; displayName: string };
  target: { id: string; displayName: string };
  reason: ReportReason;
  details?: string;
  createdAt: string;
  resolvedAt?: string;
  action?: 'dismiss' | 'rename' | 'ban';
}

export interface AdminUser {
  id: string;
  displayName: string;
  email: string;
  createdAt: string;
  bannedAt?: string;
  banReason?: string;
  openReports: number;
}

const id = (s: string) => encodeURIComponent(s);

export const moderationApi = {
  report: (body: { displayName: string; reason: ReportReason; details?: string }) =>
    request<void>('POST', '/reports', body),
  reports: (status: 'open' | 'resolved') =>
    request<Report[]>('GET', `/admin/reports?status=${status}`),
  dismiss: (reportId: string) => request<void>('POST', `/admin/reports/${id(reportId)}/dismiss`),
  users: (name: string) => request<AdminUser[]>('GET', `/admin/users?name=${id(name)}`),
  /** Pone un nombre provisional: al entrar, le pide uno nuevo. */
  rename: (userId: string) =>
    request<{ displayName: string }>('POST', `/admin/users/${id(userId)}/rename`),
  ban: (userId: string, reason: string) =>
    request<void>('POST', `/admin/users/${id(userId)}/ban`, { reason }),
  unban: (userId: string) => request<void>('POST', `/admin/users/${id(userId)}/unban`),
};
