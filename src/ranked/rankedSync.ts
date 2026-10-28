import { useAccountStore } from '@/account/accountStore';
import { useUiStore } from '@/store/uiStore';
import { useRankedStore } from './rankedStore';

/**
 * Carga Ranked al entrar a su pantalla con sesión. Solo ahí: `GET /ranked/me` crea la
 * cuenta de la temporada, y mirar el inicio no debería crearla. Al volver con la cuenta ya
 * cargada no se recarga (se perdería la revisión de la última mano). Al perder la sesión
 * limpia lo que quedó del servidor.
 */
export function startRankedSync() {
  const check = () => {
    const ranked = useUiStore.getState().screen === 'ranked';
    const signedIn = useAccountStore.getState().status === 'signedIn';
    const store = useRankedStore.getState();
    if (ranked && signedIn && (store.status === 'idle' || store.status === 'unavailable')) {
      void store.enter();
    }
    if (!signedIn && store.status !== 'idle') store.reset();
    // El ranking es público: se muestra aunque no haya sesión.
    if (ranked && !signedIn && !store.board) void store.loadBoard();
  };
  useUiStore.subscribe((s, prev) => s.screen !== prev.screen && check());
  useAccountStore.subscribe((s, prev) => s.status !== prev.status && check());
  check();
}
