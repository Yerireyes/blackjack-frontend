import { useState } from 'react';
import { ACTION_LABEL } from '@/features/player-mode/actions';
import { formatEv, formatPct } from '@/lib/format';
import { isCurrent, useAnalysisStore } from '@/store/analysisStore';
import { useShoeStore } from '@/store/shoeStore';
import { useTableStore } from '@/store/tableStore';
import { useUiStore } from '@/store/uiStore';

/** Región aria-live: anuncia la recomendación nueva y el resultado de cada ronda. */
export function Announcer() {
  const [text, setText] = useState('');
  const mode = useUiStore((s) => s.mode);
  const hand = useAnalysisStore((s) => s.hand);
  const dealer = useAnalysisStore((s) => s.dealer);
  const version = useShoeStore((s) => s.version);
  const phase = useTableStore((s) => s.phase);
  const player = useTableStore((s) => s.player);

  const handMsg =
    mode === 'player' && hand.result && isCurrent(hand, version)
      ? (() => {
          const best = hand.result.actions.find((a) => a.action === hand.result!.best);
          return best
            ? `Recomendada: ${ACTION_LABEL[best.action]}, EV ${formatEv(best.ev)}. Riesgo al pedir ${formatPct(hand.result.pBustOnHit)}.`
            : '';
        })()
      : '';
  const dealerMsg =
    mode === 'dealer' && dealer.result && isCurrent(dealer, version)
      ? `El dealer se pasa con probabilidad ${formatPct(dealer.result.dealer.pBust)}.`
      : '';
  const settledMsg =
    phase === 'settled'
      ? `Ronda terminada: ${player.hands
          .map((h) => (h.net == null ? '' : h.net > 0 ? 'ganas' : h.net < 0 ? 'pierdes' : 'empate'))
          .filter(Boolean)
          .join(', ')}.`
      : '';

  const msg = settledMsg || handMsg || dealerMsg;
  // Conserva el último mensaje: vaciar la región mientras se calcula sería ruido para el lector.
  if (msg && msg !== text) setText(msg);

  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="announcer">
      {text}
    </div>
  );
}
