import { Eye, Hand as HandIcon, Scale } from 'lucide-react';
import { handValue } from '@/domain/cards';
import { roundHands } from '@/engine/requests';
import { AnalysisFrame } from '@/features/analysis/AnalysisFrame';
import { useAnalysis } from '@/features/analysis/useAnalysis';
import { HitBustMeter } from '@/features/player-mode/HitBustMeter';
import { useRulesStore } from '@/store/rulesStore';
import { dealerCards, dealerMustHit, useTableStore } from '@/store/tableStore';
import { useUiStore } from '@/store/uiStore';
import { DealerOutcomeChart } from './DealerOutcomeChart';
import { HouseEdgePanel } from './HouseEdgePanel';

/** Modo dealer: cómo terminará la mano del dealer y cuánto gana la casa en la ronda. */
export function DealerView() {
  const dealer = useAnalysis('dealer');
  const round = useAnalysis('round');
  const knowHole = useUiStore((s) => s.knowHole);
  const setKnowHole = useUiStore((s) => s.setKnowHole);
  const player = useTableStore((s) => s.player);
  const others = useTableStore((s) => s.others);
  const labels = roundHands(player, others).map((h) => h.label);

  const holeRevealed = useTableStore((s) => s.dealer.holeRevealed);
  const holeKnown = knowHole || holeRevealed;
  const next = dealer.result?.pBustNext;

  return (
    <div className="flex flex-col gap-7">
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-800 bg-ink-950 p-3.5">
        <input
          type="checkbox"
          role="switch"
          checked={knowHole}
          onChange={(e) => setKnowHole(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-ink-700 transition-colors duration-150 peer-checked:bg-paper peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-paper after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-text after:transition-transform after:duration-150 after:ease-[var(--ease-out)] peer-checked:after:translate-x-4 peer-checked:after:bg-paper-ink"
        />
        <span className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Eye className="size-4 text-mute" aria-hidden /> Conozco mi carta oculta
          </span>
          <span className="text-xs text-mute">
            {knowHole
              ? 'El análisis usa tus dos cartas y descuenta la oculta del zapato.'
              : 'El análisis usa solo la carta visible; la oculta sigue en el zapato.'}
          </span>
        </span>
      </label>

      <GuidedPlay />

      <AnalysisFrame
        title={holeKnown ? 'Total final del dealer' : 'Total final con la carta visible'}
        slot={dealer.slot}
        stale={dealer.stale}
        testId="dealer-analysis"
        empty="Falta la carta visible del dealer."
      >
        {dealer.result && (
          <>
            {next !== undefined && (
              <div className="mb-5">
                <HitBustMeter
                  p={next}
                  label="de pasarse con la próxima carta"
                  testId="dealer-next-bust"
                />
              </div>
            )}
            <DealerOutcomeChart dist={dealer.result.dealer} />
          </>
        )}
      </AnalysisFrame>

      <AnalysisFrame
        title="Ventaja de la casa en la ronda"
        slot={round.slot}
        stale={round.stale}
        testId="round-analysis"
        empty="Se calcula cuando hay manos de jugadores en la mesa."
      >
        {round.result && <HouseEdgePanel round={round.result} labels={labels} />}
      </AnalysisFrame>
    </div>
  );
}

/** Juego guiado: el dealer no decide, solo hace lo que las reglas obligan. */
function GuidedPlay() {
  const phase = useTableStore((s) => s.phase);
  const d = useTableStore((s) => s.dealer);
  const source = useUiStore((s) => s.source);
  const rules = useRulesStore((s) => s.rules);
  const step = useTableStore((s) => s.dealerStep);
  const reveal = useTableStore((s) => s.revealHole);

  if (!d.up) return null;
  const v = d.hole ? handValue(dealerCards(d)) : null;
  const must = dealerMustHit(d, rules);
  const instruction = !d.hole
    ? 'Esperando la carta oculta.'
    : !d.holeRevealed
      ? 'Primero se revela la carta oculta.'
      : v?.blackjack
        ? 'Blackjack del dealer.'
        : v?.bust
          ? 'El dealer se pasó.'
          : must
            ? `Con ${v?.soft ? `${v.total} suave` : v?.total} el dealer debe pedir.`
            : `Con ${v?.soft ? `${v.total} suave` : v?.total} el dealer se planta (${rules.dealerHitsSoft17 ? 'H17' : 'S17'}).`;

  const sim = source === 'simulation';
  const canAct = phase === 'dealer';

  return (
    <section aria-labelledby="guided-title" className="flex flex-col gap-3">
      <h2 id="guided-title" className="section-title">
        Juego del dealer
      </h2>
      <p className="text-sm" aria-live="polite">
        {instruction}
      </p>
      <div className="flex flex-wrap gap-2">
        {d.hole && !d.holeRevealed && (
          <button
            type="button"
            className="btn"
            onClick={() => (sim ? step() : reveal())}
            disabled={sim && !canAct}
          >
            <Eye className="size-4" aria-hidden /> Revelar carta oculta
          </button>
        )}
        {sim && d.holeRevealed && must && (
          <button type="button" className="btn btn-paper" onClick={() => step()} disabled={!canAct}>
            <HandIcon className="size-4" aria-hidden /> Siguiente carta del dealer
          </button>
        )}
        {sim && d.holeRevealed && !must && phase === 'dealer' && (
          <button type="button" className="btn btn-paper" onClick={() => step()}>
            <Scale className="size-4" aria-hidden /> Liquidar la ronda
          </button>
        )}
        {!sim && d.holeRevealed && must && (
          <p className="text-xs text-mute">Agrega la carta que sacó el dealer con el selector.</p>
        )}
      </div>
      {sim && !canAct && phase !== 'settled' && (
        <p className="text-xs text-faint">El dealer juega cuando los jugadores terminan.</p>
      )}
    </section>
  );
}
