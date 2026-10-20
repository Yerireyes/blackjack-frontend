import { describe, expect, it } from 'vitest';
import { formatEv, formatPct, formatUnits } from './format';

const n = (s: string) => s.replace(/\u00a0/g, ' ').replace(/\u2212/g, '-');

describe('format', () => {
  it('probabilidades con dos decimales y coma', () => {
    expect(n(formatPct(0.42171))).toBe('42,17 %');
    expect(n(formatPct(1))).toBe('100,00 %');
    expect(n(formatPct(0))).toBe('0,00 %');
  });
  it('EV con signo, nunca redondeado a entero', () => {
    expect(n(formatEv(0.0345))).toBe('+3,45 %');
    expect(n(formatEv(-0.54095))).toBe('-54,10 %');
    expect(n(formatEv(-0.001))).toBe('-0,10 %');
    expect(n(formatEv(0))).toBe('0,00 %');
    expect(n(formatEv(-1.06935))).toBe('-106,94 %');
  });
  it('unidades', () => {
    expect(n(formatUnits(1.5))).toBe('+1,50 u');
    expect(n(formatUnits(-2))).toBe('-2,00 u');
  });
});
