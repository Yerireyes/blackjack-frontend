// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccountStore } from '@/account/accountStore';
import type { Me } from '@/account/types';
import type { AchievementId, MyAchievements, MyCosmetics, RoundView } from '@/engine/contract';
import { useTableStore } from '@/store/tableStore';
import { json, stubFetch } from '@/tests/server';
import { themeKey } from './catalog';
import { useProgressStore } from './progressStore';
import { startProgressSync } from './progressSync';

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

const achievements = (ids: AchievementId[] = [], streak = 0): MyAchievements => ({
  unlocked: ids.map((id) => ({ id, unlockedAt: '2026-10-29T10:00:00Z' })),
  optimalStreak: streak,
  bestOptimalStreak: streak,
});

const cosmetics = (over: Partial<MyCosmetics> = {}): MyCosmetics => ({
  owned: ['feltGreen', 'backClassic', 'chipsClassic'],
  equipped: { felt: 'feltGreen', cardBack: 'backClassic', chips: 'chipsClassic', title: null },
  ...over,
});

/** Lo justo de una ronda liquidada para los logros: el modo y `result.unlocked`. */
const settled = (kind: RoundView['kind'], unlocked?: string[]) =>
  ({
    id: 'r-1',
    kind,
    phase: 'settled',
    result: { net: 10, ...(unlocked ? { unlocked } : {}) },
  }) as unknown as RoundView;

const ps = () => useProgressStore.getState();

beforeEach(() => {
  useAccountStore.setState({ status: 'signedIn', me, dialog: null });
  ps().reset();
});
afterEach(() => vi.unstubAllGlobals());

describe('logros', () => {
  it('avisa una vez por logro nuevo; la respuesta repetida no lo vuelve a anunciar', async () => {
    const calls = stubFetch({
      'GET /me/achievements': () => json(200, achievements(['firstWin', 'blackjack'])),
      'GET /me/cosmetics': () =>
        json(200, cosmetics({ owned: [...cosmetics().owned, 'titleRookie'] })),
    });
    ps().settled(settled('casual', ['firstWin', 'blackjack', 'logroDelFuturo']));
    // El id desconocido no se anuncia ni rompe nada.
    expect(ps().toasts.map((t) => t.id)).toEqual(['firstWin', 'blackjack']);
    await vi.waitFor(() => expect(ps().cosmetics?.owned).toContain('titleRookie'));
    expect(ps().achievements?.unlocked).toHaveLength(2);

    // Idempotencia: la misma respuesta otra vez.
    ps().settled(settled('casual', ['firstWin', 'blackjack']));
    expect(ps().toasts).toHaveLength(2);
    expect(calls.filter((c) => c.key === 'GET /me/cosmetics').length).toBeGreaterThan(0);
  });

  it('no anuncia lo que ya tenía al entrar', async () => {
    stubFetch({
      'GET /me/achievements': () => json(200, achievements(['firstWin'])),
      'GET /me/cosmetics': () => json(200, cosmetics()),
    });
    await ps().load();
    expect(ps().status).toBe('ready');
    ps().settled(settled('casual', ['firstWin']));
    expect(ps().toasts).toHaveLength(0);
  });

  it('tras una ronda de Ranked o del reto refresca la racha; tras Casual sin logros, no', async () => {
    const calls = stubFetch({
      'GET /me/achievements': () => json(200, achievements([], 7)),
    });
    ps().settled(settled('casual'));
    expect(calls).toHaveLength(0);

    ps().settled(settled('ranked'));
    await vi.waitFor(() => expect(ps().achievements?.optimalStreak).toBe(7));
    ps().settled(settled('daily'));
    expect(calls.map((c) => c.key)).toEqual(['GET /me/achievements', 'GET /me/achievements']);
  });

  it('sin sesión no hace nada', () => {
    useAccountStore.setState({ status: 'anonymous', me: null });
    const calls = stubFetch({});
    ps().settled(settled('casual', ['firstWin']));
    expect(ps().toasts).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });
});

describe('cosméticos', () => {
  it('manda lo puesto completo y se queda con lo que guardó el servidor', async () => {
    useProgressStore.setState({
      cosmetics: cosmetics({ owned: [...cosmetics().owned, 'titleRookie'] }),
    });
    const calls = stubFetch({
      'PUT /me/cosmetics': (body) =>
        json(
          200,
          cosmetics({
            owned: [...cosmetics().owned, 'titleRookie'],
            equipped: body as MyCosmetics['equipped'],
          }),
        ),
    });
    await ps().equip('title', 'titleRookie');
    expect(calls[0]!.body).toEqual({
      felt: 'feltGreen',
      cardBack: 'backClassic',
      chips: 'chipsClassic',
      title: 'titleRookie',
    });
    expect(ps().cosmetics?.equipped.title).toBe('titleRookie');

    await ps().equip('title', null);
    expect((calls[1]!.body as MyCosmetics['equipped']).title).toBeNull();
  });

  it('cosmetic_locked vuelve a lo que había, avisa y recarga', async () => {
    useProgressStore.setState({ cosmetics: cosmetics() });
    const calls = stubFetch({
      'PUT /me/cosmetics': () => json(409, { code: 'cosmetic_locked', message: 'No.' }),
      'GET /me/cosmetics': () => json(200, cosmetics()),
    });
    await ps().equip('felt', 'feltBlue');
    expect(ps().cosmetics?.equipped.felt).toBe('feltGreen');
    expect(useTableStore.getState().notice?.text).toMatch(/Todavía no lo desbloqueaste/);
    await vi.waitFor(() => expect(calls.some((c) => c.key === 'GET /me/cosmetics')).toBe(true));
  });

  it('lo puesto se aplica en <html>; al cerrar sesión vuelve lo de serie', async () => {
    stubFetch({
      'GET /cosmetics': () => json(200, []),
      'GET /me/achievements': () => json(200, achievements()),
      'GET /me/cosmetics': () =>
        json(
          200,
          cosmetics({
            equipped: { felt: 'feltBlue', cardBack: 'backGold', chips: 'chipsNeon', title: null },
          }),
        ),
    });
    startProgressSync();
    const root = document.documentElement.dataset;
    await vi.waitFor(() => expect(root.felt).toBe('blue'));
    expect(root).toMatchObject({ back: 'gold', chips: 'neon' });

    useAccountStore.setState({ status: 'anonymous', me: null });
    expect(root).toMatchObject({ felt: 'green', back: 'classic', chips: 'classic' });
  });

  it('nombra cada cosmético como lo espera index.css', () => {
    expect(themeKey('feltBlack')).toBe('black');
    expect(themeKey('backMidnight')).toBe('midnight');
    expect(themeKey('chipsGold')).toBe('gold');
  });
});
