// Cliente HTTP de la API del backend. Siempre con URLs relativas: en desarrollo el proxy de
// Vite lleva /api al backend, así front y API comparten origen y la cookie httpOnly
// `bj_session` viaja sola. El front nunca lee ni guarda el token.

/** Cuerpo de error de la API: decidir por `code`; `message` ya viene en español. */
export interface ApiErrorBody {
  code: string;
  message: string;
}

export const BASE = '/api/v1';

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

const UNAVAILABLE = 'El servidor no está disponible. Inténtalo más tarde.';

const isErrorBody = (x: unknown): x is ApiErrorBody =>
  typeof x === 'object' &&
  x !== null &&
  typeof (x as ApiErrorBody).code === 'string' &&
  typeof (x as ApiErrorBody).message === 'string';

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
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
