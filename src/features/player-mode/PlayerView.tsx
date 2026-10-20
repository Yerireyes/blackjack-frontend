import { dealerChecksHole } from '@/domain/rules';
import { toRankIndex, FACE_NAME } from '@/domain/cards';
import { AnalysisFrame } from '@/features/analysis/AnalysisFrame';
import { useAnalysis } from '@/features/analysis/useAnalysis';
import { DealerOutcomeChart } from '@/features/dealer-mode/DealerOutcomeChart';
import { useRulesStore } from '@/store/rulesStore';
import { useTableStore } from '@/store/tableStore';
import { ActionPanel } from './ActionPanel';
import { HitBustMeter } from './HitBustMeter';
import { SessionStats } from './SessionStats';

/** Panel de análisis del modo jugador: todo viene de una sola respuesta de analyzeHand. */
export function PlayerView() {
  const { slot, result, stale } = useAnalysis('hand');
  const up = useTableStore((s) => s.dealer.up);
  const rules = useRulesStore((s) => s.rules);
  const handCount = useTableStore((s) => s.player.hands.length);
  const active = useTableStore((s) => s.player.active);
  const peek = up ? dealerChecksHole(rules, toRankIndex(up.face)) : false;

  return (
    <div className="flex flex-col gap-6">
      <AnalysisFrame
        title={handCount > 1 ? `Acciones · mano ${active + 1} de ${handCount}` : 'Acciones'}
        slot={slot}
        stale={stale}
        testId="hand-analysis"
        empty="Reparte una mano para ver el EV de cada acción."
      >
        {result && <ActionPanel response={result} />}
        {result && (
          <p className="mt-3 text-xs leading-relaxed text-faint">
            Recomendada = mayor EV, no mayor probabilidad de ganar. EV en % de la apuesta inicial.
          </p>
        )}
      </AnalysisFrame>

      {result && (
        <AnalysisFrame title="Riesgo al pedir" slot={slot} stale={stale} testId="bust-frame">
          <HitBustMeter p={result.pBustOnHit} label="de pasarte con una carta más" />
        </AnalysisFrame>
      )}

      {result && up && (
        <AnalysisFrame
          title={`Dealer con ${FACE_NAME[up.face].toLowerCase()} visible`}
          slot={slot}
          stale={stale}
          testId="dealer-frame"
        >
          <DealerOutcomeChart dist={result.dealer} />
          {peek && (
            <p className="mt-2 text-xs text-faint">
              Ya revisó su carta oculta: la distribución supone que no tiene blackjack.
            </p>
          )}
        </AnalysisFrame>
      )}

      <SessionStats />
    </div>
  );
}
