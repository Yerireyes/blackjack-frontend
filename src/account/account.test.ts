import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTableStore } from '@/store/tableStore';
import { useAccountStore } from './accountStore';
import { accountApi, ApiRequestError } from './api';
import { checkDisplayName } from './displayName';
import { oauthErrorNotice, readOAuthReturn, withoutOAuthParams } from './oauthReturn';
import type { Me } from './types';

const me: Me = {
  id: 'u1',
  email: 'ana@example.com',
  displayName: 'Ana',
  needsDisplayName: false,
  hasPassword: true,
  providers: [],
  createdAt: '2026-10-27T12:00:00Z',
};

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

/** fetch simulado: responde según "MÉTODO ruta". */
function stubFetch(routes: Record<string, () => Response>) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url}`;
    const handler = routes[key];
    if (!handler) throw new TypeError(`sin ruta: ${key}`);
    return handler();
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

const acc = () => useAccountStore.getState();
const unauthorized = () => json(401, { code: 'unauthorized', message: 'Inicia sesión.' });

beforeEach(() => {
  useAccountStore.setState({
    status: 'loading',
    me: null,
    providers: { google: false },
    dialog: null,
    nameDeferred: false,
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('cliente HTTP', () => {
  it('usa URLs relativas, mismo origen y JSON', async () => {
    const fetch = stubFetch({ 'POST /api/v1/auth/login': () => json(200, me) });
    await accountApi.login('ana@example.com', 'secreto123');
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('/api/v1/auth/login');
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin' });
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init!.body as string)).toEqual({
      email: 'ana@example.com',
      password: 'secreto123',
    });
  });

  it('propaga code, message y Retry-After', async () => {
    stubFetch({
      'POST /api/v1/auth/login': () =>
        json(
          429,
          { code: 'rate_limited', message: 'Demasiados intentos.' },
          { 'Retry-After': '6' },
        ),
    });
    const err = await accountApi.login('a@b.co', 'x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    expect(err).toMatchObject({ status: 429, code: 'rate_limited', retryAfter: 6 });
  });

  it('sin cuerpo de error (backend apagado tras el proxy) es «unavailable»', async () => {
    stubFetch({ 'GET /api/v1/auth/me': () => new Response('', { status: 502 }) });
    await expect(accountApi.me()).rejects.toMatchObject({ code: 'unavailable', status: 502 });
  });
});

describe('accountStore', () => {
  it('al arrancar sin sesión queda anónimo', async () => {
    stubFetch({
      'GET /api/v1/auth/providers': () => json(200, { google: false }),
      'GET /api/v1/auth/me': unauthorized,
    });
    await acc().init();
    expect(acc().status).toBe('anonymous');
    expect(acc().providers.google).toBe(false);
  });

  it('al arrancar con sesión guarda el usuario', async () => {
    stubFetch({
      'GET /api/v1/auth/providers': () => json(200, { google: true }),
      'GET /api/v1/auth/me': () => json(200, me),
    });
    await acc().init();
    expect(acc().status).toBe('signedIn');
    expect(acc().me?.displayName).toBe('Ana');
    expect(acc().providers.google).toBe(true);
  });

  it('con la API caída queda «unavailable» y Google oculto', async () => {
    stubFetch({});
    await acc().init();
    expect(acc().status).toBe('unavailable');
    expect(acc().providers.google).toBe(false);
  });

  it('un nombre provisional abre el diálogo, y «Más tarde» no lo repite', async () => {
    stubFetch({
      'POST /api/v1/auth/login': () =>
        json(200, { ...me, displayName: 'Jugador4821', needsDisplayName: true }),
    });
    await acc().login('ana@example.com', 'secreto123');
    expect(acc().dialog).toBe('name');
    acc().deferName();
    await acc().login('ana@example.com', 'secreto123');
    expect(acc().dialog).toBeNull();
  });

  it('el registro manda el nombre visible', async () => {
    const fetch = stubFetch({ 'POST /api/v1/auth/register': () => json(201, me) });
    await acc().register({ email: 'ana@example.com', password: 'secreto123', displayName: 'Ana' });
    expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toMatchObject({
      displayName: 'Ana',
    });
    expect(acc().status).toBe('signedIn');
  });

  it('un 401 con sesión la da por vencida', async () => {
    useAccountStore.setState({ status: 'signedIn', me });
    stubFetch({ 'PATCH /api/v1/me': unauthorized });
    await expect(acc().updateDisplayName('Ana2')).rejects.toBeInstanceOf(ApiRequestError);
    expect(acc().status).toBe('anonymous');
    expect(acc().me).toBeNull();
  });

  it('logout con 401 cuenta como sesión cerrada', async () => {
    useAccountStore.setState({ status: 'signedIn', me });
    stubFetch({ 'POST /api/v1/auth/logout': unauthorized });
    await acc().logout();
    expect(acc().status).toBe('anonymous');
  });

  it('cerrar sesión en todos los dispositivos limpia el usuario', async () => {
    useAccountStore.setState({ status: 'signedIn', me, dialog: 'profile' });
    const fetch = stubFetch({
      'POST /api/v1/auth/logout-all': () => new Response(null, { status: 204 }),
    });
    await acc().logoutAll();
    expect(fetch).toHaveBeenCalledOnce();
    expect(acc()).toMatchObject({ status: 'anonymous', me: null, dialog: null });
  });

  it('logout-all con 401 también deja la app en anónimo', async () => {
    useAccountStore.setState({ status: 'signedIn', me });
    stubFetch({ 'POST /api/v1/auth/logout-all': unauthorized });
    await acc().logoutAll();
    expect(acc().status).toBe('anonymous');
  });

  it('logout-all con otro error mantiene la sesión y lo propaga', async () => {
    useAccountStore.setState({ status: 'signedIn', me });
    stubFetch({ 'POST /api/v1/auth/logout-all': () => new Response('', { status: 502 }) });
    await expect(acc().logoutAll()).rejects.toMatchObject({ code: 'unavailable' });
    expect(acc().status).toBe('signedIn');
  });

  it('un error de la vuelta de Google se avisa y se quita de la URL', async () => {
    const replaceState = vi.fn();
    vi.stubGlobal('window', {
      location: {
        search: '?login=error&code=account_exists',
        href: 'http://localhost:5180/?login=error&code=account_exists',
      },
      history: { replaceState },
    });
    stubFetch({
      'GET /api/v1/auth/providers': () => json(200, { google: true }),
      'GET /api/v1/auth/me': unauthorized,
    });
    await acc().init();
    expect(replaceState).toHaveBeenCalledWith(null, '', '/');
    expect(useTableStore.getState().notice).toMatchObject({ tone: 'error' });
    expect(useTableStore.getState().notice?.text).toMatch(/vincula Google desde tu perfil/);
  });
});

describe('nombre visible', () => {
  it('acepta letras latinas, dígitos, _ y - con espacios simples', () => {
    expect(checkDisplayName('José_99')).toBeNull();
    expect(checkDisplayName('  Ñandú-Ü  ')).toBeNull();
    expect(checkDisplayName('Ana María')).toBeNull();
    // Tilde combinada: en NFC es una sola letra.
    expect(checkDisplayName('José')).toBeNull();
  });

  it('rechaza largos, símbolos, espacios dobles y otros alfabetos', () => {
    expect(checkDisplayName('ab')).toMatch(/entre 3 y 20/);
    expect(checkDisplayName('a'.repeat(21))).toMatch(/entre 3 y 20/);
    expect(checkDisplayName('Ana  María')).toMatch(/un solo espacio/);
    expect(checkDisplayName('Ana!')).toMatch(/letras, números/);
    expect(checkDisplayName('Аnа')).toMatch(/letras, números/); // А cirílica
    expect(checkDisplayName('___')).toMatch(/al menos una letra/);
  });
});

describe('vuelta de Google', () => {
  it('lee login/link con su código', () => {
    expect(readOAuthReturn('?login=ok')).toEqual({ kind: 'login', ok: true, code: null });
    expect(readOAuthReturn('?link=error&code=identity_in_use')).toEqual({
      kind: 'link',
      ok: false,
      code: 'identity_in_use',
    });
    expect(readOAuthReturn('?foo=1')).toBeNull();
  });

  it('cancelar no es un error y los códigos desconocidos tienen mensaje genérico', () => {
    expect(oauthErrorNotice('cancelled').tone).toBe('info');
    expect(oauthErrorNotice('google_error').text).toMatch(/No se pudo completar/);
    expect(oauthErrorNotice('algo_nuevo').text).toMatch(/No se pudo completar/);
  });

  it('quita solo sus parámetros de la URL', () => {
    expect(withoutOAuthParams('http://localhost:5180/?login=ok&x=1#a')).toBe('/?x=1#a');
  });
});

describe('vincular y desvincular Google con contraseña', () => {
  const linkedMe: Me = { ...me, providers: ['google'] };
  const forbidden = () =>
    json(403, { code: 'invalid_password', message: 'La contraseña no es correcta.' });

  function stubWindow(search = '') {
    const assign = vi.fn();
    vi.stubGlobal('window', {
      location: { search, href: `http://localhost:5180/${search}`, assign },
      history: { replaceState: vi.fn() },
    });
    return assign;
  }

  beforeEach(() => useAccountStore.setState({ status: 'signedIn', me, dialog: 'linkGoogle' }));

  it('con la contraseña correcta pide la prueba y navega a Google', async () => {
    const assign = stubWindow();
    const fetch = stubFetch({
      'POST /api/v1/auth/google/link-intent': () => new Response(null, { status: 204 }),
    });
    await acc().linkGoogle('secreto123');
    expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual({ password: 'secreto123' });
    expect(assign).toHaveBeenCalledWith('/api/v1/auth/google/start?link=1');
  });

  it('una contraseña incorrecta (403) no cierra la sesión ni navega', async () => {
    const assign = stubWindow();
    stubFetch({ 'POST /api/v1/auth/google/link-intent': forbidden });
    await expect(acc().linkGoogle('mal')).rejects.toMatchObject({ code: 'invalid_password' });
    expect(acc().status).toBe('signedIn');
    expect(assign).not.toHaveBeenCalled();
  });

  it('409 already_linked refresca el usuario y vuelve al perfil', async () => {
    const assign = stubWindow();
    stubFetch({
      'POST /api/v1/auth/google/link-intent': () =>
        json(409, { code: 'already_linked', message: 'Tu cuenta ya tiene Google vinculado.' }),
      'GET /api/v1/auth/me': () => json(200, linkedMe),
    });
    await acc().linkGoogle('secreto123');
    expect(acc().me?.providers).toEqual(['google']);
    expect(acc().dialog).toBe('profile');
    expect(assign).not.toHaveBeenCalled();
    expect(useTableStore.getState().notice?.text).toMatch(/ya tiene Google/);
  });

  it('409 google_disabled oculta Google', async () => {
    stubWindow();
    useAccountStore.setState({ providers: { google: true } });
    stubFetch({
      'POST /api/v1/auth/google/link-intent': () =>
        json(409, { code: 'google_disabled', message: 'Google no está disponible.' }),
    });
    await acc().linkGoogle('secreto123');
    expect(acc().providers.google).toBe(false);
  });

  it('desvincular guarda el usuario sin Google y avisa de las otras sesiones', async () => {
    useAccountStore.setState({ me: linkedMe, dialog: 'unlinkGoogle' });
    stubFetch({ 'POST /api/v1/auth/google/unlink': () => json(200, me) });
    await acc().unlinkGoogle('secreto123');
    expect(acc().me?.providers).toEqual([]);
    expect(acc().dialog).toBe('profile');
    expect(useTableStore.getState().notice?.text).toMatch(/otros dispositivos/);
  });

  it('desvincular con contraseña incorrecta mantiene todo igual', async () => {
    useAccountStore.setState({ me: linkedMe, dialog: 'unlinkGoogle' });
    stubFetch({ 'POST /api/v1/auth/google/unlink': forbidden });
    await expect(acc().unlinkGoogle('mal')).rejects.toMatchObject({ status: 403 });
    expect(acc()).toMatchObject({ status: 'signedIn', me: linkedMe, dialog: 'unlinkGoogle' });
  });

  it('volver con reauth_required reabre el diálogo de contraseña', async () => {
    stubWindow('?link=error&code=reauth_required');
    stubFetch({
      'GET /api/v1/auth/providers': () => json(200, { google: true }),
      'GET /api/v1/auth/me': () => json(200, me),
    });
    await acc().init();
    expect(acc().dialog).toBe('linkGoogle');
    expect(useTableStore.getState().notice?.text).toMatch(/Confirma tu contraseña/);
  });
});
