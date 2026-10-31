// La revisión de decisiones de los modos sin ayudas (Ranked, reto diario). La calcula el
// servidor y llega en `result.review` al liquidar: aquí solo se muestra, nunca antes.
import { Check, Flame, X } from 'lucide-react';
import type { ReviewItem } from '@/engine/contract';
import { ACTION_LABEL } from '@/features/player-mode/actions';
import { formatPct } from '@/lib/format';
import { useProgressStore } from '@/progress/progressStore';
import { isOptimal, lostEv, reviewSummary } from './review';
import type { RoundStore } from './round';
import { fullyShown } from './view';

/** La revisión de la ronda, solo cuando terminó y ya se vio toda la liquidación. */
function useReview(store: RoundStore) {
  const round = store((s) => s.round);
  const shown = store((s) => s.shown);
  const review =
    round?.phase === 'settled' && fullyShown(round, shown) ? (round.result?.review ?? null) : null;
  return { round, review };
}

/** Bajo el resultado, en la mesa: cómo jugaste la mano (el detalle está en el panel). */
export function ReviewLine({ store, testId }: { store: RoundStore; testId: string }) {
  const { round, review } = useReview(store);
  if (!round) {
    return (
      <p className="max-w-md text-center text-sm text-felt-ink">
        Sin ayudas durante la mano. Al terminar verás cada decisión comparada con la óptima.
      </p>
    );
  }
  if (!review) return null;
  const s = reviewSummary(review, round.bet);
  return (
    <p
      className={`max-w-md text-center text-sm ${s.decisions > 0 && s.optimal === s.decisions ? 'text-pos' : 'text-text'}`}
      data-testid={`${testId}-review-line`}
    >
      {s.text}
    </p>
  );
}

/** En el panel: cada decisión de la última mano contra la óptima. */
export function ReviewDetail({ store, testId }: { store: RoundStore; testId: string }) {
  const { round, review } = useReview(store);

  return (
    <section aria-labelledby={`${testId}-review-title`} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={`${testId}-review-title`} className="section-title">
          Revisión de la mano
        </h2>
        <Streak testId={testId} />
      </div>
      {!round || !review ? (
        <p className="rounded-xl border border-dashed border-ink-700 px-4 py-3 text-sm text-mute">
          {round && round.phase !== 'settled'
            ? 'Juega la mano: la revisión aparece cuando termina.'
            : 'Al terminar cada mano verás aquí tus decisiones comparadas con la óptima.'}
        </p>
      ) : (
        <ReviewList
          review={review}
          bet={round.bet}
          many={round.player.hands.length > 1}
          testId={testId}
        />
      )}
    </section>
  );
}

/** Decisiones óptimas seguidas (las cuenta el servidor, sumando Ranked y el reto diario). */
function Streak({ testId }: { testId: string }) {
  const streak = useProgressStore((s) => s.achievements?.optimalStreak ?? null);
  const best = useProgressStore((s) => s.achievements?.bestOptimalStreak ?? 0);
  if (streak === null) return null;
  return (
    <p
      className="flex items-center gap-1 text-xs text-mute"
      title={`Decisiones óptimas seguidas en Ranked y el reto diario. Tu mejor racha: ${best}.`}
      data-testid={`${testId}-streak`}
    >
      <Flame className={`size-3.5 ${streak > 0 ? 'text-warn' : 'text-faint'}`} aria-hidden />
      Racha <span className="font-semibold text-text tabular-nums">{streak}</span>
      <span className="text-faint">· mejor {best}</span>
    </p>
  );
}

function ReviewList({
  review,
  bet,
  many,
  testId,
}: {
  review: ReviewItem[];
  bet: number;
  many: boolean;
  testId: string;
}) {
  if (review.length === 0) {
    return <p className="text-sm text-mute">{reviewSummary(review, bet).text}</p>;
  }

  return (
    <ol
      className="flex flex-col divide-y divide-ink-800 rounded-xl border border-ink-800"
      data-testid={`${testId}-review`}
    >
      {review.map((r, i) => {
        const ok = isOptimal(r);
        const approx = r.exact ? '' : '≈ ';
        return (
          <li key={i} className="flex items-start gap-3 px-3 py-2.5 text-sm">
            <span
              className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${ok ? 'bg-pos/15 text-pos' : 'bg-neg/15 text-neg'}`}
              aria-hidden
            >
              {ok ? <Check className="size-3.5" /> : <X className="size-3.5" />}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p>
                {many && <span className="text-mute">Mano {r.handIndex + 1} · </span>}
                <span className="font-semibold">{ACTION_LABEL[r.chosen]}</span>
                {ok ? (
                  <span className="text-mute"> · la óptima</span>
                ) : (
                  <span className="text-mute">
                    {' '}
                    · la óptima era <span className="text-text">{ACTION_LABEL[r.best]}</span>
                  </span>
                )}
              </p>
              {!ok && (
                <p className="text-xs text-faint">
                  EV {approx}
                  {formatPct(r.evChosen)} frente a {approx}
                  {formatPct(r.evBest)}: perdiste {approx}
                  {formatPct(lostEv(r))} de la apuesta.
                </p>
              )}
            </div>
            <span className="sr-only">{ok ? 'Correcta' : 'Mejorable'}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Una cifra con su etiqueta, para las rejillas de los paneles. */
export function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 px-2 py-3">
      <dt className="text-[11px] leading-tight text-faint">{label}</dt>
      <dd className={`text-base font-semibold tabular-nums ${tone ?? ''}`}>
        {value}
        {hint && <span className="block text-[11px] font-normal text-faint">{hint}</span>}
      </dd>
    </div>
  );
}
