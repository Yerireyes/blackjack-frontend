import { normalizeCode } from '@/rooms/api';
import { useUiStore, type Screen } from '@/store/uiStore';

// Cada pantalla tiene su dirección (#/casual, #/ranked, #/reto, #/practicar, #/logros, #/salas):
// recargar deja al usuario donde estaba y el botón Atrás del navegador vuelve al inicio. Una
// sala tiene la suya (#/salas/K7Q2XP): es el enlace de invitación.
const HASHES: Record<Screen, string> = {
  home: '',
  practice: '#/practicar',
  casual: '#/casual',
  ranked: '#/ranked',
  daily: '#/reto',
  progress: '#/logros',
  rooms: '#/salas',
  stats: '#/estadisticas',
};
/** Direcciones de versiones anteriores que siguen funcionando. */
const ALIASES: Record<string, Screen> = { '#/jugar': 'casual' };
const TITLES: Record<Screen, string> = {
  home: 'Blackjack Guide',
  practice: 'Práctica · Blackjack Guide',
  casual: 'Casual · Blackjack Guide',
  ranked: 'Ranked · Blackjack Guide',
  daily: 'Reto diario · Blackjack Guide',
  progress: 'Logros · Blackjack Guide',
  rooms: 'Salas · Blackjack Guide',
  stats: 'Tu juego · Blackjack Guide',
};

export interface Route {
  screen: Screen;
  /** Solo en Salas: la sala abierta (o null en el lobby). */
  roomCode: string | null;
}

export function routeFromHash(hash: string): Route {
  const room = /^#\/salas\/([^/]+)$/i.exec(hash);
  if (room) {
    const code = normalizeCode(decodeURIComponent(room[1]!));
    return { screen: 'rooms', roomCode: code || null };
  }
  const found = (Object.keys(HASHES) as Screen[]).find((s) => HASHES[s] && HASHES[s] === hash);
  return { screen: found ?? ALIASES[hash] ?? 'home', roomCode: null };
}

export const screenFromHash = (hash: string): Screen => routeFromHash(hash).screen;

export const hashOf = ({ screen, roomCode }: Route) =>
  screen === 'rooms' && roomCode ? `${HASHES.rooms}/${roomCode}` : HASHES[screen];

const titleOf = ({ screen, roomCode }: Route) =>
  screen === 'rooms' && roomCode ? `Sala ${roomCode} · Blackjack Guide` : TITLES[screen];

const apply = (route: Route) => useUiStore.getState().go(route.screen, route.roomCode);

export function startRouteSync() {
  apply(routeFromHash(location.hash));
  document.title = titleOf(useUiStore.getState());

  useUiStore.subscribe((s, prev) => {
    if (s.screen === prev.screen && s.roomCode === prev.roomCode) return;
    document.title = titleOf(s);
    if (hashOf(routeFromHash(location.hash)) === hashOf(s)) return;
    // Sin hash, la dirección queda limpia (sin un "#" suelto al final).
    const url = `${location.pathname}${location.search}${hashOf(s)}`;
    history.pushState(null, '', url);
  });
  addEventListener('popstate', () => apply(routeFromHash(location.hash)));
}
