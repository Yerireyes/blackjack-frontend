import { AnimatePresence, motion } from 'motion/react';
import { describeHand, handValue, type Card } from '@/domain/cards';
import { formatUnits } from '@/lib/format';
import type { Outcome } from '@/store/tableStore';
import { CardSlot, PlayingCard } from './PlayingCard';

const OUTCOME: Record<Outcome, string> = {
  blackjack: 'Blackjack',
  win: 'Gana',
  push: 'Empate',
  lose: 'Pierde',
  bust: 'Se pasó',
  surrender: 'Rendida',
};

interface Props {
  label: string;
  cards: Card[];
  fromSplit?: boolean;
  active?: boolean;
  /** Índice de la carta boca abajo (oculta del dealer). */
  hiddenIndex?: number;
  /** La oculta la conoce el dealer (modo dealer). */
  peeked?: boolean;
  outcome?: Outcome | null;
  net?: number | null;
  doubled?: boolean;
  size?: 'md' | 'sm';
  /** Huecos a mostrar mientras faltan cartas (modo manual). */
  slots?: string[];
  testId?: string;
}

export function Hand({
  label,
  cards,
  fromSplit = false,
  active = false,
  hiddenIndex,
  peeked = false,
  outcome,
  net,
  doubled,
  size = 'md',
  slots = [],
  testId,
}: Props) {
  const visible = cards.filter((_, i) => i !== hiddenIndex || peeked);
  const total = describeHand(visible, fromSplit);
  const bust = visible.length > 0 && handValue(visible, fromSplit).bust;
  const missing = slots.slice(cards.length);

  return (
    <section
      aria-label={label}
      data-testid={testId}
      data-active={active || undefined}
      className={`relative flex flex-col items-center gap-2 rounded-xl px-2 pt-1 pb-2 transition-[background-color,box-shadow] duration-200 ${
        active ? 'bg-felt-950/35 shadow-[inset_0_0_0_1px_var(--color-paper)]' : ''
      }`}
    >
      <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-felt-ink">
        {active && <span className="size-1.5 rounded-full bg-paper" aria-hidden />}
        {label}
        {doubled && <span className="rounded bg-felt-950/60 px-1 text-[10px]">×2</span>}
        {active && <span className="sr-only">(mano activa)</span>}
      </span>
      <div
        className={`${size === 'md' ? 'card-md' : 'card-sm'} flex !aspect-auto min-h-[calc(var(--card-w)*1.4)] !w-auto items-center`}
      >
        <AnimatePresence initial={false}>
          {cards.map((c, i) => (
            <div
              key={c.id}
              className="not-first:-ml-[calc(var(--card-w)*0.42)]"
              style={{ zIndex: i }}
            >
              <PlayingCard
                card={c}
                faceDown={i === hiddenIndex}
                peeked={i === hiddenIndex && peeked}
                size={size}
              />
            </div>
          ))}
          {missing.map((s, i) => (
            <div key={`slot-${i}`} className={cards.length + i > 0 ? 'ml-1.5' : ''}>
              <CardSlot label={s} size={size} />
            </div>
          ))}
        </AnimatePresence>
      </div>
      <div className="flex h-7 items-center gap-1.5">
        {total && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${
              bust ? 'bg-pip text-white' : 'bg-felt-950/70 text-text'
            }`}
            data-testid={testId ? `${testId}-total` : undefined}
          >
            {total}
          </span>
        )}
        <AnimatePresence>
          {outcome && (
            <motion.span
              initial={{ opacity: 0, transform: 'translateY(4px)' }}
              animate={{ opacity: 1, transform: 'translateY(0px)' }}
              transition={{ duration: 0.2 }}
              className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${
                (net ?? 0) > 0
                  ? 'bg-paper text-paper-ink'
                  : (net ?? 0) < 0
                    ? 'bg-ink-950/80 text-neg'
                    : 'bg-ink-950/80 text-mute'
              }`}
            >
              {OUTCOME[outcome]}
              {net != null && ` · ${formatUnits(net)}`}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
