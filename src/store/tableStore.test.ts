import { beforeEach, describe, expect, it } from 'vitest';
import type { Face } from '@/domain/cards';
import { presetRules } from '@/domain/rules';
import { sumCounts } from '@/domain/shoe';
import { cards, setStack } from '@/tests/helpers';
import { applyRules, switchSource } from './actions';
import { useShoeStore } from './shoeStore';
import { useChipsStore } from './chipsStore';
import { allowedActions, newHand, playerActions, settleHand, useTableStore } from './tableStore';
import { useUiStore } from './uiStore';

const t = () => useTableStore.getState();
const shoe = () => useShoeStore.getState();

/** Prepara el zapato para que salgan estas cartas en este orden (y luego el resto). */
function stack(...faces: Face[]) {
  const rest = shoe().remaining.slice();
  const top = faces.map((f) => {
    const i = rest.findIndex((c) => c.face === f);
    return rest.splice(i, 1)[0]!;
  });
  useShoeStore.setState({ remaining: [...rest, ...top.reverse()] });
}

function simTable(rules = presetRules('vegas')) {
  useChipsStore.setState({ player: 1000, house: 1000, round: null });
  setStack('player', 10);
  setStack('house', 10);
  useUiStore.setState({ mode: 'player', botSeats: 0, knowHole: false, source: 'manual' });
  switchSource('simulation');
  applyRules(rules, 'custom');
}

describe('tableStore · simulación', () => {
  beforeEach(() => simTable());

  it('reparte jugador, dealer visible, jugador y oculta (sin descontarla)', () => {
    stack('10', '9', '6', '7');
    t().deal();
    expect(t().player.hands[0]!.cards.map((c) => c.face)).toEqual(['10', '6']);
    expect(t().dealer.up!.face).toBe('9');
    expect(t().dealer.hole!.face).toBe('7');
    expect(t().dealer.holeRevealed).toBe(false);
    // 312 - 3 visibles: la oculta sigue contando.
    expect(sumCounts(shoe().toCounts())).toBe(312 - 3);
    expect(t().phase).toBe('player');
  });

  it('con peek y blackjack del dealer la ronda termina al repartir', () => {
    stack('10', 'A', '7', 'K');
    t().deal();
    expect(t().phase).toBe('settled');
    expect(t().dealer.holeRevealed).toBe(true);
    expect(t().player.hands[0]!.outcome).toBe('lose');
    expect(sumCounts(shoe().toCounts())).toBe(312 - 4);
  });

  it('toda acción sube la versión', () => {
    stack('10', '9', '2', '7', '3');
    t().deal();
    const v = shoe().version;
    t().act('hit');
    expect(shoe().version).toBeGreaterThan(v);
    const v2 = shoe().version;
    t().act('stand');
    expect(shoe().version).toBeGreaterThan(v2);
  });

  it('dividir: la mano activa avanza y cada mano recibe su segunda carta', () => {
    stack('8', '6', '8', '10', '3', '5');
    t().deal();
    expect(allowedActions(t().player, presetRules('vegas')).split).toBe(true);
    t().act('split');
    const hands = t().player.hands;
    expect(hands).toHaveLength(2);
    expect(hands[0]!.cards.map((c) => c.face)).toEqual(['8', '3']);
    expect(hands[1]!.cards.map((c) => c.face)).toEqual(['8']);
    expect(t().player.active).toBe(0);
    t().act('stand');
    expect(t().player.active).toBe(1);
    expect(t().player.hands[1]!.cards.map((c) => c.face)).toEqual(['8', '5']);
  });

  it('el dealer revela, pide según las reglas y liquida', () => {
    // Jugador 10,8; dealer 6 + 10 = 16 → pide un 5 → 21.
    stack('10', '6', '8', '10', '5');
    t().deal();
    const net0 = t().sessionNet;
    t().act('stand');
    expect(t().phase).toBe('dealer');
    expect(t().dealerStep()).toBe('reveal');
    expect(t().dealerStep()).toBe('hit');
    expect(t().dealerStep()).toBe('settle');
    expect(t().player.hands[0]!.outcome).toBe('lose');
    expect(t().sessionNet - net0).toBe(-1);
  });

  it('la ronda liquida tus fichas según la apuesta', () => {
    setStack('player', 50);
    // Jugador 10,8; dealer 6 + 10 = 16 → pide un 5 → 21: pierdes 50.
    stack('10', '6', '8', '10', '5');
    t().deal();
    t().act('stand');
    while (t().dealerStep() !== 'settle');
    expect(useChipsStore.getState().player).toBe(950);
    expect(useChipsStore.getState().round).toBeNull();
  });

  it('sin saldo o sin fichas en la mesa no se reparte', () => {
    useChipsStore.setState({ player: 0 });
    t().deal();
    expect(t().phase).toBe('idle');
    expect(t().notice?.tone).toBe('error');
    useChipsStore.setState({ player: 1000 });
    setStack('player');
    t().deal();
    expect(t().phase).toBe('idle');
    expect(t().notice?.text).toMatch(/Pon fichas/);
  });

  it('no se puede doblar ni dividir si las fichas no lo cubren', () => {
    useChipsStore.setState({ player: 100 });
    setStack('player', 100);
    stack('8', '6', '8', '10');
    t().deal();
    const rules = presetRules('vegas');
    expect(allowedActions(t().player, rules).split).toBe(true);
    expect(playerActions(t().player, rules)).toMatchObject({ double: false, split: false });
    t().act('double');
    expect(t().player.hands[0]!.doubled).toBe(false);
    useChipsStore.setState({ player: 1000 });
  });

  it('una ronda interrumpida no cobra ni paga', () => {
    setStack('player', 100);
    stack('10', '9', '6', '7');
    t().deal();
    t().resetTable();
    expect(useChipsStore.getState().round).toBeNull();
    expect(useChipsStore.getState().player).toBe(1000);
  });

  it('blackjack del jugador paga según la regla', () => {
    stack('A', '9', 'K', '7');
    t().deal();
    expect(t().phase).toBe('dealer');
    t().dealerStep();
    t().dealerStep();
    expect(t().player.hands[0]!.outcome).toBe('blackjack');
    expect(t().player.hands[0]!.net).toBe(1.5);
  });
});

