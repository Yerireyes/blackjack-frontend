// La lista de amigos, las solicitudes y las invitaciones a salas, tal como las da el servidor.
import { create } from 'zustand';
import { useAccountStore } from '@/account/accountStore';
import { errorText } from '@/account/errors';
import { ApiRequestError } from '@/api/http';
import type { FriendsView } from '@/engine/contract';
import { useTableStore } from '@/store/tableStore';
import { friendsApi } from './api';

export interface FriendsState {
  view: FriendsView | null;
  status: 'idle' | 'loading' | 'ready' | 'unavailable';
  open: boolean;
  /** Ids con una acción en vuelo (para deshabilitar sus botones). */
  pending: string[];
  load(): Promise<void>;
  reset(): void;
  setOpen(open: boolean): void;
  /** Pide amistad por nombre. Devuelve el error a mostrar, o null si salió bien. */
  request(displayName: string): Promise<string | null>;
  accept(userId: string): Promise<void>;
  decline(userId: string): Promise<void>;
  remove(userId: string): Promise<void>;
  invite(code: string, userId: string): Promise<boolean>;
  dismiss(invitationId: string): Promise<void>;
}

/** Lo que hay que atender: solicitudes recibidas e invitaciones. */
export const badgeOf = (s: Pick<FriendsState, 'view'>) =>
  (s.view?.incoming.length ?? 0) + (s.view?.invitations.length ?? 0);

const notify = (text: string, tone: 'info' | 'error' = 'info') =>
  useTableStore.getState().notify(text, tone);

/** Mensajes sugeridos por la guía de amigos. */
const TEXT: Record<string, string> = {
  user_not_found: 'No hay nadie con ese nombre.',
  already_friends: 'Ya son amigos.',
  request_exists: 'Ya le mandaste una solicitud.',
  too_many_friends: 'Llegaste al máximo de 200 amigos.',
  too_many_requests: 'Tienes demasiadas solicitudes pendientes.',
  not_in_room: 'Entra a la sala para invitar.',
  not_friends: 'Solo puedes invitar a tus amigos.',
  request_not_found: 'Esa solicitud ya no existe.',
  room_not_found: 'Esa sala ya cerró.',
};

const message = (e: unknown) => {
  if (e instanceof ApiRequestError && e.status === 401) {
    useAccountStore.getState().sessionLost();
    return 'Tu sesión se cerró. Vuelve a entrar.';
  }
  if (e instanceof ApiRequestError && e.code in TEXT) return TEXT[e.code]!;
  if (e instanceof ApiRequestError && e.status === 400) return 'No puedes agregarte a ti mismo.';
  return errorText(e);
};

export const useFriendsStore = create<FriendsState>()((set, get) => {
  /** Una acción sobre un id: mientras va, su botón queda deshabilitado; luego se recarga. */
  const act = async (key: string, call: () => Promise<void>) => {
    if (get().pending.includes(key)) return false;
    set({ pending: [...get().pending, key] });
    try {
      await call();
      return true;
    } catch (e) {
      notify(message(e), 'error');
      return false;
    } finally {
      set({ pending: get().pending.filter((k) => k !== key) });
      void get().load();
    }
  };

  return {
    view: null,
    status: 'idle',
    open: false,
    pending: [],

    async load() {
      if (get().status === 'idle') set({ status: 'loading' });
      try {
        const view = await friendsApi.list();
        if (useAccountStore.getState().status === 'signedIn') set({ view, status: 'ready' });
      } catch (e) {
        if (e instanceof ApiRequestError && e.status === 401) {
          useAccountStore.getState().sessionLost();
          return;
        }
        set({ status: 'unavailable' });
      }
    },

    reset: () => set({ view: null, status: 'idle', open: false, pending: [] }),
    setOpen: (open) => set({ open }),

    async request(displayName) {
      const name = displayName.trim();
      if (!name) return 'Escribe el nombre de quien quieres agregar.';
      try {
        await friendsApi.request(name);
        await get().load();
        // 201 = el otro ya te la había pedido: ahora son amigos.
        const lower = name.toLocaleLowerCase('es');
        const now = get().view?.friends.some(
          (f) => f.user.displayName.toLocaleLowerCase('es') === lower,
        );
        notify(now ? `${name} y tú ya son amigos.` : `Solicitud enviada a ${name}.`);
        return null;
      } catch (e) {
        return message(e);
      }
    },

    accept: async (userId) => void (await act(userId, () => friendsApi.accept(userId))),
    decline: async (userId) => void (await act(userId, () => friendsApi.decline(userId))),
    remove: async (userId) => void (await act(userId, () => friendsApi.remove(userId))),
    async invite(code, userId) {
      const ok = await act(`invite-${userId}`, () => friendsApi.invite(code, userId));
      return ok;
    },
    dismiss: async (id) => void (await act(id, () => friendsApi.dismiss(id))),
  };
});
