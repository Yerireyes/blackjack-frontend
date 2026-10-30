// Fechas del reto: el día es UTC y lo dice el servidor (`day`); aquí solo se nombra.

const dayFmt = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

/** `"2026-10-29"` → «jueves, 29 de octubre». */
export function dayName(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  if (!y || !m || !d) return day;
  return dayFmt.format(new Date(Date.UTC(y, m - 1, d)));
}

/** El día anterior a `"AAAA-MM-DD"`. */
export function previousDay(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! - 1)).toISOString().slice(0, 10);
}

/** Milisegundos hasta las 00:00 UTC siguientes, cuando empieza el próximo reto. */
export function msToNextDay(now = Date.now()) {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - now;
}

/** «Nuevo reto en 5 h 20 min». */
export function nextDayIn(now = Date.now()) {
  const min = Math.max(1, Math.ceil(msToNextDay(now) / 60_000));
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `Nuevo reto en ${h > 0 ? `${h} h ` : ''}${m} min`;
}
