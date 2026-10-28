// Aviso temprano del formato del nombre visible. Quien decide es el servidor (incluidos los
// nombres reservados, que llegan como display_name_invalid); esto solo evita un viaje.

export const NAME_MIN = 3;
export const NAME_MAX = 20;

// Letras latinas ASCII y Latin-1 (tildes, ñ, ü, ç…), dígitos, _ y -.
const WORD = /^[A-Za-z0-9À-ÖØ-öø-ÿ_-]+$/;
const ALNUM = /[A-Za-z0-9À-ÖØ-öø-ÿ]/;

/** Como lo normaliza el servidor: sin espacios en los extremos y en NFC. */
export const normalizeName = (name: string) => name.trim().normalize('NFC');

/** Mensaje de error, o null si el formato es válido. */
export function checkDisplayName(raw: string): string | null {
  const name = normalizeName(raw);
  const length = [...name].length;
  if (length < NAME_MIN || length > NAME_MAX) {
    return `El nombre debe tener entre ${NAME_MIN} y ${NAME_MAX} caracteres.`;
  }
  if (!name.split(' ').every((w) => WORD.test(w))) {
    return 'Usa letras, números, _ o - y un solo espacio entre palabras.';
  }
  if (!ALNUM.test(name)) return 'El nombre necesita al menos una letra o un número.';
  return null;
}
