import { useId } from 'react';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange(value: T): void;
}

/** Control segmentado accesible (radiogroup). La opción activa va en cartulina. */
export function Segmented<T extends string>({ label, value, options, onChange }: Props<T>) {
  const name = useId();
  return (
    <fieldset className="flex min-w-0 rounded-lg border border-ink-700 bg-ink-950 p-0.5">
      <legend className="sr-only">{label}</legend>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <label
            key={o.value}
            className={`relative flex-1 cursor-pointer rounded-md px-2 py-1.5 text-center text-[13px] font-medium transition-colors duration-150 select-none has-focus-visible:outline-2 has-focus-visible:outline-paper sm:px-3 ${
              on ? 'bg-paper text-paper-ink' : 'text-mute hover:text-text'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={on}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        );
      })}
    </fieldset>
  );
}
