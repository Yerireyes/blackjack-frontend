import { Play, Users } from 'lucide-react';
import { Hand } from '@/components/Hand';
import { CardPicker } from '@/features/manual-entry/CardPicker';
import { dealerCards, useTableStore } from '@/store/tableStore';
import { useUiStore } from '@/store/uiStore';
import { ActionButtons } from './ActionBar';

/** Fieltro con el dealer arriba, otras manos al medio y tus manos abajo. */
export function Table() {
  const t = useTableStore();
  const source = useUiStore((s) => s.source);
  const mode = useUiStore((s) => s.mode);
  const knowHole = useUiStore((s) => s.knowHole);
  const sim = source === 'simulation';
  const d = t.dealer;
  const cards = dealerCards(d);
  const holeIdx = d.hole && !d.holeRevealed ? 1 : undefined;
  // En modo dealer con "conozco mi oculta" se ve la esquina de la carta.
  const peeked = holeIdx !== undefined && mode === 'dealer' && knowHole;

  return (
    <section
      aria-label="Mesa"
      className="felt relative flex flex-col items-center gap-5 px-3 pt-5 pb-5 sm:gap-6 sm:px-6 sm:pt-8 lg:min-h-0"
    >
      <Hand
        label="Dealer"
        cards={cards}
        hiddenIndex={holeIdx}
        peeked={peeked}
        testId="dealer-hand"
        slots={!sim || t.phase === 'idle' ? ['Visible', 'Oculta'] : []}
      />

      {t.others.length > 0 && (
        <div
          className="flex max-w-full flex-wrap justify-center gap-x-2 gap-y-1"
          aria-label="Otras manos en la mesa"
        >
          {t.others.map((seat) => (
            <Hand
              key={seat.id}
              label={seat.name}
              cards={seat.hands[0]!.cards}
              outcome={seat.hands[0]!.outcome}
              doubled={seat.hands[0]!.doubled}
              size="sm"
            />
          ))}
        </div>
      )}

      <div
        className="flex max-w-full flex-wrap items-end justify-center gap-x-3 gap-y-2 lg:mt-auto"
        aria-label="Tus manos"
      >
        {t.player.hands.map((h, i) => (
          <Hand
            key={h.id}
            label={t.player.hands.length > 1 ? `Mano ${i + 1}` : 'Tu mano'}
            cards={h.cards}
            fromSplit={h.fromSplit}
            active={t.player.hands.length > 1 && i === t.player.active && t.phase === 'player'}
            outcome={h.outcome}
            net={h.net}
            doubled={h.doubled}
            testId={`player-hand-${i}`}
            slots={
              (!sim || t.phase === 'idle') && i === 0 && !h.fromSplit
                ? ['Tu carta', 'Tu carta']
                : []
            }
          />
        ))}
      </div>

      <div className="flex w-full flex-col items-center gap-3 lg:mt-auto">
        <PhaseLine />
        {sim ? (
          <SimControls />
        ) : (
          <>
            {(t.player.hands.length > 1 || t.player.hands[0]!.cards.length >= 2) && (
              <ActionButtons />
            )}
            <CardPicker />
          </>
        )}
      </div>
    </section>
  );
}

function PhaseLine() {
  const phase = useTableStore((s) => s.phase);
  const mode = useUiStore((s) => s.mode);
  const source = useUiStore((s) => s.source);
  const text =
    phase === 'bots'
      ? 'Juegan los otros asientos con la jugada de mayor EV del motor…'
      : phase === 'dealer' && source === 'simulation'
        ? mode === 'dealer'
          ? 'Turno del dealer: avanza con el juego guiado del panel.'
          : 'Juega el dealer…'
        : null;
  return (
    <p className="min-h-5 text-center text-sm text-felt-ink" aria-live="polite">
      {text}
    </p>
  );
}

function SimControls() {
  const phase = useTableStore((s) => s.phase);
  const deal = useTableStore((s) => s.deal);
  const bots = useUiStore((s) => s.botSeats);
  const setBots = useUiStore((s) => s.setBotSeats);
  const canDeal = phase === 'idle' || phase === 'settled';

  if (!canDeal) return <ActionButtons />;
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        className="btn btn-paper h-11 px-5 text-base"
        onClick={deal}
        aria-keyshortcuts="Enter"
      >
        <Play className="size-4" aria-hidden />
        {phase === 'settled' ? 'Siguiente ronda' : 'Repartir'}
        <kbd className="kbd hidden sm:inline">Enter</kbd>
      </button>
      <label className="btn h-11 gap-2 text-sm">
        <Users className="size-4 text-mute" aria-hidden />
        <span className="text-mute">Otros asientos</span>
        <select
          value={bots}
          onChange={(e) => setBots(Number(e.target.value))}
          className="rounded bg-transparent font-semibold text-text outline-none"
          aria-label="Otros asientos en la mesa"
        >
          {[0, 1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n} className="bg-ink-900">
              {n}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
