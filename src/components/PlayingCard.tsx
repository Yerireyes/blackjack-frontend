import { motion } from 'motion/react';
import { cardLabel, isRed, SUIT_SYMBOL, type Card } from '@/domain/cards';

interface Props {
  card: Card | null;
  /** Boca abajo (la oculta del dealer). Al pasar a false la carta se voltea. */
  faceDown?: boolean;
  /** Marca de "solo la conoce el dealer" (modo dealer con oculta conocida). */
  peeked?: boolean;
  size?: 'md' | 'sm';
  className?: string;
}

const EASE = [0.23, 1, 0.32, 1] as const;

/** Carta de dos tintas sobre cartulina marfil, con índices de esquina. */
export function PlayingCard({
  card,
  faceDown = false,
  peeked = false,
  size = 'md',
  className,
}: Props) {
  const label = faceDown && !peeked ? 'Carta boca abajo' : card ? cardLabel(card) : 'Carta';
  return (
    <motion.div
      role="img"
      aria-label={label}
      className={`playing-card relative shrink-0 ${size === 'md' ? 'card-md' : 'card-sm'} ${className ?? ''}`}
      style={{ perspective: 800 }}
      initial={{ opacity: 0, transform: 'translate(36px, -28px) rotate(5deg)' }}
      animate={{ opacity: 1, transform: 'translate(0px, 0px) rotate(0deg)' }}
      transition={{ duration: 0.24, ease: EASE }}
    >
      <motion.div
        className="absolute inset-0"
        style={{ transformStyle: 'preserve-3d' }}
        initial={false}
        animate={{ transform: faceDown ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
        transition={{ duration: 0.32, ease: EASE }}
      >
        <Face card={card} />
        <div
          className="card-back absolute inset-0 rounded-[var(--card-r)] border-[5px] border-paper shadow-[0_1px_0_var(--color-paper-edge),0_8px_18px_rgb(0_0_0/0.35)]"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          {peeked && card && (
            <span className="absolute right-1 bottom-1 rounded bg-paper px-1 font-index text-xs font-semibold text-paper-ink">
              {card.face}
            </span>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function Face({ card }: { card: Card | null }) {
  const red = card ? isRed(card.suit) : false;
  const suit = card ? SUIT_SYMBOL[card.suit] : '';
  const court = card && (card.face === 'J' || card.face === 'Q' || card.face === 'K');
  return (
    <div
      aria-hidden
      className={`absolute inset-0 rounded-[var(--card-r)] bg-paper shadow-[0_1px_0_var(--color-paper-edge),0_8px_18px_rgb(0_0_0/0.35)] ${red ? 'text-pip' : 'text-paper-ink'}`}
      style={{ backfaceVisibility: 'hidden' }}
    >
      {card && (
        <>
          <Index face={card.face} suit={suit} />
          <span className="absolute inset-0 grid place-items-center">
            {court ? (
              <span className="font-index text-[length:var(--card-court)] leading-none font-semibold">
                {card.face}
              </span>
            ) : (
              <span className="text-[length:var(--card-pip)] leading-none">{suit}</span>
            )}
          </span>
          <Index face={card.face} suit={suit} flipped />
        </>
      )}
    </div>
  );
}

function Index({ face, suit, flipped }: { face: string; suit: string; flipped?: boolean }) {
  return (
    <span
      className={`absolute flex w-[1.4em] flex-col items-center leading-none ${
        flipped ? 'right-[0.3em] bottom-[0.35em] rotate-180' : 'top-[0.35em] left-[0.3em]'
      } text-[length:var(--card-index)]`}
    >
      <span className={`font-index font-semibold ${face === '10' ? 'tracking-[-0.06em]' : ''}`}>
        {face}
      </span>
      <span className="mt-[0.1em] text-[0.8em]">{suit}</span>
    </span>
  );
}

/** Hueco donde todavía no hay carta (modo manual). */
export function CardSlot({ label, size = 'md' }: { label: string; size?: 'md' | 'sm' }) {
  return (
    <div
      className={`grid shrink-0 place-items-center rounded-[var(--card-r)] border border-dashed border-felt-line text-center text-[11px] leading-tight text-felt-ink ${size === 'md' ? 'card-md' : 'card-sm'}`}
    >
      <span className="px-1">{label}</span>
    </div>
  );
}
