import { describe, expect, it } from 'vitest';
import { cryptoRandomInt, shuffle } from './shuffle';

describe('shuffle', () => {
  it('es una permutación y no modifica el original', () => {
    const a = Array.from({ length: 52 }, (_, i) => i);
    const s = shuffle(a);
    expect(s).not.toBe(a);
    expect([...s].sort((x, y) => x - y)).toEqual(a);
  });

  it('cryptoRandomInt cae en el rango', () => {
    for (let i = 0; i < 1000; i++) {
      const x = cryptoRandomInt(7);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(7);
    }
  });

  it('no tiene sesgo: cada elemento cae en cada posición ~1/n (chi²)', () => {
    const n = 5;
    const trials = 60_000;
    const freq = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    const base = Array.from({ length: n }, (_, i) => i);
    for (let t = 0; t < trials; t++) {
      shuffle(base).forEach((v, pos) => freq[v]![pos]!++);
    }
    const expected = trials / n;
    let chi2 = 0;
    for (const row of freq) for (const o of row) chi2 += (o - expected) ** 2 / expected;
    // 25 celdas, gl = (n-1)^2 = 16. Valor crítico al 0,1 %: 39,25.
    expect(chi2).toBeLessThan(39.25);
  });
});
