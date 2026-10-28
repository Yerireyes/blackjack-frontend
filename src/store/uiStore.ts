import { create } from 'zustand';
import { useShoeStore } from './shoeStore';

export type Mode = 'player' | 'dealer';
export type Source = 'simulation' | 'manual';

export interface UiState {
  mode: Mode;
  source: Source;
  /** Modo dealer: "Conozco mi carta oculta". */
  knowHole: boolean;
  /** Asientos de bots en simulación (0–6). */
  botSeats: number;
  /** Efectos de sonido activados (se recuerda en este navegador). */
  sound: boolean;
  setMode(mode: Mode): void;
  setSource(source: Source): void;
  setKnowHole(on: boolean): void;
  setBotSeats(n: number): void;
  setSound(on: boolean): void;
}

const SOUND_KEY = 'bj.sound';

function readSound(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

export const useUiStore = create<UiState>()((set) => ({
  mode: 'player',
  source: 'simulation',
  knowHole: false,
  botSeats: 0,
  sound: readSound(),

  // Cambiar de modo NO toca el zapato ni la mesa: solo cambia qué se le pregunta al motor.
  setMode: (mode) => set({ mode }),
  setSource: (source) => set({ source }),
  setKnowHole(knowHole) {
    set({ knowHole });
    useShoeStore.getState().bump();
  },
  setBotSeats: (n) => set({ botSeats: Math.max(0, Math.min(6, Math.round(n))) }),
  setSound(sound) {
    set({ sound });
    try {
      localStorage.setItem(SOUND_KEY, sound ? 'on' : 'off');
    } catch {
      // Sin almacenamiento (modo privado): la preferencia dura solo esta sesión.
    }
  },
}));
