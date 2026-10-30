import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useAccountStore } from '@/account/accountStore';
import { App } from '@/app/App';
import { startRouteSync } from '@/app/route';
import { startSoundSync } from '@/app/sounds';
import { startCasualSync } from '@/casual/casualSync';
import { startDailySync } from '@/daily/dailySync';
import { startEngineSync } from '@/engine/sync';
import { startProgressSync } from '@/progress/progressSync';
import { startRankedSync } from '@/ranked/rankedSync';
import './index.css';

// Primero la pantalla (de la dirección): de ella dependen la sincronización y Casual.
startRouteSync();
startEngineSync();
startSoundSync();
void useAccountStore.getState().init();
startCasualSync();
startRankedSync();
startDailySync();
startProgressSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
