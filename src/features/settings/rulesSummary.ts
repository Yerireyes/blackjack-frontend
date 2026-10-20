import { blackjackPaysLabel, type Rules } from '@/domain/rules';

/** Resumen corto de las reglas para la barra superior: "6 mazos · S17 · DAS · 3:2". */
export function rulesSummary(r: Rules) {
  return [
    `${r.decks} ${r.decks === 1 ? 'mazo' : 'mazos'}`,
    r.dealerHitsSoft17 ? 'H17' : 'S17',
    r.doubleAfterSplit ? 'DAS' : 'sin DAS',
    r.dealerPeeks ? null : 'sin oculta',
    r.surrender === 'late' ? 'rendición' : null,
    blackjackPaysLabel(r.blackjackPays),
  ]
    .filter(Boolean)
    .join(' · ');
}
