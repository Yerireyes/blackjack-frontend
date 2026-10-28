import { useAccountStore } from '@/account/accountStore';
import { useUiStore } from '@/store/uiStore';
import { useCasualStore } from './casualStore';

/**
 * Carga Casual cuando el usuario está en el inicio o en Casual y tiene sesión: pide la
 * partida y la ronda activas (el inicio ofrece continuarlas; Casual las retoma). Al perder
 * la sesión limpia lo que quedó del servidor.
 */
export function startCasualSync() {
  let loaded = false;
  const check = () => {
    const screen = useUiStore.getState().screen;
    const wanted = screen !== 'practice';
    const signedIn = useAccountStore.getState().status === 'signedIn';
    const next = wanted && signedIn;
    if (next && !loaded) void useCasualStore.getState().enter();
    if (!signedIn && useCasualStore.getState().status !== 'idle') useCasualStore.getState().reset();
    // El ranking semanal es público: se muestra aunque no haya sesión.
    if (wanted && !signedIn && !useCasualStore.getState().board) {
      void useCasualStore.getState().loadBoards();
    }
    loaded = next;
  };
  useUiStore.subscribe((s, prev) => s.screen !== prev.screen && check());
  useAccountStore.subscribe((s, prev) => s.status !== prev.status && check());
  check();
}
