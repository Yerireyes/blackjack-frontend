// Servidor simulado para los tests de Casual y Ranked: responde por "MÉTODO /ruta".
import { vi } from 'vitest';

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
export const notFound = (code: string) => () => json(404, { code, message: 'No existe.' });

export type Handler = (body: unknown) => Response | Promise<Response>;

/** Cada ruta responde con su handler; con una lista, uno por llamada y en orden. */
export function stubFetch(routes: Record<string, Handler | Handler[]>) {
  const calls: { key: string; body: unknown }[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url.replace('/api/v1', '')}`;
    const body: unknown = init?.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ key, body });
    const route = routes[key];
    const handler = Array.isArray(route) ? route.shift() : route;
    if (!handler) throw new TypeError(`sin ruta: ${key}`);
    return handler(body);
  });
  vi.stubGlobal('fetch', fn);
  return calls;
}
