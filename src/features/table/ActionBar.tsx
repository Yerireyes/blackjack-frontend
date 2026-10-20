import { isCurrent, useAnalysisStore } from '@/store/analysisStore';
import { useRulesStore } from '@/store/rulesStore';
import { useShoeStore } from '@/store/shoeStore';
import { allowedActions, useTableStore } from '@/store/tableStore';
import { performAction } from './performAction';
import { useUiStore } from '@/store/uiStore';
import { ACTION_KEY, ACTION_LABEL, ACTION_ORDER } from '@/features/player-mode/actions';

/** Botones Pedir, Plantarse, Doblar, Dividir y Rendirse. La recomendada va en cartulina. */
export function ActionButtons() {
  const player = useTableStore((s) => s.player);
  const phase = useTableStore((s) => s.phase);
  const rules = useRulesStore((s) => s.rules);
  const source = useUiStore((s) => s.source);
  const mode = useUiStore((s) => s.mode);
  const slot = useAnalysisStore((s) => s.hand);
  const version = useShoeStore((s) => s.version);
  const allowed = allowedActions(player, rules);
  const best =
    mode === 'player' && slot.result && isCurrent(slot, version) ? slot.result.best : null;
  const active = phase === 'player';

  return (
    <div
      className="grid w-full max-w-md grid-cols-3 gap-1.5 min-[400px]:grid-cols-5 sm:flex sm:w-auto sm:max-w-none sm:flex-wrap sm:justify-center sm:gap-2"
      role="group"
      aria-label="Acciones del jugador"
    >
      {ACTION_ORDER.map((a) => {
        const enabled = active && allowed[a];
        const rec = enabled && best === a;
        const manualHit = source === 'manual' && a === 'hit';
        return (
          <button
            key={a}
            type="button"
            className={`btn h-11 px-2 text-[13px] sm:h-10 sm:px-3.5 sm:text-sm ${rec ? 'btn-paper' : ''}`}
            disabled={!enabled}
            onClick={() => performAction(a)}
            aria-keyshortcuts={ACTION_KEY[a]}
            aria-label={`${ACTION_LABEL[a]}${rec ? ' (recomendada)' : ''}`}
            title={manualHit ? 'En modo manual, agrega la carta con el selector' : undefined}
          >
            {ACTION_LABEL[a]}
            <kbd className="kbd hidden sm:inline">{ACTION_KEY[a]}</kbd>
          </button>
        );
      })}
    </div>
  );
}
