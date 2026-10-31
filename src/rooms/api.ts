// Salas: crear, listar y ver por HTTP. La mesa se juega por el WebSocket (ver socket.ts).
import { BASE, request } from '@/api/http';
import type { CreateRoomRequest, RoomInfo } from '@/engine/contract';

export const roomsApi = {
  create: (body: CreateRoomRequest) => request<RoomInfo>('POST', '/rooms', body),
  /** Solo las públicas, con asientos libres primero. */
  list: () => request<RoomInfo[]>('GET', '/rooms'),
  /** También las privadas: el código es la invitación. 404 `room_not_found`. */
  get: (code: string) => request<RoomInfo>('GET', `/rooms/${encodeURIComponent(code)}`),
};

/** Mismo origen que la página: la cookie de sesión viaja sola. */
export const roomSocketUrl = (code: string) =>
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${BASE}/rooms/${encodeURIComponent(code)}/ws`;

/** Los códigos no distinguen mayúsculas; se muestran y se mandan en mayúsculas. */
export const normalizeCode = (raw: string) =>
  raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

export const CODE_LENGTH = 6;
