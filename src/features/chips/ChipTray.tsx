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
  type Chip,
  type ChipValue,
} from '@/store/chipsStore';
import { setFlightOrigin } from './flight';

/** Bandeja de Práctica: con saldo, las fichas; sin saldo para la mínima, recargar. */
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

  return (
    <ChipButtons
      stack={stack}
      maxBet={Math.min(MAX_BET, balance)}
      onAdd={(v) => addChip(bank, v)}
      onClear={() => clearStack(bank)}
      label={bank === 'player' ? 'Tus fichas' : 'Fichas del jugador automático'}
    />
  );
}

interface ChipButtonsProps {
  stack: readonly Chip[];
  /** Tope de la próxima apuesta (límite de mesa y saldo). */
  maxBet: number;
  /** Pone la ficha; devuelve su id o null si no cabe. */
  onAdd(value: ChipValue): number | null;
  onClear(): void;
  label: string;
}

/** Fichas de la bandeja: cada una que tocas viaja a la pila de la mesa. */
export function ChipButtons({ stack, maxBet, onAdd, onClear, label }: ChipButtonsProps) {
  const full = stack.length >= MAX_STACK;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="flex flex-wrap items-center justify-center gap-2"
        role="group"
        aria-label={label}
      >
        {CHIP_VALUES.map((v) => (
          <button
            key={v}
            type="button"
            className={`chip chip-${v}`}
            disabled={!canAddChip(stack, v, maxBet)}
            onClick={(e) => {
              const from = e.currentTarget.getBoundingClientRect();
              const id = onAdd(v);
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
          onClick={onClear}
          disabled={stack.length === 0}
        >
          Retirar todo
        </button>
      </div>
      <p className="text-center text-[11px] text-felt-ink" aria-live="polite">
        {full
          ? `La pila está llena (${MAX_STACK} fichas): usa fichas más grandes.`
          : `Toca la pila para quitar una ficha · hasta ${MAX_STACK} fichas y ${formatChips(maxBet)} por apuesta`}
      </p>
    </div>
  );
}
