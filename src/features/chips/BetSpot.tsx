import { animate, AnimatePresence, motion, useReducedMotionConfig } from 'motion/react';
import { useLayoutEffect, useRef } from 'react';
import { formatChips } from '@/lib/format';
import { stackTotal, useChipsStore, type Bank, type Chip } from '@/store/chipsStore';
import { takeFlightOrigin } from './flight';

/** Separación vertical entre fichas apiladas. */
const CHIP_RISE = 4;

/** Pila de Práctica: la de tu banca o la del jugador automático. */
export function BetSpot({ bank }: { bank: Bank }) {
  const stack = useChipsStore((s) => s.stacks[bank]);
  const locked = useChipsStore((s) => s.round !== null);
  const removeChip = useChipsStore((s) => s.removeChip);
  return (
    <BetStack
      stack={stack}
      locked={locked}
      onRemove={() => removeChip(bank)}
      testId={`bet-spot-${bank}`}
    />
  );
}

interface BetStackProps {
  stack: readonly Chip[];
  /** Ronda en juego: la apuesta no se toca. */
  locked: boolean;
  onRemove(): void;
  testId?: string;
}

/** Círculo de apuesta sobre el fieltro con la pila de fichas. Tocarlo retira la de arriba. */
export function BetStack({ stack, locked, onRemove, testId }: BetStackProps) {
  const total = stackTotal(stack);
  const top = stack.at(-1);

  return (
    <div className="flex flex-col items-center gap-1" data-testid={testId}>
      <button
        type="button"
        onClick={onRemove}
        disabled={locked || !top}
        aria-label={
          top
            ? `Apuesta de ${formatChips(total)}${locked ? ' (en juego)' : `. Quitar la ficha de ${top.value}`}`
            : 'Sin apuesta: elige fichas abajo'
        }
        title={top && !locked ? `Quitar la ficha de ${top.value}` : undefined}
        className="relative size-[4.25rem] rounded-full border-2 border-dashed border-felt-line bg-felt-950/30 enabled:cursor-pointer sm:size-[4.75rem]"
      >
        <AnimatePresence initial={false}>
          {stack.map((c, i) => (
            <StackChip key={c.id} chip={c} index={i} />
          ))}
        </AnimatePresence>
      </button>
      <span className="text-sm font-semibold text-felt-ink tabular-nums" aria-hidden>
        {total > 0 ? formatChips(total) : 'Apuesta'}
      </span>
    </div>
  );
}

/** Una ficha de la pila. Si viene de la bandeja, viaja en arco hasta su lugar. */
function StackChip({ chip, index }: { chip: Chip; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotionConfig();

  useLayoutEffect(() => {
    const from = takeFlightOrigin(chip.id);
    const el = ref.current;
    if (!from || !el || reduce) return;
    const to = el.getBoundingClientRect();
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    void animate(
      el,
      {
        x: [dx, dx * 0.45, 0],
        y: [dy, dy * 0.45 - 40, 0],
        scale: [from.width / to.width, 1.1, 1],
        rotate: [0, 200, 360],
      },
      { duration: 0.36, ease: 'easeOut' },
    );
  }, [chip.id, reduce]);

  return (
    <motion.div
      className="pointer-events-none absolute top-1/2 left-1/2"
      style={{ marginLeft: '-1.25rem', marginTop: `calc(-1.25rem - ${index * CHIP_RISE}px)` }}
      exit={{ opacity: 0, y: -16, transition: { duration: 0.16 } }}
    >
      <div ref={ref} className={`chip chip-sm chip-${chip.value}`}>
        {chip.value}
      </div>
    </motion.div>
  );
}
