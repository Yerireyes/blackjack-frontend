import { formatPct } from '@/lib/format';

interface Props {
  win: number;
  push: number;
  lose: number;
  /** "por mano" para dividir. */
  note?: string;
  onPaper?: boolean;
}

/**
 * Barra apilada ganar / empatar / perder sobre una escala fija de 0 a 100 %,
 * siempre con las cifras en texto: el color nunca es la única señal.
 */
export function ProbBar({ win, push, lose, note, onPaper = false }: Props) {
  const muted = onPaper ? 'text-paper-mute' : 'text-mute';
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={`flex h-1.5 overflow-hidden rounded-full ${onPaper ? 'bg-paper-edge/60' : 'bg-ink-800'}`}
        aria-hidden
      >
        <span className="bg-pos" style={{ width: `${win * 100}%` }} />
        <span
          className={onPaper ? 'bg-paper-mute/50' : 'bg-push/70'}
          style={{ width: `${push * 100}%` }}
        />
        <span className="bg-neg" style={{ width: `${lose * 100}%` }} />
      </div>
      <dl className={`flex flex-wrap gap-x-3 gap-y-0.5 text-xs ${muted}`}>
        <Fig label="Ganar" value={win} swatch="bg-pos" />
        <Fig label="Empatar" value={push} swatch={onPaper ? 'bg-paper-mute/50' : 'bg-push/70'} />
        <Fig label="Perder" value={lose} swatch="bg-neg" />
        {note && <span className="italic">{note}</span>}
      </dl>
    </div>
  );
}

function Fig({ label, value, swatch }: { label: string; value: number; swatch: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className={`size-1.5 rounded-full ${swatch}`} aria-hidden />
      <dt>{label}</dt>
      <dd className="font-medium">{formatPct(value)}</dd>
    </div>
  );
}
