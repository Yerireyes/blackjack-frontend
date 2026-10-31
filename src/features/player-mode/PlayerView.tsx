import { dealerChecksHole } from '@/domain/rules';
import { toRankIndex, FACE_NAME } from '@/domain/cards';
import { AnalysisFrame } from '@/features/analysis/AnalysisFrame';
import { useAnalysis } from '@/features/analysis/useAnalysis';
import { formatEv } from '@/lib/format';
import { DealerOutcomeChart } from '@/features/dealer-mode/DealerOutcomeChart';
import { useCasualStore } from '@/casual/casualStore';
import { mySeatOf, useRoomsStore } from '@/rooms/roomsStore';
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
  // En Salas, las de mi asiento en la ronda de la mesa.
  const rooms = useUiStore((s) => s.screen === 'rooms');
  // Con As visible, antes del peek: todavía se decide el seguro.
  const casualInsurance = useCasualStore((s) => s.round?.phase === 'insurance');
  const roomInsurance = useRoomsStore((s) => s.room?.round?.phase === 'insurance');
  const insurancePhase = (casual && casualInsurance) || (rooms && roomInsurance);
  const practice = useUiStore((s) => s.screen === 'practice');
  const roomUp = useRoomsStore((s) => s.room?.round?.dealer.up.rank ?? null);
  const roomRules = useRoomsStore((s) => s.room?.info.rules ?? null);
  const roomSeat = useRoomsStore((s) => {
    const mine = mySeatOf(s);
    return mine ? (s.room?.round?.seats.find((x) => x.seat === mine.seat) ?? null) : null;
  });
  const upFace = rooms ? roomUp : casual ? casualUp : tableUp;
  const rules = (rooms && roomRules) || (casual && casualRules) || practiceRules;
  const handCount = rooms ? (roomSeat?.hands.length ?? 1) : casual ? casualHands : tableHands;
  const active = rooms ? (roomSeat?.active ?? 0) : casual ? casualActive : tableActive;
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

      {result?.insuranceEv !== undefined && (
        <AnalysisFrame title="Seguro" slot={slot} stale={stale} testId="insurance-frame">
          <p className="flex items-baseline justify-between gap-3 text-sm">
            <span className={result.insuranceEv > 0 ? 'font-semibold text-pos' : 'font-semibold'}>
              {result.insuranceEv > 0 ? 'Conviene asegurar' : 'No conviene asegurar'}
            </span>
            <span className={`tabular-nums ${result.insuranceEv > 0 ? 'text-pos' : 'text-neg'}`}>
              {formatEv(result.insuranceEv)}
            </span>
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-faint">
            EV por ficha puesta en el seguro (paga 2 a 1 si el dealer tiene blackjack). Solo
            conviene con el zapato cargado de dieces.
            {practice && ' En Práctica no se cobra: es la referencia.'}
          </p>
        </AnalysisFrame>
      )}

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
              {insurancePhase
                ? 'Revisa su carta oculta después del seguro: la distribución (y el EV de cada acción) suponen que no tiene blackjack.'
                : 'Ya revisó su carta oculta: la distribución supone que no tiene blackjack.'}
            </p>
          )}
        </AnalysisFrame>
      )}

      {!casual && !rooms && <SessionStats />}
    </div>
  );
}
