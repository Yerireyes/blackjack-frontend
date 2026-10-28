// De dónde sale cada ficha que se apuesta: la bandeja registra la posición del botón y la
// pila, al montar la ficha, la hace viajar desde ahí hasta su lugar en la mesa.

const origins = new Map<number, DOMRect>();

export function setFlightOrigin(chipId: number, rect: DOMRect) {
  origins.set(chipId, rect);
}

/** Devuelve el origen y lo olvida: cada ficha viaja una sola vez. */
export function takeFlightOrigin(chipId: number) {
  const rect = origins.get(chipId);
  origins.delete(chipId);
  return rect;
}
