import { Mail, UserMinus, UserPlus, Users } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useAccountStore } from '@/account/accountStore';
import { FormError } from '@/account/fields';
import { Dialog } from '@/components/Dialog';
import type { FriendView, RoomPlayer } from '@/engine/contract';
import { PlayerTitle } from '@/progress/PlayerTitle';
import { useUiStore } from '@/store/uiStore';
import { badgeOf, useFriendsStore } from './friendsStore';
import { ReportButton } from '@/moderation/Report';

/** Botón de amigos de la cabecera, con un globo por solicitudes e invitaciones. */
export function FriendsButton() {
  const signedIn = useAccountStore((s) => s.status === 'signedIn');
  const badge = useFriendsStore(badgeOf);
  const setOpen = useFriendsStore((s) => s.setOpen);
  if (!signedIn) return null;
  return (
    <>
      <button
        type="button"
        className="btn relative h-9 min-h-0 shrink-0 px-2.5"
        onClick={() => setOpen(true)}
        aria-label={badge ? `Amigos (${badge} pendientes)` : 'Amigos'}
        title="Amigos"
        data-testid="friends-button"
      >
        <Users className="size-4 text-mute" aria-hidden />
        {badge > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-pip px-1 text-[10px] font-bold text-white tabular-nums"
            aria-hidden
          >
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </button>
      <FriendsDialog />
    </>
  );
}

function FriendsDialog() {
  const open = useFriendsStore((s) => s.open);
  const setOpen = useFriendsStore((s) => s.setOpen);
  const view = useFriendsStore((s) => s.view);
  const status = useFriendsStore((s) => s.status);

  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Amigos" wide>
      <div className="flex flex-col gap-6" data-testid="friends-dialog">
        <AddFriend />
        {!view ? (
          <p className="text-sm text-mute">
            {status === 'unavailable' ? 'El servidor no responde ahora.' : 'Cargando…'}
          </p>
        ) : (
          <>
            {view.invitations.length > 0 && (
              <Section title="Invitaciones a salas" testId="friends-invitations">
                {view.invitations.map((inv) => (
                  <Invitation
                    key={inv.id}
                    id={inv.id}
                    from={inv.from}
                    roomName={inv.room.name}
                    code={inv.room.code}
                  />
                ))}
              </Section>
            )}
            {view.incoming.length > 0 && (
              <Section title="Solicitudes recibidas" testId="friends-incoming">
                {view.incoming.map((r) => (
                  <Incoming key={r.user.id} user={r.user} />
                ))}
              </Section>
            )}
            <Section
              title={`Tus amigos${view.friends.length ? ` (${view.friends.length})` : ''}`}
              testId="friends-list"
            >
              {view.friends.length === 0 ? (
                <p className="py-2 text-sm text-mute">
                  Todavía no tienes amigos agregados. Escribe el nombre de alguien arriba.
                </p>
              ) : (
                view.friends.map((f) => <Friend key={f.user.id} f={f} />)
              )}
            </Section>
            {view.outgoing.length > 0 && (
              <Section title="Solicitudes enviadas" testId="friends-outgoing">
                {view.outgoing.map((r) => (
                  <Outgoing key={r.user.id} user={r.user} />
                ))}
              </Section>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}

function AddFriend() {
  const request = useFriendsStore((s) => s.request);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const failed = await request(name);
    setBusy(false);
    setError(failed);
    if (!failed) setName('');
  }
  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => void submit(e)}>
      <label htmlFor="friend-name" className="text-sm font-medium">
        Agregar por nombre
      </label>
      <div className="flex gap-2">
        <input
          id="friend-name"
          className="input min-w-0 flex-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Su nombre en los rankings"
          autoComplete="off"
          maxLength={40}
          data-testid="friend-name"
        />
        <button
          type="submit"
          className="btn h-11"
          disabled={busy || !name.trim()}
          data-testid="friend-add"
        >
          <UserPlus className="size-4" aria-hidden /> Enviar solicitud
        </button>
      </div>
      <FormError text={error} />
    </form>
  );
}

function Section({
  title,
  testId,
  children,
}: {
  title: string;
  testId: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1" data-testid={testId}>
      <h3 className="section-title mb-1">{title}</h3>
      <ul className="flex flex-col divide-y divide-ink-800">{children}</ul>
    </section>
  );
}

function Name({ user }: { user: RoomPlayer }) {
  return (
    <span className="truncate font-medium">
      {user.displayName}
      <PlayerTitle id={user.title} />
    </span>
  );
}

function Row({ children, actions }: { children: ReactNode; actions: ReactNode }) {
  return (
    <li className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1.5 py-2 text-sm">
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
      <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
    </li>
  );
}

function useBusy(id: string) {
  return useFriendsStore((s) => s.pending.includes(id));
}

function Invitation({
  id,
  from,
  roomName,
  code,
}: {
  id: string;
  from: RoomPlayer;
  roomName: string;
  code: string;
}) {
  const dismiss = useFriendsStore((s) => s.dismiss);
  const setOpen = useFriendsStore((s) => s.setOpen);
  const openRoom = useUiStore((s) => s.openRoom);
  const busy = useBusy(id);
  return (
    <Row
      actions={
        <>
          <button
            type="button"
            className="btn h-9 min-h-0"
            onClick={() => void dismiss(id)}
            disabled={busy}
          >
            Descartar
          </button>
          <button
            type="button"
            className="btn btn-paper h-9 min-h-0"
            onClick={() => {
              setOpen(false);
              openRoom(code);
            }}
          >
            Unirme
          </button>
        </>
      }
    >
      <Mail className="size-4 shrink-0 text-warn" aria-hidden />
      <span className="min-w-0 truncate">
        <Name user={from} /> <span className="text-mute">te invita a</span>{' '}
        <span className="font-medium">{roomName}</span>
      </span>
    </Row>
  );
}

function Incoming({ user }: { user: RoomPlayer }) {
  const accept = useFriendsStore((s) => s.accept);
  const decline = useFriendsStore((s) => s.decline);
  const busy = useBusy(user.id);
  return (
    <Row
      actions={
        <>
          <button
            type="button"
            className="btn h-9 min-h-0"
            onClick={() => void decline(user.id)}
            disabled={busy}
          >
            Rechazar
          </button>
          <button
            type="button"
            className="btn btn-paper h-9 min-h-0"
            onClick={() => void accept(user.id)}
            disabled={busy}
            aria-label={`Aceptar a ${user.displayName}`}
          >
            Aceptar
          </button>
        </>
      }
    >
      <Name user={user} />
    </Row>
  );
}

function Outgoing({ user }: { user: RoomPlayer }) {
  const decline = useFriendsStore((s) => s.decline);
  const busy = useBusy(user.id);
  return (
    <Row
      actions={
        <button
          type="button"
          className="btn h-9 min-h-0"
          onClick={() => void decline(user.id)}
          disabled={busy}
        >
          Cancelar
        </button>
      }
    >
      <Name user={user} />
      <span className="text-xs text-faint">pendiente</span>
    </Row>
  );
}

function Friend({ f }: { f: FriendView }) {
  const remove = useFriendsStore((s) => s.remove);
  const setOpen = useFriendsStore((s) => s.setOpen);
  const openRoom = useUiStore((s) => s.openRoom);
  const busy = useBusy(f.user.id);
  const [confirm, setConfirm] = useState(false);
  return (
    <Row
      actions={
        confirm ? (
          <>
            <button type="button" className="btn h-9 min-h-0" onClick={() => setConfirm(false)}>
              No
            </button>
            <button
              type="button"
              className="btn h-9 min-h-0 border-neg/50 text-neg"
              onClick={() => void remove(f.user.id)}
              disabled={busy}
            >
              Sí, eliminar
            </button>
          </>
        ) : (
          <>
            <ReportButton name={f.user.displayName} />
            {f.room && (
              <button
                type="button"
                className="btn btn-paper h-9 min-h-0"
                onClick={() => {
                  setOpen(false);
                  openRoom(f.room!.code);
                }}
                aria-label={`Unirme a ${f.room.name}`}
              >
                Unirme
              </button>
            )}
            <button
              type="button"
              className="btn h-9 min-h-0 px-2.5"
              onClick={() => setConfirm(true)}
              aria-label={`Eliminar a ${f.user.displayName} de tus amigos`}
              title="Eliminar de tus amigos"
            >
              <UserMinus className="size-4 text-mute" aria-hidden />
            </button>
          </>
        )
      }
    >
      <span
        className={`size-2 shrink-0 rounded-full ${f.online ? 'bg-pos' : 'bg-ink-600'}`}
        aria-label={f.online ? 'Conectado' : 'Desconectado'}
        role="img"
      />
      <span className="flex min-w-0 flex-col">
        <Name user={f.user} />
        <span className="truncate text-xs text-faint">
          {f.room ? `Jugando en ${f.room.name}` : f.online ? 'Conectado' : 'Desconectado'}
        </span>
      </span>
    </Row>
  );
}
