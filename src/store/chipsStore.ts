import { create } from 'zustand';

// Fichas de la simulación. Dos bancas: la tuya (modo jugador) y la de la casa (modo dealer,
// contra el jugador automático). La apuesta es la pila de fichas que hay sobre la mesa.
// Todo son enteros: las fichas son múltiplos de 10, así que 3:2 (15), 6:5 (12) y rendirse
// (5) pagan siempre fichas enteras.

export const CHIP_VALUES = [10, 50, 100, 500] as const;
export type ChipValue = (typeof CHIP_VALUES)[number];
export const START_CHIPS = 1000;
export const MIN_BET = 10;
export const MAX_BET = 500;
/** Fichas que caben en la pila: con fichas de 10 la apuesta no pasa de 100. */
export const MAX_STACK = 10;
/** Tope de cada banca: lo que exceda no se acredita. */
export const MAX_CHIPS = 1_000_000;

export type Bank = 'player' | 'house';

export interface Chip {
  id: number;
  value: ChipValue;
}

export type RoundStart = 'ok' | 'empty' | 'broke';

export interface ChipsState {
  player: number;
  house: number;
  /** Pilas sobre la mesa: la tuya y la del jugador automático. */
  stacks: Record<Bank, Chip[]>;
  /** Apuesta de la ronda en curso; se liquida al terminar, nunca se descuenta antes. */
  round: { bank: Bank; stake: number } | null;
  /** Último resultado, desde el punto de vista de su banca. */
  last: { bank: Bank; amount: number } | null;
  /** Fichas que ganaste o perdiste en esta sesión (tu banca). */
  sessionChips: number;
  /** Pone una ficha en la pila. Devuelve su id, o null si no cabe o no alcanza. */
  addChip(bank: Bank, value: ChipValue): number | null;
  /** Retira la ficha de arriba. */
  removeChip(bank: Bank): void;
  clearStack(bank: Bank): void;
  /** Fija la apuesta de la ronda con la pila actual (recortada al saldo si hace falta). */
  startRound(bank: Bank): RoundStart;
  /** Liquida la ronda: `net` en unidades de la apuesta (lo que devuelve settleHand). */
  settle(net: number): void;
  cancelRound(): void;
  /** Unidades de apuesta extra (doblar, dividir) que la banca puede cubrir. */
  spareUnits(committedUnits: number): number;
  refill(bank: Bank): void;
}

const STORAGE_KEY = 'bj.chips';

export const stackTotal = (stack: readonly Chip[]) => stack.reduce((n, c) => n + c.value, 0);

/** ¿Cabe otra ficha de este valor? Límite de pila, de mesa y de saldo. */
export function canAddChip(stack: readonly Chip[], value: number, balance: number) {
  const total = stackTotal(stack) + value;
  return stack.length < MAX_STACK && total <= MAX_BET && total <= balance;
}

const clampChips = (n: number) => Math.max(0, Math.min(MAX_CHIPS, Math.round(n)));

let chipId = 0;
const newChip = (value: ChipValue): Chip => ({ id: ++chipId, value });

const isChips = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= MAX_CHIPS;
const isChipValue = (n: unknown): n is ChipValue => CHIP_VALUES.includes(n as ChipValue);

/** Una pila guardada válida: fichas conocidas, dentro de los límites de pila y de mesa. */
function parseStack(raw: unknown): Chip[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_STACK || !raw.every(isChipValue)) return null;
  const stack = raw.map(newChip);
  return stackTotal(stack) <= MAX_BET ? stack : null;
}

interface Saved {
  player: number;
  house: number;
  stacks: Record<Bank, Chip[]>;
}

const defaults = (): Saved => ({
  player: START_CHIPS,
  house: START_CHIPS,
  stacks: { player: [newChip(10)], house: [newChip(10)] },
});

/** Lee lo guardado y descarta cualquier valor inválido (editado a mano, NaN, negativo…). */
export function parseSaved(raw: string | null): Saved {
  const d = defaults();
  if (!raw) return d;
  try {
    const s = JSON.parse(raw) as { player?: unknown; house?: unknown; stacks?: unknown };
    const stacks = (s.stacks ?? {}) as Partial<Record<Bank, unknown>>;
    return {
      player: isChips(s.player) ? s.player : d.player,
      house: isChips(s.house) ? s.house : d.house,
      stacks: {
        player: parseStack(stacks.player) ?? d.stacks.player,
        house: parseStack(stacks.house) ?? d.stacks.house,
      },
    };
  } catch {
    return d;
  }
}

function load(): Saved {
  try {
    return parseSaved(localStorage.getItem(STORAGE_KEY));
  } catch {
    return defaults();
  }
}

export const useChipsStore = create<ChipsState>()((set, get) => {
  const setStack = (bank: Bank, stack: Chip[]) =>
    set((s) => ({ stacks: { ...s.stacks, [bank]: stack } }));

  return {
    ...load(),
    round: null,
    last: null,
    sessionChips: 0,

    addChip(bank, value) {
      const s = get();
      // Durante la ronda la apuesta no se toca.
      if (s.round || !canAddChip(s.stacks[bank], value, s[bank])) return null;
      const chip = newChip(value);
      setStack(bank, [...s.stacks[bank], chip]);
      return chip.id;
    },

    removeChip(bank) {
      const s = get();
      if (s.round || s.stacks[bank].length === 0) return;
      setStack(bank, s.stacks[bank].slice(0, -1));
    },

    clearStack(bank) {
      if (get().round) return;
      setStack(bank, []);
    },

    startRound(bank) {
      const s = get();
      const balance = s[bank];
      if (balance < MIN_BET) return 'broke';
      // Si perdiste y la pila ya no está cubierta, se retiran fichas de arriba.
      const stack = s.stacks[bank].slice();
      while (stackTotal(stack) > balance) stack.pop();
      if (stack.length !== s.stacks[bank].length) setStack(bank, stack);
      const stake = stackTotal(stack);
      if (stake < MIN_BET) return 'empty';
      set({ round: { bank, stake } });
      return 'ok';
    },

    settle(net) {
      const { round } = get();
      if (!round) return;
      const amount = Math.round(net * round.stake);
      if (round.bank === 'player') {
        set((s) => ({
          player: clampChips(s.player + amount),
          sessionChips: s.sessionChips + amount,
          last: { bank: 'player', amount },
          round: null,
        }));
      } else {
        set((s) => ({
          house: clampChips(s.house - amount),
          last: { bank: 'house', amount: -amount },
          round: null,
        }));
      }
    },

    cancelRound: () => set({ round: null }),

    spareUnits(committedUnits) {
      const { round } = get();
      if (!round) return Infinity;
      return Math.floor((get()[round.bank] - committedUnits * round.stake) / round.stake);
    },

    refill: (bank) => set({ [bank]: START_CHIPS }),
  };
});

useChipsStore.subscribe((s, prev) => {
  if (s.player === prev.player && s.house === prev.house && s.stacks === prev.stacks) return;
  try {
    const values = (b: Bank) => s.stacks[b].map((c) => c.value);
    const saved = {
      player: s.player,
      house: s.house,
      stacks: { player: values('player'), house: values('house') },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Sin almacenamiento: las fichas duran solo esta sesión.
  }
});
