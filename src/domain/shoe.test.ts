import { describe, expect, it } from 'vitest';
import { cards } from '@/tests/helpers';
import { countsValue, createCards, createShoe, sumCounts, toCounts, withoutRank } from './shoe';

describe('shoe', () => {
  it('un mazo tiene 52 cartas con 4 por rango y 16 de valor 10', () => {
    const c = toCounts(createCards(1));
    expect(c).toEqual([4, 4, 4, 4, 4, 4, 4, 4, 4, 16]);
    expect(sumCounts(toCounts(createShoe(6)))).toBe(312);
  });
  it('ids únicos', () => {
    const ids = createCards(8).map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('toCounts suma varios grupos', () => {
    expect(toCounts(cards('A', 'K'), cards('Q'))).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 2]);
  });
  it('withoutRank no deja negativos', () => {
    const c = toCounts(cards('5'));
    expect(withoutRank(c, 4)[4]).toBe(0);
    expect(() => withoutRank(c, 0)).toThrow();
  });
  it('countsValue usa As = 1', () => {
    expect(countsValue(toCounts(createCards(1)))).toBe(340);
  });
});
