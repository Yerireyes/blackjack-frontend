import { beforeEach, describe, expect, it } from 'vitest';
import { sumCounts } from '@/domain/shoe';
import { ShoeError, useShoeStore } from './shoeStore';

const s = () => useShoeStore.getState();

describe('shoeStore', () => {
  beforeEach(() => s().newShoe(1));

  it('toCounts devuelve 10 números que suman las cartas que quedan', () => {
    const c = s().toCounts();
    expect(c).toHaveLength(10);
    expect(sumCounts(c)).toBe(52);
    s().drawCard();
    expect(sumCounts(s().toCounts())).toBe(51);
  });

  it('la carta oculta sigue en toCounts hasta revelarse', () => {
    const hole = s().drawCard({ hidden: true });
    expect(sumCounts(s().toCounts())).toBe(52);
    s().reveal(hole.id);
    expect(sumCounts(s().toCounts())).toBe(51);
  });

  it('marcar una carta vista baja su rango en 1 y nunca deja negativos', () => {
    s().newShoe(1, { shuffled: false });
    const before = s().toCounts()[0];
    s().markSeen('A');
    expect(s().toCounts()[0]).toBe(before - 1);
    s().markSeen('A');
    s().markSeen('A');
    s().markSeen('A');
    expect(s().toCounts()[0]).toBe(0);
    expect(() => s().markSeen('A')).toThrow(ShoeError);
    expect(s().toCounts()[0]).toBe(0);
  });

  it('cada cambio sube la versión', () => {
    const v0 = s().version;
    s().markSeen('5');
    const v1 = s().version;
    expect(v1).toBeGreaterThan(v0);
    s().undoSeen();
    expect(s().version).toBeGreaterThan(v1);
    const v2 = s().version;
    const c = s().drawCard({ hidden: true });
    s().reveal(c.id);
    expect(s().version).toBeGreaterThan(v2 + 1);
  });

  it('undoSeen devuelve la carta al zapato', () => {
    s().markSeen('K');
    expect(sumCounts(s().toCounts())).toBe(51);
    s().undoSeen();
    expect(sumCounts(s().toCounts())).toBe(52);
  });

  it('setFaceCount corrige conteos sin tocar las cartas de la mesa', () => {
    s().newShoe(1, { shuffled: false });
    const onTable = s().markSeen('7');
    s().setFaceCount('7', 0, new Set([onTable.id]));
    expect(s().remaining.filter((c) => c.face === '7')).toHaveLength(0);
    // Máximo: 4 menos la que está en la mesa.
    expect(() => s().setFaceCount('7', 4, new Set([onTable.id]))).toThrow(ShoeError);
    s().setFaceCount('7', 3, new Set([onTable.id]));
    expect(s().remaining.filter((c) => c.face === '7')).toHaveLength(3);
    expect(s().seen.map((c) => c.id)).toContain(onTable.id);
  });

  it('dealtFraction cuenta repartidas y ocultas', () => {
    s().drawCard();
    s().drawCard({ hidden: true });
    expect(s().dealtFraction()).toBeCloseTo(2 / 52);
  });
});
