// Amigos: solicitudes por nombre, la lista con quién está conectado e invitaciones a salas.
// No hay tiempo real por usuario: la lista se vuelve a pedir cada tanto (ver friendsSync).
import { request } from '@/api/http';
import type { FriendsView } from '@/engine/contract';

const id = (s: string) => encodeURIComponent(s);

export const friendsApi = {
  list: () => request<FriendsView>('GET', '/friends'),
  /** 202: solicitud enviada; 201: ya la había pedido el otro, ahora son amigos. */
  request: (displayName: string) => request<void>('POST', '/friends/requests', { displayName }),
  accept: (userId: string) => request<void>('POST', `/friends/requests/${id(userId)}/accept`),
  /** Rechaza una recibida o cancela una enviada. */
  decline: (userId: string) => request<void>('POST', `/friends/requests/${id(userId)}/decline`),
  remove: (userId: string) => request<void>('POST', `/friends/${id(userId)}/remove`),
  invite: (code: string, userId: string) =>
    request<void>('POST', `/rooms/${id(code)}/invite`, { userId }),
  dismiss: (invitationId: string) =>
    request<void>('POST', `/me/invitations/${id(invitationId)}/dismiss`),
};
