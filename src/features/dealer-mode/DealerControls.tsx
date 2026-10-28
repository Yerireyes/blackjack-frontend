import { Eye, Hand as HandIcon, Scale } from 'lucide-react';
import { useRulesStore } from '@/store/rulesStore';
import { dealerMustHit, useTableStore } from '@/store/tableStore';
import { useUiStore } from '@/store/uiStore';

/** Botones del repartidor: revelar la oculta, sacar carta y liquidar, según obliguen las reglas. */
export function DealerButtons() {
  const phase = useTableStore((s) => s.phase);
  const d = useTableStore((s) => s.dealer);
  const source = useUiStore((s) => s.source);
  const rules = useRulesStore((s) => s.rules);
  const step = useTableStore((s) => s.dealerStep);
  const reveal = useTableStore((s) => s.revealHole);

  if (!d.up) return null;
  const sim = source === 'simulation';
  const canAct = phase === 'dealer';
  const must = dealerMustHit(d, rules);

  return (
    <>
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
      {sim && d.holeRevealed && !must && canAct && (
        <button type="button" className="btn btn-paper" onClick={() => step()}>
          <Scale className="size-4" aria-hidden /> Liquidar la ronda
        </button>
      )}
    </>
  );
}
