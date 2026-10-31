// Vuelta desde Google: la API redirige a la app con ?login=ok, ?link=ok o
// ?login=error&code=… / ?link=error&code=….

export interface OAuthReturn {
  kind: 'login' | 'link';
  ok: boolean;
  code: string | null;
}

const MESSAGES: Record<string, string> = {
  account_exists:
    'Ya hay una cuenta con ese email. Entra con tu contraseña y vincula Google desde tu perfil.',
  email_unverified: 'Tu cuenta de Google no tiene el email verificado.',
  cancelled: 'Inicio de sesión cancelado.',
  invalid_state: 'El inicio de sesión caducó. Inténtalo de nuevo.',
  identity_in_use: 'Esa cuenta de Google ya está vinculada a otro usuario.',
  already_linked: 'Tu cuenta ya tiene otra cuenta de Google vinculada.',
  unauthorized: 'Inicia sesión para vincular Google.',
  reauth_required: 'Confirma tu contraseña para vincular Google.',
  google_disabled: 'El acceso con Google no está disponible.',
  account_banned: 'Tu cuenta está suspendida.',
};
const GENERIC = 'No se pudo completar el acceso con Google. Inténtalo de nuevo.';

export function readOAuthReturn(search: string): OAuthReturn | null {
  const q = new URLSearchParams(search);
  for (const kind of ['login', 'link'] as const) {
    const v = q.get(kind);
    if (v === 'ok' || v === 'error') return { kind, ok: v === 'ok', code: q.get('code') };
  }
  return null;
}

/** Aviso para un error de la vuelta. Cancelar no es un error: se informa sin alarma. */
export function oauthErrorNotice(code: string | null): { text: string; tone: 'info' | 'error' } {
  if (code === 'cancelled') return { text: MESSAGES.cancelled!, tone: 'info' };
  return { text: (code && MESSAGES[code]) || GENERIC, tone: 'error' };
}

/** La URL sin los parámetros de la vuelta, para que recargar no repita el aviso. */
export function withoutOAuthParams(href: string): string {
  const url = new URL(href);
  for (const k of ['login', 'link', 'code']) url.searchParams.delete(k);
  return url.pathname + url.search + url.hash;
}
