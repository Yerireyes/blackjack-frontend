// Formato de números. Coma decimal y dos decimales, como piden las pautas:
// "+3,45 %" para el EV y "42,17 %" para probabilidades. Nunca se redondea a enteros.
// (El CLDR de es-PE usa punto decimal; seguimos el formato explícito del diseño.)

const two = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
});

const MINUS = '−';
const NBSP = ' ';

const clean = (s: string) => s.replace('-', MINUS);

/** Probabilidad 0..1 → "42,17 %". */
export function formatPct(p: number): string {
  // Evita "-0,00 %" por ruido de coma flotante.
  const v = Math.abs(p) < 5e-7 ? 0 : p * 100;
  return `${clean(two.format(v))}${NBSP}%`;
}

/** EV en unidades de la apuesta → "+3,45 %" (siempre con signo, salvo cero exacto). */
export function formatEv(ev: number): string {
  const v = ev * 100;
  if (Math.abs(v) < 0.005) return `0,00${NBSP}%`;
  const body = two.format(Math.abs(v));
  return `${v > 0 ? '+' : MINUS}${body}${NBSP}%`;
}

/** Unidades de apuesta con signo → "+1,50 u". */
export function formatUnits(u: number): string {
  if (Math.abs(u) < 0.005) return `0,00${NBSP}u`;
  return `${u > 0 ? '+' : MINUS}${two.format(Math.abs(u))}${NBSP}u`;
}

/** Fichas enteras con punto de miles → "1.000"; con `signed`, "+15" / "−40". */
export function formatChips(n: number, signed = false): string {
  const body = Math.abs(Math.round(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (!signed || n === 0) return n < 0 ? `${MINUS}${body}` : body;
  return `${n > 0 ? '+' : MINUS}${body}`;
}

export const evTone = (ev: number) => (ev > 0.00005 ? 'pos' : ev < -0.00005 ? 'neg' : 'zero');

export function formatMs(ms: number): string {
  if (ms < 1) return '< 1 ms';
  return `${Math.round(ms).toLocaleString('es-ES')} ms`;
}
