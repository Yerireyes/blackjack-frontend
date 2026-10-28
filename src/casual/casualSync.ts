import { useAccountStore } from '@/account/accountStore';
import { useUiStore } from '@/store/uiStore';
import { useCasualStore } from './casualStore';

/**
 * Entra a Casual cuando el usuario está en ese modo y con sesión: pide la partida y la
 * ronda activas (para retomarlas). Al perder la sesión limpia lo que quedó del servidor.
 */
export function startCasualSync() {
  let playing = false;
  const check = () => {
    const casual = useUiStore.getState().venue === 'casual';
    const signedIn = useAccountStore.getState().status === 'signedIn';
    const next = casual && signedIn;
    if (next && !playing) void useCasualStore.getState().enter();
    if (!signedIn && useCasualStore.getState().status !== 'idle') useCasualStore.getState().reset();
    // El ranking semanal es público: se muestra aunque no haya sesión.
    if (casual && !signedIn && !useCasualStore.getState().board) {
      void useCasualStore.getState().loadBoards();
    }
    playing = next;
  };
  useUiStore.subscribe((s, prev) => s.venue !== prev.venue && check());
  useAccountStore.subscribe((s, prev) => s.status !== prev.status && check());
  check();
}
