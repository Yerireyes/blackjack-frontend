import { create } from 'zustand';
import { setVolume } from '@/lib/sound';
import { useShoeStore } from './shoeStore';

export type Mode = 'player' | 'dealer';
export type Source = 'simulation' | 'manual';
/**
 * Inicio: elegir qué hacer. Práctica: en el navegador y sin cuenta. Casual y Ranked: contra
 * el servidor, con cuenta (Ranked, sin ayudas y por temporadas).
 */
export type Screen = 'home' | 'practice' | 'casual' | 'ranked';
/** Animaciones: las del sistema operativo o siempre reducidas. */
export type Motion = 'system' | 'reduced';

export interface UiState {
  screen: Screen;
  mode: Mode;
  source: Source;
  /** Modo dealer: "Conozco mi carta oculta". */
  knowHole: boolean;
  /** Asientos de bots en simulación (0–6). */
  botSeats: number;
  // Preferencias: se recuerdan en este navegador.
  /** Efectos de sonido activados. */
  sound: boolean;
  /** Volumen de los efectos, de 0 a 1. */
  volume: number;
  motion: Motion;
  settingsOpen: boolean;
  setScreen(screen: Screen): void;
  setMode(mode: Mode): void;
  setSource(source: Source): void;
  setKnowHole(on: boolean): void;
  setBotSeats(n: number): void;
  setSound(on: boolean): void;
  setVolume(volume: number): void;
  setMotion(motion: Motion): void;
  setSettingsOpen(open: boolean): void;
}

/** En modo dealer con simulación tu asiento lo juega el motor: el usuario es el repartidor. */
export const autoPlaysPlayer = () => {
  const ui = useUiStore.getState();
  return ui.screen === 'practice' && ui.mode === 'dealer' && ui.source === 'simulation';
};

const SOUND_KEY = 'bj.sound';
const VOLUME_KEY = 'bj.volume';
const MOTION_KEY = 'bj.motion';
export const DEFAULT_VOLUME = 0.7;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento (modo privado): la preferencia dura solo esta sesión.
  }
}

export function parseVolume(raw: string | null): number {
  const v = raw === null ? NaN : Number(raw);
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULT_VOLUME;
}

const initialVolume = parseVolume(read(VOLUME_KEY));
setVolume(initialVolume);

export const useUiStore = create<UiState>()((set) => ({
  screen: 'home',
  mode: 'player',
  source: 'simulation',
  knowHole: false,
  botSeats: 0,
  sound: read(SOUND_KEY) !== 'off',
  volume: initialVolume,
  motion: read(MOTION_KEY) === 'reduced' ? 'reduced' : 'system',
  settingsOpen: false,

  // Cambiar de pantalla no toca la mesa de Práctica: queda como estaba al volver.
  setScreen: (screen) => set({ screen }),
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
    save(SOUND_KEY, sound ? 'on' : 'off');
  },
  setVolume(volume) {
    const v = Math.min(1, Math.max(0, volume));
    set({ volume: v });
    setVolume(v);
    save(VOLUME_KEY, String(v));
  },
  setMotion(motion) {
    set({ motion });
    save(MOTION_KEY, motion);
  },
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
}));
