import { formatChips, formatPct, formatUnits } from '@/lib/format';
import { useChipsStore } from '@/store/chipsStore';
import { useSessionStore } from '@/store/sessionStore';
import { useTableStore } from '@/store/tableStore';
import { useUiStore } from '@/store/uiStore';

/** Tu decisión vs. la óptima: EV perdido acumulado en la sesión (simulación). */
export function SessionStats() {
  const source = useUiStore((s) => s.source);
  const { decisions, optimal, evLost } = useSessionStore();
  const net = useTableStore((s) => s.sessionNet);
  const hands = useTableStore((s) => s.handsPlayed);
  const chips = useChipsStore((s) => s.sessionChips);
  if (source !== 'simulation' || (decisions === 0 && hands === 0)) return null;
  return (
    <section aria-labelledby="session-title" className="flex flex-col gap-3">
      <h2 id="session-title" className="section-title">
        Tu sesión
      </h2>
      <dl className="grid grid-cols-3 divide-x divide-ink-800 rounded-xl border border-ink-800 text-center">
        <Stat
          label="Decisiones óptimas"
          value={decisions ? `${optimal}/${decisions}` : '—'}
          sub={decisions ? formatPct(optimal / decisions) : ''}
        />
        <Stat label="EV perdido" value={formatUnits(-evLost)} sub="frente a la óptima" />
        <Stat
          label={`Resultado · ${hands} rondas`}
          value={formatUnits(net)}
          sub={`${formatChips(chips, true)} fichas`}
        />
      </dl>
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-2 py-3">
      <dt className="text-[11px] leading-tight text-faint">{label}</dt>
      <dd className="text-base font-semibold">{value}</dd>
      <dd className="text-[11px] text-faint">{sub}</dd>
    </div>
  );
}
