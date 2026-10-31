// Torneos en sala: todos empiezan con 500 fichas de torneo, sin recompras, durante N manos.
// El servidor lleva la clasificación; aquí se muestra y el anfitrión lo inicia.
import { Crown, Medal, Play, Trophy } from 'lucide-react';
import type { RoomState, TournamentSettings } from '@/engine/contract';
import { formatChips } from '@/lib/format';
import { PlayerName } from './parts';
import { useRoomsStore } from './roomsStore';

/** «Torneo · 10 manos» (en el lobby y en la cabecera de la sala). */
export function TournamentBadge({ t }: { t: TournamentSettings }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-warn/40 bg-warn/10 px-2 py-0.5 text-[11px] font-medium text-warn">
      <Trophy className="size-3" aria-hidden /> Torneo · {t.hands} manos
    </span>
  );
}

/** Antes de empezar (o entre torneos): el anfitrión lo inicia con 2 o más sentados. */
export function TournamentStart({ room }: { room: RoomState }) {
  const me = useRoomsStore((s) => s.me);
  const start = useRoomsStore((s) => s.startTournament);
  const t = room.tournament;
  if (!t || t.status === 'running') return null;
  const seated = room.seats.filter((s) => s.player).length;
  const host = me !== null && me === room.hostId;
  const again = t.status === 'finished';
  if (!host) {
    return (
      <p className="text-center text-sm text-felt-ink" data-testid="tournament-waiting">
        {again
          ? 'El anfitrión puede iniciar otro torneo.'
          : 'Esperando a que el anfitrión inicie el torneo.'}{' '}
        {seated} {seated === 1 ? 'sentado' : 'sentados'}.
      </p>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <button
        type="button"
        className="btn btn-paper h-11 px-5"
        onClick={start}
        disabled={seated < 2}
        data-testid="tournament-start"
      >
        <Play className="size-4" aria-hidden /> {again ? 'Iniciar otro torneo' : 'Iniciar torneo'}
      </button>
      <p className="text-xs text-felt-ink">
        {seated < 2
          ? 'Hacen falta al menos 2 jugadores sentados.'
          : `${t.hands} manos con 500 fichas de torneo, sin recompras. Gana la pila más alta.`}
      </p>
    </div>
  );
}

/** Al terminar: el ganador y los tres primeros. */
export function Podium({ room }: { room: RoomState }) {
  const me = useRoomsStore((s) => s.me);
  const t = room.tournament;
  if (t?.status !== 'finished') return null;
  const top = t.standings.slice(0, 3);
  return (
    <section
      aria-label="Resultado del torneo"
      className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border border-warn/40 bg-felt-950/60 px-4 py-4 text-center"
      data-testid="tournament-podium"
    >
      <Crown className="size-6 text-warn" aria-hidden />
      <p className="text-base font-semibold">
        {t.winner ? (
          <>{t.winner.id === me ? '¡Ganaste el torneo!' : `Ganó ${t.winner.displayName}`}</>
        ) : (
          'Terminó el torneo'
        )}
      </p>
      <ol className="flex w-full flex-col gap-1 text-sm">
        {top.map((s) => (
          <li key={s.player.id} className="flex items-center gap-2">
            <Medal
              className={`size-4 shrink-0 ${s.rank === 1 ? 'text-warn' : s.rank === 2 ? 'text-text' : 'text-[#c98a4b]'}`}
              aria-label={`Puesto ${s.rank}`}
            />
            <span className="min-w-0 flex-1 truncate text-left">
              <PlayerName player={s.player} me={s.player.id === me} />
            </span>
            <span className="tabular-nums">{formatChips(s.stack)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** En el panel, en lugar del ranking de la sala: posición, pila y eliminados. */
export function Standings({ room }: { room: RoomState }) {
  const me = useRoomsStore((s) => s.me);
  const t = room.tournament!;
  return (
    <section aria-labelledby="tournament-board" className="flex flex-col gap-3">
      <h2 id="tournament-board" className="section-title flex items-center gap-1.5">
        <Trophy className="size-3.5" aria-hidden /> Clasificación del torneo
      </h2>
      <p className="-mt-1.5 text-xs text-faint">
        {t.status === 'waiting'
          ? `${t.hands} manos con 500 fichas de torneo, sin recompras.`
          : t.status === 'running'
            ? `${t.played} de ${t.hands} manos jugadas.`
            : 'Clasificación final.'}
      </p>
      {t.standings.length === 0 ? (
        <p className="text-sm text-mute">Empieza cuando el anfitrión lo inicie.</p>
      ) : (
        <ol
          className="flex flex-col divide-y divide-ink-800 rounded-xl border border-ink-800"
          data-testid="tournament-standings"
        >
          {t.standings.map((s) => {
            const mine = s.player.id === me;
            return (
              <li
                key={s.player.id}
                className={`flex items-center gap-3 px-3 py-2 text-sm ${mine ? 'bg-paper/10 font-semibold' : ''} ${s.out ? 'opacity-60' : ''}`}
                aria-current={mine ? 'true' : undefined}
              >
                <span className="w-5 text-right text-mute tabular-nums">{s.rank}</span>
                <span className="min-w-0 flex-1 truncate">
                  <PlayerName player={s.player} me={mine} />
                </span>
                {s.out && <span className="text-xs font-normal text-neg">eliminado</span>}
                <span className="tabular-nums">{formatChips(s.stack)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