describe('settleHand', () => {
  const rules = presetRules('europe');
  const dealer = (...f: Face[]) => {
    const [up, hole, ...hits] = cards(...f);
    return { up: up!, hole: hole!, holeRevealed: true, hits };
  };
  it('sin peek, el blackjack del dealer se lleva lo doblado', () => {
    const h = newHand(cards('6', '5', '9'), { doubled: true });
    expect(settleHand(h, dealer('A', 'K'), rules)).toEqual({ outcome: 'lose', net: -2 });
  });
  it('empate, rendición y dealer pasado', () => {
    expect(settleHand(newHand(cards('10', '8')), dealer('9', '9'), rules).outcome).toBe('push');
    expect(
      settleHand(newHand(cards('10', '6'), { surrendered: true }), dealer('9', '9'), rules).net,
    ).toBe(-0.5);
    expect(settleHand(newHand(cards('10', '2')), dealer('6', '10', 'K'), rules).outcome).toBe(
      'win',
    );
  });
});

describe('tableStore · manual', () => {
  beforeEach(() => {
    useUiStore.setState({ mode: 'player', source: 'simulation', knowHole: false });
    switchSource('manual');
    applyRules({ ...presetRules('vegas'), decks: 1 }, 'custom');
  });

  it('asigna cartas al jugador y al dealer, descontándolas del zapato', () => {
    t().assignCard('10', { kind: 'player' });
    t().assignCard('6', { kind: 'player' });
    t().assignCard('10', { kind: 'dealer' });
    expect(t().player.hands[0]!.cards).toHaveLength(2);
    expect(t().dealer.up!.face).toBe('10');
    const c = shoe().toCounts();
    expect(c[9]).toBe(14);
    expect(c[5]).toBe(3);
  });

  it('en modo dealer la segunda carta del dealer queda oculta y no se descuenta', () => {
    useUiStore.setState({ mode: 'dealer' });
    t().assignCard('9', { kind: 'dealer' });
    t().assignCard('7', { kind: 'dealer' });
    expect(t().dealer.holeRevealed).toBe(false);
    expect(sumCounts(shoe().toCounts())).toBe(51);
    t().revealHole();
    expect(sumCounts(shoe().toCounts())).toBe(50);
  });

  it('ingresar una carta agotada muestra un error y no cambia nada', () => {
    for (let i = 0; i < 4; i++) t().assignCard('A', { kind: 'discard' });
    const v = shoe().version;
    expect(t().assignCard('A', { kind: 'player' })).toBe(false);
    expect(t().notice?.tone).toBe('error');
    expect(shoe().version).toBe(v);
    expect(t().player.hands[0]!.cards).toHaveLength(0);
  });

  it('deshacer devuelve la carta', () => {
    t().assignCard('5', { kind: 'other', seat: 0 });
    expect(t().others).toHaveLength(1);
    t().undoLast();
    expect(t().others).toHaveLength(0);
    expect(sumCounts(shoe().toCounts())).toBe(52);
  });

  it('dividir en manual crea dos manos de una carta', () => {
    t().assignCard('8', { kind: 'player' });
    t().assignCard('8', { kind: 'player' });
    t().assignCard('10', { kind: 'dealer' });
    t().act('split');
    expect(t().player.hands.map((h) => h.cards.length)).toEqual([1, 1]);
    t().assignCard('3', { kind: 'player' });
    expect(t().player.hands[0]!.cards.map((c) => c.face)).toEqual(['8', '3']);
  });
});
