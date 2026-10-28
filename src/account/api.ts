// Cliente HTTP de la API de cuentas. Siempre con URLs relativas: en desarrollo el proxy de
// Vite lleva /api al backend, así front y API comparten origen y la cookie httpOnly
// `bj_session` viaja sola. El front nunca lee ni guarda el token.
import type { ApiErrorBody, Me, Providers, RegisterInput } from './types';

const BASE = '/api/v1';

/** Error de la API con su `code`. `status` 0 = no hubo respuesta (red o servidor caído). */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** Segundos de espera (cabecera Retry-After en 429). */
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

const UNAVAILABLE = 'El servidor de cuentas no está disponible. Inténtalo más tarde.';

const isErrorBody = (x: unknown): x is ApiErrorBody =>
  typeof x === 'object' &&
  x !== null &&
  typeof (x as ApiErrorBody).code === 'string' &&
  typeof (x as ApiErrorBody).message === 'string';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiRequestError(0, 'network', UNAVAILABLE);
  }
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (res.ok) return data as T;

  // Sin cuerpo con forma de error: típicamente el proxy de Vite con el backend apagado.
  if (!isErrorBody(data)) throw new ApiRequestError(res.status, 'unavailable', UNAVAILABLE);
  const retry = Number(res.headers.get('Retry-After'));
  throw new ApiRequestError(
    res.status,
    data.code,
    data.message,
    Number.isFinite(retry) && retry > 0 ? retry : undefined,
  );
}

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
