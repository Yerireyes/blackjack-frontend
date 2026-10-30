import { useAccountStore } from '@/account/accountStore';
import { useUiStore } from '@/store/uiStore';
import { themeKey } from './catalog';
import { equippedOf, useProgressStore } from './progressStore';

/**
 * Con sesión, carga logros y cosméticos; sin ella, vuelve a lo de serie. Lo puesto se
 * aplica en <html> (`data-felt`, `data-back`, `data-chips`) y index.css cambia los colores:
 * así se ve igual en todos los modos, también en Práctica.
 */
export function startProgressSync() {
  const account = () => {
    const signedIn = useAccountStore.getState().status === 'signedIn';
    const store = useProgressStore.getState();
    if (signedIn && store.status === 'idle') void store.load();
    if (!signedIn && store.status !== 'idle') store.reset();
  };
  useAccountStore.subscribe((s, prev) => s.status !== prev.status && account());
  account();

  // El catálogo es público: dice qué logro desbloquea cada cosmético (pantalla de logros y
  // avisos). Si falló, se reintenta al entrar a la pantalla de logros.
  void useProgressStore.getState().loadCatalog();
  useUiStore.subscribe((s, prev) => {
    const store = useProgressStore.getState();
    if (s.screen !== prev.screen && s.screen === 'progress' && !store.catalog) {
      void store.loadCatalog();
    }
  });

  const apply = () => {
    const { felt, cardBack, chips } = equippedOf(useProgressStore.getState());
    const root = document.documentElement.dataset;
    root.felt = themeKey(felt);
    root.back = themeKey(cardBack);
    root.chips = themeKey(chips);
  };
  useProgressStore.subscribe((s, prev) => s.cosmetics !== prev.cosmetics && apply());
  apply();
}
