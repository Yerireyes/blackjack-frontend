import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import { startSoundSync } from '@/app/sounds';
import { startEngineSync } from '@/engine/sync';
import './index.css';

startEngineSync();
startSoundSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
