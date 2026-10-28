import { formatChips } from '@/lib/format';
import {
  canAddChip,
  CHIP_VALUES,
  MAX_BET,
  MAX_STACK,
  MIN_BET,
  START_CHIPS,
  useChipsStore,
  type Bank,
} from '@/store/chipsStore';
import { setFlightOrigin } from './flight';

/** Bandeja de fichas: cada ficha que tocas viaja a la pila de la mesa. */
export function ChipTray({ bank }: { bank: Bank }) {
  const balance = useChipsStore((s) => s[bank]);
  const stack = useChipsStore((s) => s.stacks[bank]);
  const addChip = useChipsStore((s) => s.addChip);
  const clearStack = useChipsStore((s) => s.clearStack);
  const refill = useChipsStore((s) => s.refill);

  if (balance < MIN_BET) {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-sm text-felt-ink">
          {bank === 'player'
            ? 'Te quedaste sin fichas para la apuesta mínima.'
            : 'La banca de la casa no cubre la apuesta mínima.'}
        </p>
        <button type="button" className="btn btn-paper" onClick={() => refill(bank)}>
          {bank === 'player' ? 'Recargar' : 'Recargar la banca'} · {formatChips(START_CHIPS)}
        </button>
      </div>
    );
  }

  const full = stack.length >= MAX_STACK;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="flex flex-wrap items-center justify-center gap-2"
        role="group"
        aria-label={bank === 'player' ? 'Tus fichas' : 'Fichas del jugador automático'}
      >
        {CHIP_VALUES.map((v) => (
          <button
            key={v}
            type="button"
            className={`chip chip-${v}`}
            disabled={!canAddChip(stack, v, balance)}
            onClick={(e) => {
              const from = e.currentTarget.getBoundingClientRect();
              const id = addChip(bank, v);
              if (id !== null) setFlightOrigin(id, from);
            }}
            aria-label={`Apostar una ficha de ${v}`}
          >
            {v}
          </button>
        ))}
        <button
          type="button"
          className="btn h-9 min-h-0 px-3 text-[13px]"
          onClick={() => clearStack(bank)}
          disabled={stack.length === 0}
        >
          Retirar todo
        </button>
      </div>
      <p className="text-center text-[11px] text-felt-ink" aria-live="polite">
        {full
          ? `La pila está llena (${MAX_STACK} fichas): usa fichas más grandes.`
          : `Toca la pila para quitar una ficha · hasta ${MAX_STACK} fichas y ${MAX_BET} por apuesta`}
      </p>
    </div>
  );
}
