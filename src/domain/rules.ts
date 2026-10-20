import type { Rules } from '@/engine/contract';

export type { Rules };

export type PresetId = 'vegas' | 'europe' | 'sixToFive';

export interface Preset {
  id: PresetId;
  name: string;
  summary: string;
  rules: Rules;
}

export const PRESETS: readonly Preset[] = [
  {
    id: 'vegas',
    name: 'Las Vegas',
    summary: '6 mazos · S17 · DAS · rendición tardía · 3:2',
    rules: {
      decks: 6,
      dealerHitsSoft17: false,
      doubleAfterSplit: true,
      doubleOn: 'any',
      maxSplitHands: 4,
      resplitAces: false,
      hitSplitAces: false,
      surrender: 'late',
      dealerPeeks: true,
      blackjackPays: 1.5,
      penetration: 0.75,
    },
  },
  {
    id: 'europe',
    name: 'Europa',
    summary: '6 mazos · S17 · sin carta oculta · dobla 9–11 · 3:2',
    rules: {
      decks: 6,
      dealerHitsSoft17: false,
      doubleAfterSplit: true,
      doubleOn: 'nineToEleven',
      maxSplitHands: 2,
      resplitAces: false,
      hitSplitAces: false,
      surrender: 'none',
      dealerPeeks: false,
      blackjackPays: 1.5,
      penetration: 0.75,
    },
  },
  {
    id: 'sixToFive',
    name: '6:5',
    summary: '1 mazo · H17 · sin DAS · blackjack paga 6:5',
    rules: {
      decks: 1,
      dealerHitsSoft17: true,
      doubleAfterSplit: false,
      doubleOn: 'any',
      maxSplitHands: 2,
      resplitAces: false,
      hitSplitAces: false,
      surrender: 'none',
      dealerPeeks: true,
      blackjackPays: 1.2,
      penetration: 0.6,
    },
  },
];

export const DEFAULT_PRESET: PresetId = 'vegas';

export const presetRules = (id: PresetId): Rules => ({
  ...PRESETS.find((p) => p.id === id)!.rules,
});

export const DECK_OPTIONS = [1, 2, 4, 6, 8] as const;

/** ¿Se puede doblar con este total de dos cartas según la regla doubleOn? */
export function canDoubleTotal(rules: Rules, total: number, soft: boolean): boolean {
  switch (rules.doubleOn) {
    case 'any':
      return true;
    case 'nineToEleven':
      return !soft && total >= 9 && total <= 11;
    case 'tenToEleven':
      return !soft && total >= 10 && total <= 11;
  }
}

/** El dealer se planta con 17 o más; con 17 suave pide solo si la regla es H17. */
export function dealerStands(rules: Rules, total: number, soft: boolean): boolean {
  return total >= 18 || (total === 17 && !(soft && rules.dealerHitsSoft17));
}

/** Con peek, el dealer revisa su oculta si la visible es As o vale 10. */
export const dealerChecksHole = (rules: Rules, upRank: number) =>
  rules.dealerPeeks && (upRank === 0 || upRank === 9);

export const blackjackPaysLabel = (pays: number) => (pays === 1.2 ? '6:5' : '3:2');
