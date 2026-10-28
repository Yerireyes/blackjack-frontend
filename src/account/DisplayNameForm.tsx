import { useState, type ReactNode } from 'react';
import { useAccountStore } from './accountStore';
import { checkDisplayName, NAME_MAX } from './displayName';
import { errorField, errorText } from './errors';
import { FormError, TextField } from './fields';

interface Props {
  initial: string;
  submitLabel: string;
  /** Botón secundario (Más tarde, Cancelar…). */
  secondary?: ReactNode;
}

/** Elegir o cambiar el nombre visible con PATCH /me. */
export function DisplayNameForm({ initial, submitLabel, secondary }: Props) {
  const updateDisplayName = useAccountStore((s) => s.updateDisplayName);
  const [name, setName] = useState(initial);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    const local = checkDisplayName(name);
    setFieldError(local);
    setFormError(null);
    if (local) return;
    setPending(true);
    try {
      await updateDisplayName(name);
    } catch (e) {
      if (errorField(e) === 'displayName') setFieldError(errorText(e));
      else setFormError(errorText(e));
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
        label="Nombre visible"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldError}
        hint="Lo verán los demás en los rankings. Tu email nunca se muestra."
        maxLength={NAME_MAX + 10}
        autoComplete="nickname"
        required
      />
      <FormError text={formError} />
      <div className="flex flex-wrap justify-end gap-2">
        {secondary}
        <button type="submit" className="btn btn-paper" disabled={pending}>
          {pending ? 'Guardando…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
