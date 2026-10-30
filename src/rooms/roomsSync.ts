import { useAccountStore } from '@/account/accountStore';
import { useUiStore } from '@/store/uiStore';
import { useRoomsStore } from './roomsStore';

const LOBBY_REFRESH_MS = 8000;

/**
 * La dirección manda: en #/salas/CODE (con sesión) se conecta a esa sala; al salir de ella,
 * se cierra el WebSocket. En el lobby, la lista de salas públicas se refresca sola.
 */
export function startRoomsSync() {
  let lobbyTimer: ReturnType<typeof setInterval> | null = null;

  const check = () => {
    const { screen, roomCode } = useUiStore.getState();
    const signedIn = useAccountStore.getState().status === 'signedIn';
    const store = useRoomsStore.getState();
    const want = screen === 'rooms' && signedIn ? roomCode : null;
    if (want && store.code !== want) store.join(want);
    if (!want && store.code) store.leave();

    const lobby = screen === 'rooms' && !roomCode;
    if (lobby && !lobbyTimer) {
      void store.loadLobby();
      lobbyTimer = setInterval(() => void useRoomsStore.getState().loadLobby(), LOBBY_REFRESH_MS);
    }
    if (!lobby && lobbyTimer) {
      clearInterval(lobbyTimer);
      lobbyTimer = null;
    }
  };
  useUiStore.subscribe(
    (s, prev) => (s.screen !== prev.screen || s.roomCode !== prev.roomCode) && check(),
  );
  useAccountStore.subscribe((s, prev) => s.status !== prev.status && check());
  check();
}
