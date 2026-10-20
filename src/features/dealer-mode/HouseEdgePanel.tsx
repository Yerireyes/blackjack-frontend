import type { AnalyzeRoundResponse } from '@/engine/contract';
import { evTone, formatEv } from '@/lib/format';
import { ACTION_LABEL } from '@/features/player-mode/actions';

/** Ventaja de la casa en la ronda (houseEdgeRound del motor) y la mejor jugada de cada mano. */
export function HouseEdgePanel({
  round,
  labels,
}: {
  round: AnalyzeRoundResponse;
  labels: string[];
}) {
  const edge = round.houseEdgeRound;
  return (
    <div className="flex flex-col gap-3" data-testid="house-edge">
      <p className="flex items-baseline gap-2">
        <span
          className="text-[1.75rem] leading-none font-semibold text-paper"
          data-testid="house-edge-value"
        >
          {formatEv(edge)}
        </span>
        <span className="text-sm text-mute">
          {edge >= 0 ? 'a favor de la casa' : 'a favor de los jugadores'}
        </span>
      </p>
      <p className="text-xs leading-relaxed text-faint">
        Promedio del mejor EV de cada mano con su carta visible, si cada jugador juega de forma
        óptima. Aproximación: ignora las cartas que sacarán los demás jugadores.
      </p>
      <ul className="flex flex-col divide-y divide-ink-800 rounded-xl border border-ink-800">
        {round.hands.map((h, i) => {
          const best = h.actions.find((a) => a.action === h.best);
          return (
            <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="text-mute">{labels[i] ?? `Mano ${i + 1}`}</span>
              <span className="flex items-center gap-2">
                <span>{ACTION_LABEL[h.best]}</span>
                {best && (
                  <span
                    className={`font-semibold ${evTone(best.ev) === 'neg' ? 'text-neg' : 'text-pos'}`}
                  >
                    {formatEv(best.ev)}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
