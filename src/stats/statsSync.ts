import { useAccountStore } from '@/account/accountStore';
import { useUiStore } from '@/store/uiStore';
import { useStatsStore } from './statsStore';
import { useTrainingStore } from './trainingStore';

/**
 * En «Tu juego» (con sesión) se piden las estadísticas y la primera página del historial;
 * al volver se refrescan (puede haber rondas nuevas). Sin sesión se limpia todo y se termina
 * el entrenamiento.
 */
export function startStatsSync() {
  const check = () => {
    const signedIn = useAccountStore.getState().status === 'signedIn';
    const store = useStatsStore.getState();
    if (!signedIn) {
      if (store.statsStatus !== 'idle' || store.historyStatus !== 'idle') store.reset();
      if (useTrainingStore.getState().active) useTrainingStore.getState().stop();
      return;
    }
    if (useUiStore.getState().screen === 'stats') {
      void store.loadStats();
      void store.setKind(store.kind);
    }
  };
  useUiStore.subscribe((s, prev) => s.screen !== prev.screen && check());
  useAccountStore.subscribe((s, prev) => s.status !== prev.status && check());
  check();
}
