import { formatPct } from '@/lib/format';

interface Props {
  /** Probabilidad que devuelve el motor. */
  p: number;
  label: string;
  testId?: string;
}

/** Probabilidad de pasarse con UNA carta más, en una escala fija de 0 a 100 %. */
export function HitBustMeter({ p, label, testId = 'bust-meter' }: Props) {
  return (
    <div className="flex flex-col gap-2" data-testid={testId}>
      <p className="flex items-baseline gap-2">
        <span className="text-[1.75rem] leading-none font-semibold" data-testid={`${testId}-value`}>
          {formatPct(p)}
        </span>
        <span className="text-sm text-mute">{label}</span>
      </p>
      <div
        className="relative h-2 overflow-hidden rounded-full bg-ink-800"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Number((p * 100).toFixed(2))}
        aria-valuetext={formatPct(p)}
        aria-label={label}
      >
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-cut"
          style={{ width: `${p * 100}%` }}
        />
        <span className="absolute inset-y-0 left-1/2 w-px bg-ink-600" aria-hidden />
      </div>
    </div>
  );
}
