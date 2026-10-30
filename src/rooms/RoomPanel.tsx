import { Crown, DoorOpen, Eye, Info, Trophy, UserX } from 'lucide-react';
import { useState } from 'react';
import type { RoomPlayer, RoomState } from '@/engine/contract';
import { PRESETS } from '@/domain/rules';
import { PlayerView } from '@/features/player-mode/PlayerView';
import { rulesSummary } from '@/features/settings/rulesSummary';
import { formatChips } from '@/lib/format';
import { useUiStore } from '@/store/uiStore';
import { PlayerName } from './parts';
import { useRoomsStore } from './roomsStore';

/** Panel lateral: ayudas (si las hay), la mesa, el ranking de la sala y quién está. */
export function RoomPanel() {
  const room = useRoomsStore((s) => s.room);
  const code = useUiStore((s) => s.roomCode);
  if (!code) return <LobbyHelp />;
  if (!room) return null;
  return (
    <div className="flex flex-col gap-7">
      {room.info.aids ? (
        <PlayerView />
      ) : (
        <p className="rounded-xl border border-ink-800 px-4 py-3 text-sm text-mute">
          <span className="font-semibold text-text">Sala sin ayudas.</span> El anfitrión eligió
          jugar sin EV ni recomendaciones, como en Ranked.
        </p>
      )}
      <Leaderboard room={room} />
      <People room={room} />
      <TableInfo room={room} />
      <LeaveRoom />
    </div>
  );
}

