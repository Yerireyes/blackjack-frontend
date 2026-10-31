// Piezas pequeñas de las salas: la barra del temporizador y el nombre con título.
import type { RoomPlayer } from '@/engine/contract';
import { PlayerTitle } from '@/progress/PlayerTitle';

/** Barra que se vacía con el temporizador (turno o apuestas). */
export function TimerBar({
  ms,
  total,
  urgent = false,
}: {
  ms: number;
  total: number;
  urgent?: boolean;
}) {
  return (
    <span className="block h-1 w-full overflow-hidden rounded-full bg-felt-950/60" aria-hidden>
      <span
        className={`block h-full rounded-full transition-[width] duration-250 ease-linear ${urgent ? 'bg-warn' : 'bg-paper/80'}`}
        style={{ width: `${Math.min(1, ms / total) * 100}%` }}
      />
    </span>
  );
}

export function PlayerName({ player, me }: { player: RoomPlayer; me: boolean }) {
  return (
    <>
      {player.displayName}
      <PlayerTitle id={player.title} />
      {me && <span className="font-normal text-mute"> (tú)</span>}
    </>
  );
}
