import { useEffect } from 'react';
import { casualLocked, useCasualStore } from '@/casual/casualStore';
import { performAction } from '@/features/table/performAction';
import { useTableStore, type PlayerAction } from '@/store/tableStore';
import { useUiStore } from '@/store/uiStore';
import { isTypingTarget } from '@/lib/keys';

const KEYS: Record<string, PlayerAction> = {
  h: 'hit',
  s: 'stand',
  d: 'double',
  p: 'split',
  r: 'surrender',
};

/** Atajos de escritorio: H pedir, S plantarse, D doblar, P dividir, R rendirse, Enter repartir. */
export function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (isTypingTarget(e.target)) return;
      const el = e.target as HTMLElement;
      const action = KEYS[e.key.toLowerCase()];
      const { screen } = useUiStore.getState();
      if (screen === 'home') return;
      if (screen === 'casual') {
        onCasualKey(e, action, el);
        return;
      }
      if (action) {
        e.preventDefault();
        performAction(action);
        return;
      }
      if (e.key === 'Enter' && useUiStore.getState().source === 'simulation') {
        // Enter sobre un botón enfocado ya hace su propia acción.
        if (el.closest('button, a')) return;
        const { phase, deal } = useTableStore.getState();
        if (phase === 'idle' || phase === 'settled') {
          e.preventDefault();
          deal();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Casual: las mismas teclas, pero las intenciones van al servidor. */
function onCasualKey(e: KeyboardEvent, action: PlayerAction | undefined, el: HTMLElement) {
  const c = useCasualStore.getState();
  if (action) {
    e.preventDefault();
    void c.act(action);
    return;
  }
  if (e.key !== 'Enter' || el.closest('button, a')) return;
  if (c.status === 'playing' && !casualLocked(c)) {
    e.preventDefault();
    void c.deal();
  }
}
