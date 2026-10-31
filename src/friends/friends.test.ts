import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccountStore } from '@/account/accountStore';
import type { Me } from '@/account/types';
import { useDailyStore } from '@/daily/dailyStore';
import type { FriendsView } from '@/engine/contract';
import { json, stubFetch } from '@/tests/server';
import { badgeOf, useFriendsStore } from './friendsStore';

const me: Me = {
  id: 'u1',
  email: 'ana@example.com',
  displayName: 'Ana',
  needsDisplayName: false,
  hasPassword: true,
  providers: [],
  createdAt: '2026-10-27T12:00:00Z',
  isAdmin: false,
};

const room = {
  code: 'K7Q2XP',
  name: 'Mesa de Beto',
  visibility: 'private' as const,
  host: 'Beto',
  seats: 7,
  seated: 1,
  spectators: 0,
  maxSpectators: 10,
  rules: {} as never,
  aids: true,
  createdAt: '2026-10-31T10:00:00Z',
};

const view = (over: Partial<FriendsView> = {}): FriendsView => ({
  friends: [
    { user: { id: 'u2', displayName: 'Beto' }, online: true, since: '2026-10-30T10:00:00Z' },
  ],
  incoming: [{ user: { id: 'u3', displayName: 'Caro' }, at: '2026-10-31T09:00:00Z' }],
  outgoing: [],
  invitations: [
    { id: 'inv-1', from: { id: 'u2', displayName: 'Beto' }, room, at: '2026-10-31T10:00:00Z' },
  ],
  ...over,
});

const fs = () => useFriendsStore.getState();

beforeEach(() => {
  useAccountStore.setState({ status: 'signedIn', me, dialog: null });
  fs().reset();
});
afterEach(() => vi.unstubAllGlobals());

describe('amigos', () => {
  it('el globo suma solicitudes recibidas e invitaciones', async () => {
    stubFetch({ 'GET /friends': () => json(200, view()) });
    await fs().load();
    expect(badgeOf(fs())).toBe(2);
  });

  it('pedir amistad por nombre: los errores con el mensaje de la guía', async () => {
    stubFetch({
      'POST /friends/requests': [
        () => json(404, { code: 'user_not_found', message: 'x' }),
        () => new Response(null, { status: 202 }),
      ],
      'GET /friends': () => json(200, view()),
    });
    expect(await fs().request('Nadie')).toBe('No hay nadie con ese nombre.');
    expect(await fs().request(' Beto ')).toBeNull();
  });

  it('aceptar, invitar y descartar llaman a su ruta y recargan la lista', async () => {
    const calls = stubFetch({
      'POST /friends/requests/u3/accept': () => new Response(null, { status: 204 }),
      'POST /rooms/K7Q2XP/invite': () => new Response(null, { status: 204 }),
      'POST /me/invitations/inv-1/dismiss': () => new Response(null, { status: 204 }),
      'GET /friends': () => json(200, view({ incoming: [], invitations: [] })),
    });
    await fs().accept('u3');
    expect(await fs().invite('K7Q2XP', 'u2')).toBe(true);
    await fs().dismiss('inv-1');
    expect(calls.find((c) => c.key === 'POST /rooms/K7Q2XP/invite')?.body).toEqual({
      userId: 'u2',
    });
    await vi.waitFor(() => expect(badgeOf(fs())).toBe(0));
  });
});

describe('reto entre amigos', () => {
  it('la pestaña Amigos pide el ranking con scope=friends', async () => {
    const calls = stubFetch({
      'GET /daily/leaderboard?scope=friends': () => json(200, { day: '2026-10-31', top: [] }),
      'GET /daily/leaderboard?day=2026-10-30&scope=friends': () =>
        json(200, { day: '2026-10-30', top: [] }),
    });
    useDailyStore.setState({ boardDay: null });
    await useDailyStore.getState().setBoardScope('friends');
    await useDailyStore.getState().loadBoard('2026-10-30');
    expect(calls.map((c) => c.key)).toEqual([
      'GET /daily/leaderboard?scope=friends',
      'GET /daily/leaderboard?day=2026-10-30&scope=friends',
    ]);
    useDailyStore.setState({ boardScope: 'all' });
  });
});
