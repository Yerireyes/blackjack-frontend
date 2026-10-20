import type { DealerDistribution } from '@/engine/contract';
import { formatPct } from '@/lib/format';

const ROWS: { key: keyof DealerDistribution; label: string }[] = [
  { key: 'p17', label: '17' },
  { key: 'p18', label: '18' },
  { key: 'p19', label: '19' },
  { key: 'p20', label: '20' },
  { key: 'p21', label: '21' },
  { key: 'pBlackjack', label: 'Blackjack' },
  { key: 'pBust', label: 'Se pasa' },
];

/** Total final del dealer: barras horizontales en una escala fija de 0 a 100 %. */
export function DealerOutcomeChart({
  dist,
  testId = 'dealer-chart',
}: {
  dist: DealerDistribution;
  testId?: string;
}) {
  return (
    <table className="w-full border-separate border-spacing-y-0.5 text-sm" data-testid={testId}>
      <caption className="sr-only">Probabilidad de cada total final del dealer</caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">Total</th>
          <th scope="col">Probabilidad</th>
        </tr>
      </thead>
      <tbody>
        {ROWS.map(({ key, label }) => {
          const p = dist[key];
          const bust = key === 'pBust';
          return (
            <tr key={key} data-row={key}>
              <th
                scope="row"
                className={`w-20 pr-3 text-left font-medium ${bust ? 'text-text' : 'text-mute'}`}
              >
                {label}
              </th>
              <td className="w-full">
                <div className="h-2 overflow-hidden rounded-full bg-ink-800" aria-hidden>
                  <div
                    className={`h-full rounded-full ${bust ? 'bg-cut' : key === 'pBlackjack' ? 'bg-warn' : 'bg-felt-ink/80'}`}
                    style={{ width: `${p * 100}%` }}
                  />
                </div>
              </td>
              <td
                className={`pl-3 text-right whitespace-nowrap ${bust ? 'font-semibold' : ''}`}
                data-value={key}
              >
                {formatPct(p)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
