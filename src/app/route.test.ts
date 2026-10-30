// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { parseVolume, useUiStore } from '@/store/uiStore';
import { screenFromHash, startRouteSync } from './route';

describe('pantallas', () => {
  afterEach(() => useUiStore.setState({ screen: 'home' }));

  it('lee la pantalla de la dirección', () => {
    expect(screenFromHash('')).toBe('home');
    expect(screenFromHash('#/practicar')).toBe('practice');
    expect(screenFromHash('#/casual')).toBe('casual');
    expect(screenFromHash('#/ranked')).toBe('ranked');
    // La dirección anterior de Casual sigue funcionando.
    expect(screenFromHash('#/jugar')).toBe('casual');
    // Una dirección desconocida lleva al inicio, no a una pantalla en blanco.
    expect(screenFromHash('#/otra')).toBe('home');
  });

  it('cada pantalla deja su entrada en el historial y Atrás vuelve', () => {
    history.replaceState(null, '', '/#/casual');
    startRouteSync();
    expect(useUiStore.getState().screen).toBe('casual');

    useUiStore.getState().setScreen('home');
    expect(location.hash).toBe('');
    expect(document.title).toBe('Blackjack Guide');

    useUiStore.getState().setScreen('practice');
    expect(location.hash).toBe('#/practicar');

    history.replaceState(null, '', '/');
    dispatchEvent(new PopStateEvent('popstate'));
    expect(useUiStore.getState().screen).toBe('home');
  });
});

describe('ajustes', () => {
  it('el volumen guardado se acota y por defecto es 0,7', () => {
    expect(parseVolume(null)).toBe(0.7);
    expect(parseVolume('basura')).toBe(0.7);
    expect(parseVolume('0.3')).toBe(0.3);
    expect(parseVolume('4')).toBe(1);
    expect(parseVolume('-1')).toBe(0);
  });

  it('las preferencias se recuerdan en este navegador', () => {
    useUiStore.getState().setVolume(0.25);
    useUiStore.getState().setMotion('reduced');
    expect(localStorage.getItem('bj.volume')).toBe('0.25');
    expect(localStorage.getItem('bj.motion')).toBe('reduced');
  });
});
