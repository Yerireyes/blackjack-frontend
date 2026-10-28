import { useState } from 'react';
import { Dialog } from '@/components/Dialog';
import { Segmented } from '@/components/Segmented';
import { useAccountStore } from './accountStore';
import { googleStartUrl } from './api';
import { checkDisplayName, NAME_MAX } from './displayName';
import { errorField, errorText } from './errors';
import { FormError, TextField } from './fields';

type Tab = 'login' | 'register';

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

/** Entrar o crear cuenta. Google solo aparece si el servidor lo tiene habilitado. */
export function AuthDialog() {
  const open = useAccountStore((s) => s.dialog === 'auth');
  const openDialog = useAccountStore((s) => s.openDialog);
  const google = useAccountStore((s) => s.providers.google);
  const [tab, setTab] = useState<Tab>('login');

  return (
    <Dialog
      open={open}
      onClose={() => openDialog(null)}
      title={tab === 'login' ? 'Entrar' : 'Crear cuenta'}
      description="La cuenta es para Casual y Ranked. Práctica sigue funcionando sin ella."
    >
      <div className="flex flex-col gap-5">
        <Segmented<Tab>
          label="Entrar o crear cuenta"
          value={tab}
          options={[
            { value: 'login', label: 'Entrar' },
            { value: 'register', label: 'Crear cuenta' },
          ]}
          onChange={setTab}
        />
        {/* La key reinicia el formulario (y sus errores) al cambiar de pestaña. */}
        {tab === 'login' ? <LoginForm key="login" /> : <RegisterForm key="register" />}
        {google && (
          <>
            <div className="flex items-center gap-3 text-xs text-faint" aria-hidden>
              <span className="h-px flex-1 bg-ink-700" /> o{' '}
              <span className="h-px flex-1 bg-ink-700" />
            </div>
            <button
              type="button"
              className="btn h-11"
              // Navegación completa: el servidor redirige a Google y Google vuelve a la app.
              onClick={() => window.location.assign(googleStartUrl())}
            >
              Continuar con Google
            </button>
          </>
        )}
      </div>
    </Dialog>
  );
}

function LoginForm() {
  const login = useAccountStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setError(null);
    setPending(true);
    try {
      await login(email, password);
    } catch (e) {
      // El servidor no distingue email inexistente, contraseña mal o cuenta solo de Google.
      setError(errorText(e));
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
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
      />
      <TextField
        label="Contraseña"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        required
      />
      <FormError text={error} />
      <button type="submit" className="btn btn-paper h-11" disabled={pending}>
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}

function RegisterForm() {
  const register = useAccountStore((s) => s.register);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    displayName?: string;
    form?: string;
  }>({});
  const [pending, setPending] = useState(false);

  async function submit() {
    const length = [...password].length;
    const local = {
      password:
        length < PASSWORD_MIN || length > PASSWORD_MAX
          ? `La contraseña debe tener entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres.`
          : undefined,
      displayName: checkDisplayName(displayName) ?? undefined,
    };
    setErrors(local);
    if (local.password || local.displayName) return;
    setPending(true);
    try {
      await register({ email, password, displayName });
    } catch (e) {
      setErrors({ [errorField(e)]: errorText(e) });
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
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
        hint="No se muestra a nadie."
        autoComplete="email"
        required
      />
      <TextField
        label="Contraseña"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        hint={`Entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres.`}
        autoComplete="new-password"
        required
      />
      <TextField
        label="Nombre visible"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        error={errors.displayName}
        hint="3–20 caracteres. Es lo que verán los demás en los rankings."
        maxLength={NAME_MAX + 10}
        autoComplete="nickname"
        required
      />
      <FormError text={errors.form ?? null} />
      <button type="submit" className="btn btn-paper h-11" disabled={pending}>
        {pending ? 'Creando cuenta…' : 'Crear cuenta'}
      </button>
    </form>
  );
}
