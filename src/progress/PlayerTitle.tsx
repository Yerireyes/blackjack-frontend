import type { CosmeticId } from '@/engine/contract';
import { titleName } from './catalog';

/**
 * El título que el jugador lleva puesto ahora, tras su nombre en los rankings
 * («Ana · Cabeza fría»). Sin título, o con uno que el front no conoce, nada.
 */
export function PlayerTitle({ id }: { id?: CosmeticId }) {
  const name = id ? titleName(id) : null;
  if (!name) return null;
  return (
    <span className="font-normal text-warn" data-testid="player-title">
      {' · '}
      {name}
    </span>
  );
}
