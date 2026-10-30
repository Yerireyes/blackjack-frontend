// Fechas de Ranked en la zona horaria del usuario; las temporadas se nombran en UTC.

const when = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

/** «29 de octubre, 16:05» (hora local). */
export const formatWhen = (iso: string) => when.format(new Date(iso));

const month = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** `"2026-10"` → «octubre de 2026». */
export function seasonName(season: string) {
  const [y, m] = season.split('-').map(Number);
  if (!y || !m) return season;
  return month.format(new Date(Date.UTC(y, m - 1, 1)));
}

/** La temporada anterior a `"AAAA-MM"`. */
export function previousSeason(season: string) {
  const [y, m] = season.split('-').map(Number);
  const d = new Date(Date.UTC(y!, m! - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** «Quedan 12 días», «Quedan 5 horas»… para la temporada en curso. */
export function endsIn(iso: string, now = Date.now()) {
  const hours = Math.floor((Date.parse(iso) - now) / 3_600_000);
  if (hours >= 48) return `Quedan ${Math.floor(hours / 24)} días`;
  if (hours >= 2) return `Quedan ${hours} horas`;
  return 'Termina en menos de 2 horas';
}
