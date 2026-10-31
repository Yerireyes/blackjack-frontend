import { Eye, LogIn, Plus, RefreshCw, Sparkles, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useAccountStore } from '@/account/accountStore';
import type { RoomInfo } from '@/engine/contract';
import { PRESETS } from '@/domain/rules';
import { rulesSummary } from '@/features/settings/rulesSummary';
import { FELT } from '@/play/ServerTable';
import { useUiStore } from '@/store/uiStore';
import { CODE_LENGTH, normalizeCode } from './api';
import { CreateRoomDialog } from './CreateRoomDialog';
import { useRoomsStore } from './roomsStore';
import { TournamentBadge } from './Tournament';

/** Lobby: las salas públicas, entrar con un código y crear una sala. */
export function RoomsLobby() {
  const account = useAccountStore((s) => s.status);
  const openDialog = useAccountStore((s) => s.openDialog);
  const [creating, setCreating] = useState(false);
  const signedIn = account === 'signedIn';

  return (
    <section aria-label="Salas" className={`${FELT} justify-start`} data-testid="rooms-lobby">
      <div className="flex w-full max-w-3xl flex-col gap-6">
        <div className="flex flex-col gap-1.5 text-center sm:text-left">
          <h2 className="font-index text-3xl font-semibold tracking-[-0.01em]">Salas</h2>
          <p className="text-sm text-felt-ink">
            Mesas de 5 a 7 jugadores contra el dealer, en tiempo real. Cada sala te da una pila de
            500 fichas propia: no toca tu partida Casual ni Ranked.
          </p>
        </div>

        {!signedIn && account !== 'loading' && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-ink-700 bg-ink-950/60 p-4 sm:flex-row">
            <p className="flex-1 text-sm text-mute">
              Para entrar a una sala o crear una necesitas cuenta. La lista de salas públicas la
              puede ver cualquiera.
            </p>
            <button type="button" className="btn btn-paper h-11" onClick={() => openDialog('auth')}>
              <LogIn className="size-4" aria-hidden /> Entrar o crear cuenta
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <JoinByCode disabled={!signedIn} />
          <button
            type="button"
            className="btn btn-paper h-11 px-5"
            onClick={() => setCreating(true)}
            disabled={!signedIn}
            data-testid="room-create"
          >
            <Plus className="size-4" aria-hidden /> Crear sala
          </button>
        </div>

        <PublicRooms signedIn={signedIn} />
      </div>
      <CreateRoomDialog open={creating} onClose={() => setCreating(false)} />
    </section>
  );
}

function JoinByCode({ disabled }: { disabled: boolean }) {
  const openRoom = useUiStore((s) => s.openRoom);
  const [code, setCode] = useState('');
  const clean = normalizeCode(code);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (clean.length === CODE_LENGTH) openRoom(clean);
  };
  return (
    <form className="flex flex-1 flex-col gap-1.5" onSubmit={submit}>
      <label htmlFor="room-code" className="text-xs font-medium text-felt-ink">
        ¿Te invitaron? Escribe el código de la sala
      </label>
      <div className="flex gap-2">
        <input
          id="room-code"
          className="input flex-1 font-mono tracking-[0.2em] uppercase"
          value={code}
          onChange={(e) => setCode(e.target.value.slice(0, 12))}
          placeholder="K7Q2XP"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          data-testid="room-code-input"
        />
        <button
          type="submit"
          className="btn h-11"
          disabled={disabled || clean.length !== CODE_LENGTH}
          data-testid="room-code-join"
        >
          Entrar
        </button>
      </div>
    </form>
  );
}

function PublicRooms({ signedIn }: { signedIn: boolean }) {
  const rooms = useRoomsStore((s) => s.lobby);
  const status = useRoomsStore((s) => s.lobbyStatus);
  const load = useRoomsStore((s) => s.loadLobby);

  return (
    <section aria-labelledby="public-rooms" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 id="public-rooms" className="section-title text-felt-ink">
          Salas públicas
        </h3>
        <button
          type="button"
          className="btn h-8 min-h-0 border-transparent bg-transparent px-2 text-xs text-felt-ink"
          onClick={() => void load()}
        >
          <RefreshCw className="size-3.5" aria-hidden /> Actualizar
        </button>
      </div>
      {status === 'unavailable' && !rooms ? (
        <p className="rounded-xl border border-ink-700 bg-ink-950/50 px-4 py-3 text-sm text-mute">
          El servidor no responde ahora. Práctica sigue disponible sin conexión.
        </p>
      ) : !rooms ? (
        <p className="text-sm text-felt-ink">Cargando…</p>
      ) : rooms.length === 0 ? (
        <p className="rounded-xl border border-dashed border-felt-line px-4 py-6 text-center text-sm text-felt-ink">
          No hay salas públicas abiertas. Crea una y comparte el enlace.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2" data-testid="rooms-list">
          {rooms.map((r) => (
            <RoomCard key={r.code} room={r} signedIn={signedIn} />
          ))}
        </ul>
      )}
    </section>
  );
}

const presetName = (r: RoomInfo) =>
  PRESETS.find((p) => p.id === r.preset)?.name ?? 'Reglas propias';

function RoomCard({ room, signedIn }: { room: RoomInfo; signedIn: boolean }) {
  const openRoom = useUiStore((s) => s.openRoom);
  const full = room.seated >= room.seats;
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-ink-700/80 bg-ink-950/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{room.name}</p>
          <p className="truncate text-xs text-mute">de {room.host}</p>
          {room.tournament && (
            <span className="mt-1.5 inline-flex">
              <TournamentBadge t={room.tournament} />
            </span>
          )}
        </div>
        {room.aids ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-pos/40 bg-pos/10 px-2 py-0.5 text-[11px] font-medium text-pos">
            <Sparkles className="size-3" aria-hidden /> Con ayudas
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-ink-700 px-2 py-0.5 text-[11px] text-mute">
            Sin ayudas
          </span>
        )}
      </div>
      <p className="text-xs text-mute">
        <span className="font-medium text-text">{presetName(room)}</span> ·{' '}
        {rulesSummary(room.rules)}
      </p>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-3 text-xs text-mute">
          <span className="flex items-center gap-1" title="Asientos ocupados">
            <Users className="size-3.5" aria-hidden />
            <span className="tabular-nums">
              {room.seated}/{room.seats}
            </span>
          </span>
          <span className="flex items-center gap-1" title="Espectadores">
            <Eye className="size-3.5" aria-hidden />
            <span className="tabular-nums">{room.spectators}</span>
          </span>
        </span>
        <button
          type="button"
          className="btn h-9 min-h-0"
          onClick={() => openRoom(room.code)}
          disabled={!signedIn}
          aria-label={`${full ? 'Mirar' : 'Entrar a'} ${room.name}`}
        >
          {full ? 'Mirar' : 'Entrar'}
        </button>
      </div>
    </li>
  );
}
