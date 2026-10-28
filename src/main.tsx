import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useAccountStore } from '@/account/accountStore';
import { App } from '@/app/App';
import { startSoundSync } from '@/app/sounds';
import { startEngineSync } from '@/engine/sync';
import './index.css';

startEngineSync();
startSoundSync();
void useAccountStore.getState().init();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
