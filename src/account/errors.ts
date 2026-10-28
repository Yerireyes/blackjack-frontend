import { ApiRequestError } from '@/api/http';

/** Mensaje para mostrar de un error de la API (ya viene en español desde el servidor). */
export function errorText(e: unknown): string {
  if (!(e instanceof ApiRequestError)) return 'Algo salió mal. Inténtalo de nuevo.';
  if (e.code === 'rate_limited' && e.retryAfter) {
    return `${e.message} Espera ${e.retryAfter} s y vuelve a intentarlo.`;
  }
  return e.message;
}

/** Campo del formulario al que pertenece un error, para mostrarlo junto a él. */
export function errorField(e: unknown): 'email' | 'displayName' | 'form' {
  if (!(e instanceof ApiRequestError)) return 'form';
  if (e.code === 'email_taken') return 'email';
  if (e.code === 'display_name_taken' || e.code === 'display_name_invalid') return 'displayName';
  return 'form';
}
