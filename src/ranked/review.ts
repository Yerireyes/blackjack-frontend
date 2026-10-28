// Presentación de `result.review` (la calcula el servidor; aquí solo se cuenta y se redacta).
import type { ReviewItem } from '@/engine/contract';
import { formatChips, formatPct } from '@/lib/format';

export interface ReviewSummary {
  decisions: number;
  optimal: number;
  /** EV perdido en unidades de la apuesta y en fichas. */
  evLost: number;
  chipsLost: number;
  text: string;
}

export const isOptimal = (r: ReviewItem) => r.chosen === r.best;
/** EV perdido en una decisión, en unidades de la apuesta (0 si fue la óptima). */
export const lostEv = (r: ReviewItem) => Math.max(0, r.evBest - r.evChosen);

function chipsText(chips: number, approx: string) {
  if (chips < 0.5) return 'menos de 1 ficha';
  const n = Math.round(chips);
  return `${approx}${formatChips(n)} ${n === 1 ? 'ficha' : 'fichas'}`;
}

export function reviewSummary(review: ReviewItem[], bet: number): ReviewSummary {
  const decisions = review.length;
  const optimal = review.filter(isOptimal).length;
  const evLost = review.reduce((n, r) => n + lostEv(r), 0);
  const chipsLost = evLost * bet;
  // Dividir a veces se calcula aproximado: entonces la pérdida también lo es.
  const approx = review.some((r) => !r.exact) ? '≈ ' : '';

  let text: string;
  if (decisions === 0) text = 'Sin decisiones que revisar: la mano terminó en el reparto.';
  else if (optimal === decisions)
    text =
      decisions === 1
        ? 'Tu decisión fue la óptima.'
        : `Jugaste perfecto: ${decisions} de ${decisions} decisiones óptimas.`;
  else
    text =
      `${optimal} de ${decisions} ${decisions === 1 ? 'decisión óptima' : 'decisiones óptimas'}` +
      ` · perdiste ${approx}${formatPct(evLost)} de la apuesta en EV` +
      ` (${chipsText(chipsLost, approx)}).`;

  return { decisions, optimal, evLost, chipsLost, text };
}
