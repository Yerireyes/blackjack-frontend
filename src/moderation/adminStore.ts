// Panel de administración: reportes y usuarios. Cada acción recarga lo que se ve: cambiar el
// nombre o suspender cierra en el servidor los reportes abiertos sobre esa persona.
import { create } from 'zustand';
import { useAccountStore } from '@/account/accountStore';
import { errorText } from '@/account/errors';
import { ApiRequestError } from '@/api/http';
import { useTableStore } from '@/store/tableStore';
import { moderationApi, type AdminUser, type Report } from './api';

export interface AdminState {
  reportStatus: 'open' | 'resolved';
  reports: Report[] | null;
  query: string;
  users: AdminUser[] | null;
  busy: string[];
  error: string | null;
  loadReports(status?: 'open' | 'resolved'): Promise<void>;
  search(name: string): Promise<void>;
  dismiss(reportId: string): Promise<void>;
  rename(userId: string): Promise<void>;
  ban(userId: string, reason: string): Promise<boolean>;
  unban(userId: string): Promise<void>;
}

const notify = (text: string, tone: 'info' | 'error' = 'info') =>
  useTableStore.getState().notify(text, tone);

const fail = (e: unknown) => {
  if (e instanceof ApiRequestError && e.status === 401) useAccountStore.getState().sessionLost();
  else if (e instanceof ApiRequestError && e.code === 'not_admin')
    notify('Tu cuenta ya no es de administrador.', 'error');
  else if (e instanceof ApiRequestError && e.code === 'cannot_ban_admin')
    notify('No se puede suspender a un administrador.', 'error');
  else if (e instanceof ApiRequestError && e.status === 404)
    notify('Ya estaba resuelto: se actualizó la lista.', 'error');
  else notify(errorText(e), 'error');
};

export const useAdminStore = create<AdminState>()((set, get) => {
  /** Una acción sobre un id; al terminar recarga reportes y la búsqueda actual. */
  const act = async (key: string, call: () => Promise<unknown>, done?: string) => {
    if (get().busy.includes(key)) return false;
    set({ busy: [...get().busy, key] });
    try {
      await call();
      if (done) notify(done);
      return true;
    } catch (e) {
      fail(e);
      return false;
    } finally {
      set({ busy: get().busy.filter((k) => k !== key) });
      void get().loadReports();
      if (get().query) void get().search(get().query);
    }
  };

  return {
    reportStatus: 'open',
    reports: null,
    query: '',
    users: null,
    busy: [],
    error: null,

    async loadReports(status = get().reportStatus) {
      set({ reportStatus: status });
      try {
        const reports = await moderationApi.reports(status);
        if (get().reportStatus === status) set({ reports, error: null });
      } catch (e) {
        fail(e);
        set({ error: 'No se pudieron cargar los reportes.' });
      }
    },

    async search(name) {
      set({ query: name });
      const q = name.trim();
      if (!q) {
        set({ users: null });
        return;
      }
      try {
        const users = await moderationApi.users(q);
        if (get().query === name) set({ users });
      } catch (e) {
        fail(e);
      }
    },

    dismiss: async (id) =>
      void (await act(id, () => moderationApi.dismiss(id), 'Reporte descartado.')),
    rename: async (id) =>
      void (await act(
        id,
        () => moderationApi.rename(id),
        'Nombre cambiado por uno provisional: al entrar le pedirá otro.',
      )),
    ban: (id, reason) => act(id, () => moderationApi.ban(id, reason), 'Cuenta suspendida.'),
    unban: async (id) =>
      void (await act(id, () => moderationApi.unban(id), 'Suspensión levantada.')),
  };
});
