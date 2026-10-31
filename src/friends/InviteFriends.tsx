import { Check, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Dialog } from '@/components/Dialog';
import { PlayerTitle } from '@/progress/PlayerTitle';
import { useFriendsStore } from './friendsStore';

/** En una sala: invitar a amigos (también a una sala privada). Volver a invitar la renueva. */
export function InviteFriends({ code, inRoom }: { code: string; inRoom: ReadonlySet<string> }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<string[]>([]);
  const friends = useFriendsStore((s) => s.view?.friends ?? []);
  const pending = useFriendsStore((s) => s.pending);
  const invite = useFriendsStore((s) => s.invite);

  return (
    <>
      <button
        type="button"
        className="btn self-start"
        onClick={() => setOpen(true)}
        data-testid="room-invite"
      >
        <UserPlus className="size-4" aria-hidden /> Invitar amigos
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Invitar amigos"
        description={`Les llega una invitación a la sala ${code} durante 30 minutos.`}
      >
        {friends.length === 0 ? (
          <p className="text-sm text-mute">
            Todavía no tienes amigos agregados. Agrégalos desde el botón de amigos de la cabecera.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-ink-800" data-testid="invite-list">
            {friends.map((f) => {
              const here = inRoom.has(f.user.id);
              const done = sent.includes(f.user.id);
              return (
                <li key={f.user.id} className="flex min-h-12 items-center gap-3 py-2 text-sm">
                  <span
                    className={`size-2 shrink-0 rounded-full ${f.online ? 'bg-pos' : 'bg-ink-600'}`}
                    aria-label={f.online ? 'Conectado' : 'Desconectado'}
                    role="img"
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {f.user.displayName}
                    <PlayerTitle id={f.user.title} />
                  </span>
                  {here ? (
                    <span className="text-xs text-faint">Ya está en la sala</span>
                  ) : (
                    <button
                      type="button"
                      className={`btn h-9 min-h-0 ${done ? '' : 'btn-paper'}`}
                      disabled={pending.includes(`invite-${f.user.id}`)}
                      onClick={async () => {
                        if (await invite(code, f.user.id)) setSent((s) => [...s, f.user.id]);
                      }}
                      aria-label={`${done ? 'Volver a invitar' : 'Invitar'} a ${f.user.displayName}`}
                    >
                      {done ? (
                        <>
                          <Check className="size-4 text-pos" aria-hidden /> Invitado
                        </>
                      ) : (
                        'Invitar'
                      )}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Dialog>
    </>
  );
}
