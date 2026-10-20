import type { Action } from '@/engine/contract';

export const ACTION_LABEL: Record<Action, string> = {
  hit: 'Pedir',
  stand: 'Plantarse',
  double: 'Doblar',
  split: 'Dividir',
  surrender: 'Rendirse',
};

/** Atajos de teclado (H pedir, S plantarse, D doblar, P dividir, R rendirse). */
export const ACTION_KEY: Record<Action, string> = {
  hit: 'H',
  stand: 'S',
  double: 'D',
  split: 'P',
  surrender: 'R',
};

export const ACTION_ORDER: readonly Action[] = ['hit', 'stand', 'double', 'split', 'surrender'];
