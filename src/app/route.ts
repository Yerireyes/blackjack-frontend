import { useUiStore, type Screen } from '@/store/uiStore';

// Cada pantalla tiene su dirección (#/jugar, #/practicar): recargar deja al usuario donde
// estaba y el botón Atrás del navegador vuelve al inicio.
const HASHES: Record<Screen, string> = { home: '', practice: '#/practicar', casual: '#/jugar' };
const TITLES: Record<Screen, string> = {
  home: 'Blackjack Guide',
  practice: 'Práctica · Blackjack Guide',
  casual: 'Jugar · Blackjack Guide',
};

export function screenFromHash(hash: string): Screen {
  const found = (Object.keys(HASHES) as Screen[]).find((s) => HASHES[s] && HASHES[s] === hash);
  return found ?? 'home';
}

export function startRouteSync() {
  const ui = useUiStore.getState();
  ui.setScreen(screenFromHash(location.hash));
  document.title = TITLES[useUiStore.getState().screen];

  useUiStore.subscribe((s, prev) => {
    if (s.screen === prev.screen) return;
    document.title = TITLES[s.screen];
    if (screenFromHash(location.hash) === s.screen) return;
    // Sin hash, la dirección queda limpia (sin un "#" suelto al final).
    const url = `${location.pathname}${location.search}${HASHES[s.screen]}`;
    history.pushState(null, '', url);
  });
  addEventListener('popstate', () =>
    useUiStore.getState().setScreen(screenFromHash(location.hash)),
  );
}
