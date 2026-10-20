import { motion, useReducedMotion } from 'motion/react';
import type { ActionResult, AnalyzeHandResponse } from '@/engine/contract';
import { ProbBar } from '@/components/ProbBar';
import { evTone, formatEv } from '@/lib/format';
import { ACTION_KEY, ACTION_LABEL } from './actions';

interface Props {
  response: AnalyzeHandResponse;
}

const EASE = [0.23, 1, 0.32, 1] as const;

/**
 * Una fila por acción permitida, ordenadas por EV. La de mayor EV (la que dice
 * el motor en `best`) es la única carta "boca arriba".
 */
export function ActionPanel({ response }: Props) {
  // Orden estable: por EV descendente y, en empate, el orden del motor.
  const rows = response.actions
    .map((a, i) => ({ a, i }))
    .sort((x, y) => y.a.ev - x.a.ev || x.i - y.i)
    .map((x) => x.a);

  return (
    <ol className="flex flex-col gap-2" style={{ perspective: 900 }} data-testid="action-panel">
      {rows.map((a) => (
        <ActionRow
          key={a.action}
          result={a}
          best={a.action === response.best}
          flipKey={response.best}
        />
      ))}
    </ol>
  );
}

function ActionRow({
  result,
  best,
  flipKey,
}: {
  result: ActionResult;
  best: boolean;
  flipKey: string;
}) {
  const reduce = useReducedMotion();
  const tone = evTone(result.ev);
  const split = result.action === 'split';
  const content = (
    <>
      <span
        className={`font-index text-xl leading-none font-semibold ${best ? 'text-pip' : 'text-faint'}`}
        aria-hidden
      >
        {ACTION_KEY[result.action]}
      </span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-medium">{ACTION_LABEL[result.action]}</span>
        {best && (
          <span className="rounded-full bg-paper-ink px-2 py-0.5 text-[11px] font-semibold text-paper">
            Recomendada
          </span>
        )}
        {!result.exact && <ApproxBadge onPaper={best} />}
      </span>
      <span className="text-right">
        <span
          data-testid={`ev-${result.action}`}
          className={`block text-lg leading-tight font-semibold ${
            best
              ? 'text-paper-ink'
              : tone === 'pos'
                ? 'text-pos'
                : tone === 'neg'
                  ? 'text-neg'
                  : 'text-text'
          }`}
        >
          {!result.exact && '≈ '}
          {formatEv(result.ev)}
        </span>
        {split && (
          <span className={`block text-[11px] ${best ? 'text-paper-mute' : 'text-faint'}`}>
            EV de las dos manos
          </span>
        )}
      </span>
      <div className="col-span-2 col-start-2">
        <ProbBar
          win={result.pWin}
          push={result.pPush}
          lose={result.pLose}
          note={split ? 'por mano' : undefined}
          onPaper={best}
        />
      </div>
    </>
  );

  const base =
    'grid grid-cols-[1.75rem_1fr_auto] items-start gap-x-3 gap-y-2 rounded-xl border px-3.5 py-3';

  if (best) {
    return (
      <motion.li
        key={flipKey}
        data-testid="action-best"
        data-action={result.action}
        aria-label={`${ACTION_LABEL[result.action]}, recomendada, EV ${formatEv(result.ev)}`}
        className={`${base} border-paper bg-paper text-paper-ink shadow-[0_1px_0_var(--color-paper-edge),0_10px_24px_rgb(0_0_0/0.3)]`}
        style={{ transformOrigin: '50% 0%' }}
        initial={reduce ? { opacity: 0 } : { opacity: 0.4, transform: 'rotateX(-70deg)' }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, transform: 'rotateX(0deg)' }}
        transition={{ duration: 0.34, ease: EASE }}
      >
        {content}
      </motion.li>
    );
  }
  return (
    <li
      data-action={result.action}
      aria-label={`${ACTION_LABEL[result.action]}, EV ${formatEv(result.ev)}`}
      className={`${base} border-ink-800 bg-ink-900`}
    >
      {content}
    </li>
  );
}

function ApproxBadge({ onPaper }: { onPaper: boolean }) {
  return (
    <span className="group relative">
      <button
        type="button"
        aria-describedby="approx-tip"
        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
          onPaper ? 'border-paper-mute/40 text-paper-mute' : 'border-warn/40 text-warn'
        }`}
      >
        ≈ aproximado
      </button>
      <span
        id="approx-tip"
        role="tooltip"
        className="pointer-events-none absolute top-full left-0 z-20 mt-1.5 w-64 rounded-lg border border-ink-700 bg-ink-950 p-3 text-xs leading-relaxed font-normal text-text opacity-0 shadow-[0_8px_24px_rgb(0_0_0/0.45)] transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100"
      >
        Dividir se calcula exacto solo con dos manos y sin re-división. Con re-división, o si el
        cálculo exacto no cabe en el presupuesto del motor, el EV es una aproximación muy cercana
        (diferencias del orden de 0,1 %).
      </span>
    </span>
  );
}
