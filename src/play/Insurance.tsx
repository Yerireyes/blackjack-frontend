// El seguro (y el dinero par): con un As visible, antes del peek. Lo cobra y lo liquida el
// servidor; aquí solo se pregunta y, si hay ayudas, se dice si conviene según el motor.
import { ShieldCheck } from 'lucide-react';
import { formatChips, formatPct } from '@/lib/format';

interface Props {
  /** Mi mano es blackjack: «¿Dinero par?». */
  natural: boolean;
  /** Lo que cuesta: media apuesta. */
  cost: number;
  /** Alcanzan las fichas (si no, solo «No»). */
  canTake: boolean;
  /** EV del motor por ficha asegurada (solo con ayudas). */
  ev?: number | null;
  busy?: boolean;
  onDecide(take: boolean): void;
  testId: string;
}

export function InsuranceAsk({ natural, cost, canTake, ev = null, busy, onDecide, testId }: Props) {
  const advise = ev === null ? null : ev > 0 ? 'take' : 'skip';
  return (
    <div
      className="flex w-full max-w-md flex-col items-center gap-3 rounded-xl border border-paper/30 bg-felt-950/60 px-4 py-3.5 text-center"
      role="group"
      aria-labelledby={`${testId}-insurance-title`}
      data-testid={`${testId}-insurance`}
    >
      <p
        id={`${testId}-insurance-title`}
        className="flex items-center gap-2 text-base font-semibold"
      >
        <ShieldCheck className="size-4" aria-hidden />
        {natural ? '¿Dinero par?' : '¿Seguro?'}
      </p>
      <p className="text-sm text-felt-ink">
        {natural
          ? `Tienes blackjack y el dealer muestra un As. Con dinero par cobras 1 a 1 seguro, tenga o no blackjack (cuesta ${formatChips(cost)}).`
          : `El dealer muestra un As. El seguro cuesta ${formatChips(cost)} (media apuesta) y paga 2 a 1 si tiene blackjack.`}
      </p>
      {ev !== null && (
        <p
          className={`text-xs ${ev > 0 ? 'text-pos' : 'text-mute'}`}
          data-testid={`${testId}-insurance-advice`}
        >
          Motor: {ev > 0 ? 'conviene' : 'no conviene'} (EV {formatPct(ev)} de lo asegurado)
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          className={`btn h-11 px-5 ${advise === 'skip' ? 'btn-paper' : ''}`}
          onClick={() => onDecide(false)}
          disabled={busy}
          aria-label={`No${advise === 'skip' ? ' (recomendada)' : ''}`}
          data-testid={`${testId}-insurance-no`}
        >
          No, gracias
        </button>
        {canTake && (
          <button
            type="button"
            className={`btn h-11 px-5 ${advise === 'take' ? 'btn-paper' : ''}`}
            onClick={() => onDecide(true)}
            disabled={busy}
            aria-label={`Sí, ${natural ? 'dinero par' : 'asegurar'} por ${cost} fichas${advise === 'take' ? ' (recomendada)' : ''}`}
            data-testid={`${testId}-insurance-yes`}
          >
            Sí, {natural ? 'dinero par' : 'asegurar'} ({formatChips(cost)})
          </button>
        )}
      </div>
      {!canTake && <p className="text-xs text-faint">No te alcanzan las fichas para el seguro.</p>}
    </div>
  );
}
