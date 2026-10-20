import { create } from 'zustand';
import { FACE_NAME, toRankIndex, type Card, type Face } from '@/domain/cards';
import { createCards, createShoe, faceCapacity, toCounts, type Counts } from '@/domain/shoe';
import type { RandomInt } from '@/domain/shuffle';

export class ShoeError extends Error {
  override name = 'ShoeError';
}

export interface ShoeState {
  decks: number;
  /** Cartas sin repartir. En simulación, la de arriba es la última. */
  remaining: Card[];
  /** Repartidas boca abajo (la oculta del dealer): siguen contando como "posibles". */
  hidden: Card[];
  /** Cartas vistas: mesa actual y rondas anteriores del mismo zapato. */
  seen: Card[];
  /** Sube con cada cambio de cartas, mesa o reglas; descarta cálculos viejos. */
  version: number;
  shuffles: number;

  newShoe(decks: number, opts?: { shuffled?: boolean; randomInt?: RandomInt }): void;
  /** Simulación: saca la carta de arriba. */
  drawCard(opts?: { hidden?: boolean }): Card;
  /** Manual: marca como vista una carta de esa cara. Error si está agotada. */
  markSeen(face: Face): Card;
  /** Manual: carta boca abajo conocida (la oculta del dealer en modo dealer). */
  markHidden(face: Face): Card;
  /** Voltea una carta oculta: recién ahora se descuenta del zapato. */
  reveal(id: string): void;
  /** Deshace la última carta vista. */
  undoSeen(): Card | undefined;
  /** Devuelve al zapato cartas concretas (vistas u ocultas). */
  returnCards(ids: readonly string[]): void;
  /** ShoeEditor: fija cuántas cartas de una cara quedan. `locked` = ids que están en la mesa. */
  setFaceCount(face: Face, count: number, locked: ReadonlySet<string>): void;
  bump(): void;
  /** 10 conteos [A, 2..9, T] de lo que no se ha visto, INCLUIDA la oculta. */
  toCounts(): Counts;
  /** Fracción del zapato ya repartida (para la penetración). */
  dealtFraction(): number;
}

const capacityMsg = (face: Face) =>
  `No quedan cartas "${FACE_NAME[face]}" en el zapato: ya salieron todas.`;

export const useShoeStore = create<ShoeState>()((set, get) => ({
  decks: 6,
  remaining: createShoe(6),
  hidden: [],
  seen: [],
  version: 1,
  shuffles: 0,

  newShoe(decks, opts = {}) {
    const shuffled = opts.shuffled ?? true;
    set((s) => ({
      decks,
      remaining: shuffled ? createShoe(decks, opts.randomInt) : createCards(decks),
      hidden: [],
      seen: [],
      version: s.version + 1,
      shuffles: s.shuffles + 1,
    }));
  },

  drawCard(opts = {}) {
    const { remaining } = get();
    const card = remaining[remaining.length - 1];
    if (!card) throw new ShoeError('El zapato está vacío: hay que rebarajar.');
    set((s) => ({
      remaining: s.remaining.slice(0, -1),
      ...(opts.hidden ? { hidden: [...s.hidden, card] } : { seen: [...s.seen, card] }),
      version: s.version + 1,
    }));
    return card;
  },

  markSeen(face) {
    const idx = get().remaining.findLastIndex((c) => c.face === face);
    if (idx === -1) throw new ShoeError(capacityMsg(face));
    const card = get().remaining[idx]!;
    set((s) => ({
      remaining: s.remaining.filter((_, i) => i !== idx),
      seen: [...s.seen, card],
      version: s.version + 1,
    }));
    return card;
  },

  markHidden(face) {
    const idx = get().remaining.findLastIndex((c) => c.face === face);
    if (idx === -1) throw new ShoeError(capacityMsg(face));
    const card = get().remaining[idx]!;
    set((s) => ({
      remaining: s.remaining.filter((_, i) => i !== idx),
      hidden: [...s.hidden, card],
      version: s.version + 1,
    }));
    return card;
  },

  reveal(id) {
    const card = get().hidden.find((c) => c.id === id);
    if (!card) return;
    set((s) => ({
      hidden: s.hidden.filter((c) => c.id !== id),
      seen: [...s.seen, card],
      version: s.version + 1,
    }));
  },

  undoSeen() {
    const card = get().seen.at(-1);
    if (!card) return undefined;
    set((s) => ({
      seen: s.seen.slice(0, -1),
      remaining: [...s.remaining, card],
      version: s.version + 1,
    }));
    return card;
  },

  returnCards(ids) {
    if (ids.length === 0) return;
    const set_ = new Set(ids);
    const back = [...get().seen, ...get().hidden].filter((c) => set_.has(c.id));
    set((s) => ({
      seen: s.seen.filter((c) => !set_.has(c.id)),
      hidden: s.hidden.filter((c) => !set_.has(c.id)),
      remaining: [...s.remaining, ...back],
      version: s.version + 1,
    }));
  },

  setFaceCount(face, count, locked) {
    const { remaining, seen, hidden, decks } = get();
    const current = remaining.filter((c) => c.face === face).length;
    const outOfReach = [...seen, ...hidden].filter(
      (c) => c.face === face && (locked.has(c.id) || hidden.includes(c)),
    ).length;
    const max = faceCapacity(decks) - outOfReach;
    if (!Number.isInteger(count) || count < 0 || count > max) {
      throw new ShoeError(
        `"${FACE_NAME[face]}": el conteo debe estar entre 0 y ${max} (hay ${outOfReach} en la mesa).`,
      );
    }
    if (count === current) return;
    if (count < current) {
      // Las que sobran pasan a "vistas" (descartadas).
      let drop = current - count;
      const moved: Card[] = [];
      const keep = remaining
        .slice()
        .reverse()
        .filter((c) => {
          if (drop > 0 && c.face === face) {
            drop--;
            moved.push(c);
            return false;
          }
          return true;
        })
        .reverse();
      set((s) => ({ remaining: keep, seen: [...s.seen, ...moved], version: s.version + 1 }));
    } else {
      // Recupera cartas vistas de esa cara que no están en la mesa.
      let need = count - current;
      const back: Card[] = [];
      const seenKeep = seen.filter((c) => {
        if (need > 0 && c.face === face && !locked.has(c.id)) {
          need--;
          back.push(c);
          return false;
        }
        return true;
      });
      set((s) => ({
        seen: seenKeep,
        remaining: [...s.remaining, ...back],
        version: s.version + 1,
      }));
    }
  },

  bump() {
    set((s) => ({ version: s.version + 1 }));
  },

  toCounts() {
    const { remaining, hidden } = get();
    return toCounts(remaining, hidden);
  },

  dealtFraction() {
    const { remaining, decks } = get();
    const total = decks * 52;
    return (total - remaining.length) / total;
  },
}));

export const currentVersion = () => useShoeStore.getState().version;

export const rankOf = (c: Card) => toRankIndex(c.face);
