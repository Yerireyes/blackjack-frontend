import { useAccountStore } from '@/account/accountStore';
import { useUiStore } from '@/store/uiStore';
import { useDailyStore } from './dailyStore';

/**
 * Carga el reto en el inicio y en su pantalla, con sesión: `GET /daily/me` no crea nada, y el
 * inicio muestra si el de hoy está por empezar, en juego o terminado. Al volver con el intento
 * ya cargado no se recarga (se perdería la revisión de la última mano). Al perder la sesión
 * limpia lo que quedó del servidor.
 */
export function startDailySync() {
  const check = () => {
    const screen = useUiStore.getState().screen;
    const wanted = screen === 'home' || screen === 'daily';
    const signedIn = useAccountStore.getState().status === 'signedIn';
    const store = useDailyStore.getState();
    if (wanted && signedIn && (store.status === 'idle' || store.status === 'unavailable')) {
      void store.enter();
    }
    if (!signedIn && store.status !== 'idle') store.reset();
    // El ranking del día es público: se muestra aunque no haya sesión.
    if (screen === 'daily' && !signedIn && !store.board) void store.loadBoard();
  };
  useUiStore.subscribe((s, prev) => s.screen !== prev.screen && check());
  useAccountStore.subscribe((s, prev) => s.status !== prev.status && check());
  check();
}