function Leaderboard({ room }: { room: RoomState }) {
  const me = useRoomsStore((s) => s.me);
  return (
    <section aria-labelledby="room-board" className="flex flex-col gap-3">
      <h2 id="room-board" className="section-title flex items-center gap-1.5">
        <Trophy className="size-3.5" aria-hidden /> Ranking de la sala
      </h2>
      <p className="-mt-1.5 text-xs text-faint">
        Neto = pila − 500 por compra. Se borra cuando cierra la sala.
      </p>
      {room.leaderboard.length === 0 ? (
        <p className="text-sm text-mute">Todavía nadie se sentó.</p>
      ) : (
        <ol
          className="flex flex-col divide-y divide-ink-800 rounded-xl border border-ink-800"
          data-testid="room-leaderboard"
        >
          {room.leaderboard.map((r, i) => {
            const mine = r.player.id === me;
            return (
              <li
                key={r.player.id}
                className={`flex items-center gap-3 px-3 py-2 text-sm ${mine ? 'bg-paper/10 font-semibold' : ''}`}
                aria-current={mine ? 'true' : undefined}
              >
                <span className="w-5 text-right text-mute tabular-nums">{i + 1}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">
                    <PlayerName player={r.player} me={mine} />
                  </span>
                  <span className="text-xs font-normal text-faint">
                    {r.hands} {r.hands === 1 ? 'mano' : 'manos'} · {r.buyIns}{' '}
                    {r.buyIns === 1 ? 'compra' : 'compras'}
                  </span>
                </span>
                <span
                  className={`tabular-nums ${r.net > 0 ? 'text-pos' : r.net < 0 ? 'text-neg' : ''}`}
                >
                  {formatChips(r.net, true)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/** Jugadores sentados y espectadores; el anfitrión puede sacar a cualquiera. */
function People({ room }: { room: RoomState }) {
  const me = useRoomsStore((s) => s.me);
  const host = me !== null && me === room.hostId;
  const seated = room.seats.flatMap((s) => (s.player ? [s.player] : []));
  return (
    <section aria-labelledby="room-people" className="flex flex-col gap-3">
      <h2 id="room-people" className="section-title flex items-center gap-1.5">
        <Eye className="size-3.5" aria-hidden /> En la sala
      </h2>
      <ul className="flex flex-col gap-1" data-testid="room-people">
        {seated.map((p) => (
          <Person key={p.id} p={p} room={room} host={host} me={me} role="Jugando" />
        ))}
        {room.spectators.map((p) => (
          <Person key={p.id} p={p} room={room} host={host} me={me} role="Mirando" />
        ))}
      </ul>
      <p className="text-xs text-faint">
        {room.spectators.length} de {room.info.maxSpectators} espectadores.
      </p>
    </section>
  );
}

function Person({
  p,
  room,
  host,
  me,
  role,
}: {
  p: RoomPlayer;
  room: RoomState;
  host: boolean;
  me: string | null;
  role: string;
}) {
  const kick = useRoomsStore((s) => s.kick);
  const [confirm, setConfirm] = useState(false);
  const mine = p.id === me;
  return (
    <li className="flex min-h-9 items-center gap-2 text-sm">
      {p.id === room.hostId ? (
        <Crown className="size-3.5 shrink-0 text-warn" aria-label="Anfitrión" />
      ) : (
        <span className="size-3.5 shrink-0" aria-hidden />
      )}
      <span className="min-w-0 flex-1 truncate">
        <PlayerName player={p} me={mine} />
      </span>
      <span className="text-xs text-faint">{role}</span>
      {host &&
        !mine &&
        (confirm ? (
          <span className="flex items-center gap-1">
            <button
              type="button"
              className="btn h-7 min-h-0 px-2 text-xs"
              onClick={() => setConfirm(false)}
            >
              No
            </button>
            <button
              type="button"
              className="btn h-7 min-h-0 border-neg/50 px-2 text-xs text-neg"
              onClick={() => kick(p.id)}
              aria-label={`Sí, sacar a ${p.displayName} de la sala`}
            >
              Sacar
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="btn h-7 min-h-0 px-2 text-xs"
            onClick={() => setConfirm(true)}
            aria-label={`Sacar a ${p.displayName} de la sala`}
            title="No podrá volver a entrar"
          >
            <UserX className="size-3.5" aria-hidden />
          </button>
        ))}
    </li>
  );
}

function TableInfo({ room }: { room: RoomState }) {
  const preset = PRESETS.find((p) => p.id === room.info.preset)?.name ?? 'Reglas propias';
  return (
    <section aria-labelledby="room-info" className="flex flex-col gap-2">
      <h2 id="room-info" className="section-title">
        La mesa
      </h2>
      <p className="text-sm">
        <span className="font-semibold">{preset}</span>{' '}
        <span className="text-mute">· {rulesSummary(room.info.rules)}</span>
      </p>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-mute">
        <li>
          {room.info.seats} asientos · {room.info.aids ? 'con ayudas' : 'sin ayudas'} · zapato
          repartido {Math.round(room.penetration * 100)} %
        </li>
        <li>Pila propia de 500 fichas; con menos de 10 puedes recomprar.</li>
        <li>20 s por decisión: al vencer, el servidor se planta por ti.</li>
        <li>Si no apuestas en 3 rondas seguidas, pasas a mirar.</li>
      </ul>
    </section>
  );
}

function LeaveRoom() {
  const openRoom = useUiStore((s) => s.openRoom);
  return (
    <button type="button" className="btn self-start" onClick={() => openRoom(null)}>
      <DoorOpen className="size-4" aria-hidden /> Salir de la sala
    </button>
  );
}

function LobbyHelp() {
  return (
    <section aria-labelledby="rooms-help" className="flex flex-col gap-3">
      <h2 id="rooms-help" className="section-title flex items-center gap-1.5">
        <Info className="size-3.5" aria-hidden /> Cómo funcionan las salas
      </h2>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-mute">
        <li>Mesas de 5 a 7 asientos contra el dealer; hasta 10 personas más pueden mirar.</li>
        <li>Al entrar miras; para jugar, elige un asiento libre.</li>
        <li>Cada sala te da 500 fichas propias, con recompra. No tocan Casual ni Ranked.</li>
        <li>20 s por decisión. Solo reacciones, sin chat.</li>
        <li>El anfitrión elige reglas y si hay ayudas, y puede sacar a quien moleste.</li>
        <li>El ranking de la sala dura lo que dure la sala.</li>
      </ul>
    </section>
  );
}
