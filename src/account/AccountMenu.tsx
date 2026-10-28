import { CheckCircle2, CloudOff, LogIn, LogOut, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Dialog } from '@/components/Dialog';
import { useAccountStore } from './accountStore';
import { googleStartUrl } from './api';
import { AuthDialog } from './AuthDialog';
import { DisplayNameForm } from './DisplayNameForm';
import { errorText } from './errors';
import { FormError } from './fields';

/** Botón de cuenta de la cabecera y sus diálogos. */
export function AccountMenu() {
  const status = useAccountStore((s) => s.status);
  const me = useAccountStore((s) => s.me);
  const openDialog = useAccountStore((s) => s.openDialog);
  const init = useAccountStore((s) => s.init);

  return (
    <>
      {status === 'loading' ? (
        <span className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-ink-800" aria-hidden />
      ) : status === 'unavailable' ? (
        <button
          type="button"
          className="btn h-9 min-h-0 shrink-0 px-2.5"
          onClick={() => void init()}
          aria-label="Cuentas no disponibles. Reintentar"
          title="El servidor de cuentas no responde. Toca para reintentar."
        >
          <CloudOff className="size-4 text-mute" aria-hidden />
        </button>
      ) : status === 'signedIn' && me ? (
        <button
          type="button"
          className="btn h-9 min-h-0 max-w-40 shrink-0 gap-2 px-2.5"
          onClick={() => openDialog('profile')}
          aria-label={`Tu cuenta: ${me.displayName}`}
          data-testid="account-button"
        >
          <UserRound className="size-4 shrink-0 text-mute" aria-hidden />
          <span className="hidden truncate text-[13px] font-semibold sm:inline">
            {me.displayName}
          </span>
        </button>
      ) : (
        <button
          type="button"
          className="btn h-9 min-h-0 shrink-0 gap-2 px-3 text-[13px]"
          onClick={() => openDialog('auth')}
          data-testid="login-button"
        >
          <LogIn className="size-4 text-mute" aria-hidden />
          Entrar
        </button>
      )}
      <AuthDialog />
      <ProfileDialog />
      <NameDialog />
    </>
  );
}

function ProfileDialog() {
  const open = useAccountStore((s) => s.dialog === 'profile');
  const me = useAccountStore((s) => s.me);
  const google = useAccountStore((s) => s.providers.google);
  const openDialog = useAccountStore((s) => s.openDialog);
  const logout = useAccountStore((s) => s.logout);
  const logoutAll = useAccountStore((s) => s.logoutAll);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  if (!me) return null;
  const linked = me.providers.includes('google');

  async function end(call: () => Promise<void>) {
    setError(null);
    setPending(true);
    try {
      await call();
      setConfirmAll(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setPending(false);
    }
  }
  const doLogout = () => end(logout);

  return (
    <Dialog
      open={open}
      onClose={() => {
        setConfirmAll(false);
        openDialog(null);
      }}
      title="Tu cuenta"
      description={me.email}
      footer={
        <button type="button" className="btn" onClick={() => void doLogout()} disabled={pending}>
          <LogOut className="size-4" aria-hidden /> Cerrar sesión
        </button>
      }
    >
      <div className="flex flex-col gap-6">
        {/* La key reinicia el formulario si el nombre cambia desde otro lado. */}
        <DisplayNameForm
          key={me.displayName}
          initial={me.displayName}
          submitLabel="Guardar nombre"
        />

        {(linked || google) && (
          <section aria-labelledby="google-title" className="flex flex-col gap-2">
            <h3 id="google-title" className="section-title">
              Google
            </h3>
            {linked ? (
              <p className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4 text-pos" aria-hidden /> Google vinculado
              </p>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-mute">Entra también con tu cuenta de Google.</p>
                <button
                  type="button"
                  className="btn"
                  onClick={() => window.location.assign(googleStartUrl(true))}
                >
                  Vincular Google
                </button>
              </div>
            )}
          </section>
        )}

        <section aria-labelledby="sessions-title" className="flex flex-col gap-2">
          <h3 id="sessions-title" className="section-title">
            Sesiones
          </h3>
          {confirmAll ? (
            <div
              role="group"
              aria-label="Confirmar cierre de sesión en todos los dispositivos"
              className="flex flex-col gap-3 rounded-xl border border-warn/50 bg-warn/10 p-3.5"
            >
              <p className="text-sm">
                Se cerrará tu sesión en todos los dispositivos, también en este. Tendrás que volver
                a entrar en cada uno.
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setConfirmAll(false)}
                  disabled={pending}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-paper"
                  onClick={() => void end(logoutAll)}
                  disabled={pending}
                  data-testid="logout-all-confirm"
                >
                  {pending ? 'Cerrando…' : 'Sí, cerrar en todos'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-mute">¿Entraste en un dispositivo que no es tuyo?</p>
              <button
                type="button"
                className="btn"
                onClick={() => setConfirmAll(true)}
                disabled={pending}
              >
                Cerrar sesión en todos los dispositivos
              </button>
            </div>
          )}
        </section>
        <FormError text={error} />
      </div>
    </Dialog>
  );
}

/** Nombre provisional (cuenta de Google o anterior a los nombres): se ofrece elegir uno. */
function NameDialog() {
  const open = useAccountStore((s) => s.dialog === 'name');
  const me = useAccountStore((s) => s.me);
  const deferName = useAccountStore((s) => s.deferName);
  if (!me) return null;

  return (
    <Dialog
      open={open}
      onClose={deferName}
      title="Elige tu nombre"
      description={`Ahora tienes un nombre provisional: ${me.displayName}.`}
    >
      <DisplayNameForm
        initial=""
        submitLabel="Guardar"
        secondary={
          <button type="button" className="btn" onClick={deferName}>
            Más tarde
          </button>
        }
      />
    </Dialog>
  );
}
