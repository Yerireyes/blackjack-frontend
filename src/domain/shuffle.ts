// Barajado Fisher-Yates con números de crypto.getRandomValues (sin sesgo de módulo).

export type RandomInt = (maxExclusive: number) => number;

/** Entero uniforme en [0, maxExclusive) por muestreo con rechazo. */
export const cryptoRandomInt: RandomInt = (maxExclusive) => {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RangeError('maxExclusive debe ser un entero positivo');
  }
  const range = 0x1_0000_0000;
  const limit = range - (range % maxExclusive);
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    const x = buf[0]!;
    if (x < limit) return x % maxExclusive;
  }
};

/** Devuelve una copia barajada; no modifica el arreglo original. */
export function shuffle<T>(items: readonly T[], randomInt: RandomInt = cryptoRandomInt): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
