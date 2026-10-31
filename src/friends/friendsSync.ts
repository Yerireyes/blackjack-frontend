import { useAccountStore } from '@/account/accountStore';
import { useFriendsStore } from './friendsStore';

const POLL_MS = 30_000;

/**
 * Sin WebSocket por usuario: con sesión, la lista de amigos se pide al entrar, al volver a la
 * pestaña y cada 30 s mientras esté a la vista. Sin sesión se limpia.
 */
export function startFriendsSync() {
  let timer: ReturnType<typeof setInterval> | null = null;
  const signedIn = () => useAccountStore.getState().status === 'signedIn';

  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
  const start = () => {
    stop();
    void useFriendsStore.getState().load();
    timer = setInterval(() => {
      if (document.visibilityState === 'visible') void useFriendsStore.getState().load();
    }, POLL_MS);
  };

  const check = () => {
    if (signedIn()) start();
    else {
      stop();
      useFriendsStore.getState().reset();
    }
  };
  useAccountStore.subscribe((s, prev) => s.status !== prev.status && check());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && signedIn())
      void useFriendsStore.getState().load();
  });
  check();
}
