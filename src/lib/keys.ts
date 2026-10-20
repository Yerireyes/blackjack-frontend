const NON_TEXT_INPUTS = new Set(['radio', 'checkbox', 'button', 'submit', 'reset']);

/** ¿El usuario está escribiendo? Entonces los atajos de una tecla no deben dispararse. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest('textarea, select, [contenteditable="true"], dialog')) return true;
  return target instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(target.type);
}
