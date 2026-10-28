import { dealerChecksHole } from '@/domain/rules';
import { toRankIndex, FACE_NAME } from '@/domain/cards';
import { AnalysisFrame } from '@/features/analysis/AnalysisFrame';
import { useAnalysis } from '@/features/analysis/useAnalysis';
import { DealerOutcomeChart } from '@/features/dealer-mode/DealerOutcomeChart';
import { useCasualStore } from '@/casual/casualStore';
import { useRulesStore } from '@/store/rulesStore';
import { useTableStore } from '@/store/tableStore';
import { useUiStore } from '@/store/uiStore';
import { ActionPanel } from './ActionPanel';
import { HitBustMeter } from './HitBustMeter';
import { SessionStats } from './SessionStats';

/** Panel de análisis del modo jugador: todo viene de una sola respuesta de analyzeHand. */
export function PlayerView() {
  const { slot, result, stale } = useAnalysis('hand');
  // En Casual la mano, la carta del dealer y las reglas son las de la ronda del servidor.
  const casual = useUiStore((s) => s.screen === 'casual');
  const tableUp = useTableStore((s) => s.dealer.up?.face ?? null);
  const casualUp = useCasualStore((s) => s.round?.dealer.up.rank ?? null);
  const practiceRules = useRulesStore((s) => s.rules);
  const casualRules = useCasualStore((s) => s.run?.rules ?? null);
  const tableHands = useTableStore((s) => s.player.hands.length);
  const tableActive = useTableStore((s) => s.player.active);
  const casualHands = useCasualStore((s) => s.round?.player.hands.length ?? 1);
  const casualActive = useCasualStore((s) => s.round?.player.active ?? 0);
  const upFace = casual ? casualUp : tableUp;
  const rules = (casual && casualRules) || practiceRules;
  const handCount = casual ? casualHands : tableHands;
  const active = casual ? casualActive : tableActive;
  const peek = upFace ? dealerChecksHole(rules, toRankIndex(upFace)) : false;

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

      {result && upFace && (
        <AnalysisFrame
          title={`Dealer con ${FACE_NAME[upFace].toLowerCase()} visible`}
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

      {!casual && <SessionStats />}
    </div>
  );
}
