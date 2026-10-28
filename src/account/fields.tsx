import { useId, type InputHTMLAttributes } from 'react';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | null;
  hint?: string;
}

/** Campo con etiqueta, ayuda y error asociados para lectores de pantalla. */
export function TextField({ label, error, hint, ...input }: FieldProps) {
  const id = useId();
  const note = error ?? hint;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? `${id}-note` : undefined}
        {...input}
      />
      {note && (
        <p id={`${id}-note`} className={`text-xs ${error ? 'text-neg' : 'text-faint'}`}>
          {note}
        </p>
      )}
    </div>
  );
}

export function FormError({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p
      role="alert"
      className="rounded-lg border border-neg/40 bg-neg/10 px-3 py-2 text-sm text-neg"
    >
      {text}
    </p>
  );
}
