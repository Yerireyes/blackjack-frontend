// Cliente de la API de cuentas. Las llamadas pasan por el cliente HTTP compartido
// (src/api/http.ts): URLs relativas, mismo origen y cookie httpOnly que el front nunca lee.
import { BASE, request } from '@/api/http';
import type { Me, Providers, RegisterInput } from './types';

export const accountApi = {
  providers: () => request<Providers>('GET', '/auth/providers'),
  me: () => request<Me>('GET', '/auth/me'),
  register: (input: RegisterInput) => request<Me>('POST', '/auth/register', input),
  login: (email: string, password: string) =>
    request<Me>('POST', '/auth/login', { email, password }),
  logout: () => request<void>('POST', '/auth/logout'),
  /** Revoca todas las sesiones del usuario, también la actual. */
  logoutAll: () => request<void>('POST', '/auth/logout-all'),
  updateMe: (displayName: string) => request<Me>('PATCH', '/me', { displayName }),
  /**
   * Paso previo a vincular Google: con la contraseña correcta el servidor guarda en esta
   * sesión una prueba de un solo uso (5 min) que gasta la navegación a start?link=1.
   */
  googleLinkIntent: (password: string) =>
    request<void>('POST', '/auth/google/link-intent', { password }),
  /** Quita Google de la cuenta y cierra las demás sesiones (no la actual). */
  googleUnlink: (password: string) => request<Me>('POST', '/auth/google/unlink', { password }),
};

/**
 * Login con Google y vinculación: son navegaciones completas, no fetch. El servidor
 * redirige a Google y Google vuelve a la app con ?login=… o ?link=….
 */
export const googleStartUrl = (link = false) => `${BASE}/auth/google/start${link ? '?link=1' : ''}`;
