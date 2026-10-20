import { describe, expect, it } from 'vitest';
import { cards } from '@/tests/helpers';
import { describeHand, handValue, isPair, toRankIndex, FACES } from './cards';

describe('toRankIndex', () => {
  it('mapea A→0, 2..9→1..8 y 10/J/Q/K→9', () => {
    expect(FACES.map(toRankIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 9, 9]);
  });
});

describe('handValue', () => {
  it('totales duros', () => {
    expect(handValue(cards('10', '6'))).toMatchObject({ total: 16, soft: false, bust: false });
    expect(handValue(cards('K', 'Q', '2')).bust).toBe(true);
  });
  it('totales suaves y el As que pasa a valer 1', () => {
    expect(handValue(cards('A', '6'))).toMatchObject({ total: 17, soft: true });
    expect(handValue(cards('A', '6', '10'))).toMatchObject({ total: 17, soft: false });
    expect(handValue(cards('A', 'A'))).toMatchObject({ total: 12, soft: true });
    expect(handValue(cards('A', 'A', '9'))).toMatchObject({ total: 21, soft: true });
  });
  it('blackjack natural vs. 21 tras dividir', () => {
    expect(handValue(cards('A', 'K')).blackjack).toBe(true);
    expect(handValue(cards('A', 'K'), true).blackjack).toBe(false);
    expect(handValue(cards('7', '7', '7')).blackjack).toBe(false);
  });
});

describe('describeHand', () => {
  it('textos de la mesa', () => {
    expect(describeHand(cards('A', '6'))).toBe('17 suave');
    expect(describeHand(cards('A', 'J'))).toBe('Blackjack');
    expect(describeHand(cards('A', 'J'), true)).toBe('21');
    expect(describeHand(cards('10', '6', '9'))).toBe('Se pasó');
  });
});

describe('isPair', () => {
  it('compara por rango del motor (10 y K son par)', () => {
    expect(isPair(cards('10', 'K'))).toBe(true);
    expect(isPair(cards('8', '8'))).toBe(true);
    expect(isPair(cards('8', '9'))).toBe(false);
  });
});
