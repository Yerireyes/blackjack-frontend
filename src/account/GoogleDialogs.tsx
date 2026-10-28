import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Dialog } from '@/components/Dialog';
import { useAccountStore } from './accountStore';
import { ApiRequestError } from '@/api/http';
import { errorText } from './errors';
import { FormError, TextField } from './fields';

/** Vincular Google: primero la contraseña (link-intent), después la navegación a Google. */
export function GoogleLinkDialog() {
  const open = useAccountStore((s) => s.dialog === 'linkGoogle');
  const openDialog = useAccountStore((s) => s.openDialog);
  const linkGoogle = useAccountStore((s) => s.linkGoogle);
  return (
    <Dialog
      open={open}
      onClose={() => openDialog('profile')}
      title="Vincular Google"
      description="Confirma tu contraseña. Después te llevamos a Google para elegir la cuenta."
    >
      <PasswordForm
        submitLabel="Continuar con Google"
        pendingLabel="Verificando…"
        onSubmit={linkGoogle}
      />
    </Dialog>
  );
}

/** Desvincular Google: confirmación con la contraseña. */
export function GoogleUnlinkDialog() {
  const open = useAccountStore((s) => s.dialog === 'unlinkGoogle');
  const openDialog = useAccountStore((s) => s.openDialog);
  const unlinkGoogle = useAccountStore((s) => s.unlinkGoogle);
  return (
    <Dialog
      open={open}
      onClose={() => openDialog('profile')}
      title="Desvincular Google"
      description="Confirma con tu contraseña."
    >
      <div className="flex flex-col gap-4">
        <p className="flex items-start gap-2 rounded-xl border border-warn/50 bg-warn/10 p-3.5 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
          Ya no podrás entrar con Google. También se cerrará tu sesión en los demás dispositivos.
        </p>
        <PasswordForm
          submitLabel="Desvincular Google"
          pendingLabel="Desvinculando…"
          onSubmit={unlinkGoogle}
        />
      </div>
    </Dialog>
  );
}

interface FormProps {
  submitLabel: string;
  pendingLabel: string;
  onSubmit(password: string): Promise<void>;
}

/**
 * Pide la contraseña para una acción con sesión. Vive dentro del diálogo, así que la
 * contraseña se descarta al cerrarlo: nunca se guarda más allá de la llamada.
 */
function PasswordForm({ submitLabel, pendingLabel, onSubmit }: FormProps) {
  const openDialog = useAccountStore((s) => s.openDialog);
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setFieldError(null);
    setFormError(null);
    setPending(true);
    try {
      await onSubmit(password);
    } catch (e) {
      // 403 invalid_password: la sesión sigue viva, solo la contraseña está mal.
      if (e instanceof ApiRequestError && e.code === 'invalid_password') {
        setFieldError(errorText(e));
      } else {
        setFormError(errorText(e));
      }
      setPassword('');
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <TextField
        label="Contraseña"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldError}
        autoComplete="current-password"
        autoFocus
        required
      />
      <FormError text={formError} />
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn" onClick={() => openDialog('profile')}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-paper" disabled={pending || !password}>
          {pending ? pendingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
