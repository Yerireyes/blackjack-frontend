// Situaciones de decisión (DecisionSpot): cómo se nombran y qué cartas las reproducen en
// Práctica para el entrenamiento dirigido. Funciones puras.
import type { Face } from '@/domain/cards';
import type { DecisionSpot, RoundKind, SpotKind } from '@/engine/contract';

export const MODE_NAME: Record<RoundKind, string> = {
  casual: 'Casual',
  ranked: 'Ranked',
  daily: 'Reto diario',
};

export const KIND_NAME: Record<SpotKind, string> = {
  hard: 'Manos duras',
  soft: 'Manos suaves',
  pair: 'Pares',
};

/** Rango del motor (0 = As … 9 = diez) como se lee: «As», «2» … «10». */
export const rankName = (r: number) => (r === 0 ? 'As' : String(r + 1));

/** «16 duro contra 10», «18 suave contra 9», «par de 8 contra 6». */
export function spotLabel(s: DecisionSpot): string {
  const vs = ` contra ${rankName(s.dealerUp)}`;
  if (s.kind === 'pair') return `Par de ${s.pair === 0 ? 'ases' : rankName(s.pair ?? 0)}${vs}`;
  return `${s.total} ${s.kind === 'soft' ? 'suave' : 'duro'}${vs}`;
}

const TENS: readonly Face[] = ['10', 'J', 'Q', 'K'];

/** Una figura del rango del motor; el diez sale de 10, J, Q o K al azar. */
export function faceOfRank(r: number, random: () => number = Math.random): Face {
  if (r === 0) return 'A';
  if (r === 9) return TENS[Math.floor(random() * TENS.length)]!;
  return String(r + 1) as Face;
}

/**
 * Dos cartas que dan esa situación (o null si con dos cartas no hay decisión, como 21). Duras sin
 * pareja cuando se puede, para que no se ofrezca dividir.
 */
export function spotFaces(
  s: DecisionSpot,
  random: () => number = Math.random,
): [Face, Face] | null {
  if (s.kind === 'pair') {
    const r = s.pair ?? 0;
    return [faceOfRank(r, random), faceOfRank(r, random)];
  }
  if (s.kind === 'soft') {
    const other = s.total - 11; // el As cuenta 11
    if (other < 2 || other > 9) return null;
    return ['A', faceOfRank(other - 1, random)];
  }
  const t = s.total;
  if (t < 4 || t > 20) return null;
  // Valores posibles de la primera carta (2..10) con la segunda también entre 2 y 10.
  const all: number[] = [];
  for (let a = Math.max(2, t - 10); a <= Math.min(10, t - 2); a++) all.push(a);
  // Sin pareja si se puede (4 y 20 duros solo salen con pareja con dos cartas).
  const unpaired = all.filter((a) => a !== t - a);
  const options = unpaired.length > 0 ? unpaired : all;
  if (options.length === 0) return null;
  const a = options[Math.floor(random() * options.length)]!;
  return [faceOfRank(a - 1, random), faceOfRank(t - a - 1, random)];
}

/** Elige una situación con probabilidad proporcional a lo que costó (`evLost`). */
export function pickWeighted<T extends { evLost: number }>(
  items: readonly T[],
  random: () => number = Math.random,
): T | null {
  if (items.length === 0) return null;
  const w = items.map((i) => Math.max(i.evLost, 0.01));
  let x = random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) {
    x -= w[i]!;
    if (x <= 0) return items[i]!;
  }
  return items[items.length - 1]!;
}
