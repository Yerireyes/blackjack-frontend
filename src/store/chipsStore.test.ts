import { beforeEach, describe, expect, it } from 'vitest';
import {
  canAddChip,
  MAX_BET,
  MAX_CHIPS,
  MAX_STACK,
  parseSaved,
  stackTotal,
  START_CHIPS,
  useChipsStore,
} from './chipsStore';
import { setStack } from '@/tests/helpers';

const c = () => useChipsStore.getState();

describe('chipsStore', () => {
  beforeEach(() => {
    useChipsStore.setState({
      player: START_CHIPS,
      house: START_CHIPS,
      round: null,
      last: null,
      sessionChips: 0,
    });
    setStack('player', 10);
    setStack('house', 10);
  });

  it('pone y quita fichas de la pila', () => {
    expect(c().addChip('player', 50)).not.toBeNull();
    expect(stackTotal(c().stacks.player)).toBe(60);
    c().removeChip('player');
    expect(c().stacks.player.map((x) => x.value)).toEqual([10]);
    c().clearStack('player');
    expect(c().stacks.player).toEqual([]);
  });

  it('con fichas de 10 la pila se llena en 10 fichas: no crece sin límite', () => {
    setStack('player');
    for (let i = 0; i < 20; i++) c().addChip('player', 10);
    expect(c().stacks.player).toHaveLength(MAX_STACK);
    expect(stackTotal(c().stacks.player)).toBe(100);
    expect(c().addChip('player', 10)).toBeNull();
  });

  it('la apuesta no pasa del máximo de mesa ni del saldo', () => {
    setStack('player', 500);
    expect(c().addChip('player', 10)).toBeNull();
    expect(stackTotal(c().stacks.player)).toBe(MAX_BET);
    expect(canAddChip([], 100, 90)).toBe(false);
    expect(canAddChip([], 50, 90)).toBe(true);
  });

  it('durante la ronda la pila no se toca', () => {
    c().startRound('player');
    expect(c().addChip('player', 50)).toBeNull();
    c().removeChip('player');
    c().clearStack('player');
    expect(stackTotal(c().stacks.player)).toBe(10);
  });

  it('3:2 y 6:5 pagan fichas enteras', () => {
    c().startRound('player');
    c().settle(1.5);
    expect(c().player).toBe(1015);
    c().startRound('player');
    c().settle(1.2); // 6:5: 1.2 × 10 da 12.000000000000002 en coma flotante
    expect(c().player).toBe(1027);
    expect(Number.isInteger(c().player)).toBe(true);
    expect(c().sessionChips).toBe(27);
  });

  it('la banca de la casa cobra lo que pierde el jugador automático', () => {
    setStack('house', 100);
    c().startRound('house');
    c().settle(-2); // el jugador dobló y perdió
    expect(c().house).toBe(1200);
    expect(c().last).toEqual({ bank: 'house', amount: 200 });
    expect(c().sessionChips).toBe(0);
  });

  it('ninguna banca pasa del tope ni baja de cero', () => {
    useChipsStore.setState({ player: MAX_CHIPS - 5 });
    setStack('player', 100);
    c().startRound('player');
    c().settle(1);
    expect(c().player).toBe(MAX_CHIPS);
    useChipsStore.setState({ house: 20 });
    c().startRound('house');
    c().settle(1.5);
    expect(c().house).toBe(5);
  });

  it('sin saldo o sin fichas en la mesa no hay ronda', () => {
    useChipsStore.setState({ player: 5 });
    expect(c().startRound('player')).toBe('broke');
    c().refill('player');
    expect(c().player).toBe(START_CHIPS);
    setStack('player');
    expect(c().startRound('player')).toBe('empty');
    expect(c().round).toBeNull();
  });

  it('si el saldo ya no cubre la pila, se retiran fichas de arriba', () => {
    useChipsStore.setState({ player: 70 });
    setStack('player', 50, 10, 100);
    expect(c().startRound('player')).toBe('ok');
    expect(c().round).toEqual({ bank: 'player', stake: 60 });
    expect(c().stacks.player.map((x) => x.value)).toEqual([50, 10]);
  });

  it('unidades extra: cuánto más se puede doblar o dividir', () => {
    expect(c().spareUnits(1)).toBe(Infinity);
    useChipsStore.setState({ player: 250 });
    setStack('player', 100);
    c().startRound('player');
    expect(c().spareUnits(1)).toBe(1);
    expect(c().spareUnits(2)).toBe(0);
  });

  it('descarta valores guardados inválidos', () => {
    const s = parseSaved('{"player":-3,"house":1.5,"stacks":{"player":[10,25],"house":[50,100]}}');
    expect(s.player).toBe(START_CHIPS);
    expect(s.house).toBe(START_CHIPS);
    expect(s.stacks.player.map((x) => x.value)).toEqual([10]);
    expect(s.stacks.house.map((x) => x.value)).toEqual([50, 100]);
    const tooMany = JSON.stringify({ stacks: { player: Array(11).fill(10) } });
    expect(parseSaved(tooMany).stacks.player).toHaveLength(1);
    const overMax = JSON.stringify({ stacks: { player: [500, 500] } });
    expect(stackTotal(parseSaved(overMax).stacks.player)).toBe(10);
    expect(parseSaved('{"player":1e99}').player).toBe(START_CHIPS);
    expect(parseSaved('no es json').player).toBe(START_CHIPS);
  });
});
