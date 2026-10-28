import { Play, Users } from 'lucide-react';
import { motion, useAnimate, useReducedMotion } from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';
import { Hand } from '@/components/Hand';
import { BetSpot } from '@/features/chips/BetSpot';
import { ChipTray } from '@/features/chips/ChipTray';
import { DealerButtons } from '@/features/dealer-mode/DealerControls';
import { CardPicker } from '@/features/manual-entry/CardPicker';
import { MIN_BET, stackTotal, useChipsStore } from '@/store/chipsStore';
import { useRulesStore } from '@/store/rulesStore';
import { dealerCards, peekedBlackjack, useTableStore } from '@/store/tableStore';
import { useUiStore, type Mode } from '@/store/uiStore';
import { ActionButtons } from './ActionBar';

/** Inclinación de la mesa vista desde el repartidor: los jugadores quedan al fondo. */
const DEALER_TILT = 18;

/**
 * Fieltro con el dealer arriba, otras manos al medio y tus manos abajo. En modo dealer
 * la cámara se pasa detrás del repartidor: el dealer queda abajo y la mesa se inclina.
 */
export function Table() {
  const t = useTableStore();
  const source = useUiStore((s) => s.source);
  const mode = useUiStore((s) => s.mode);
  const knowHole = useUiStore((s) => s.knowHole);
  const { scope, mode: viewMode, tilt } = useCamera(mode);
  const sim = source === 'simulation';
  const d = t.dealer;
  const cards = dealerCards(d);
  const holeIdx = d.hole && !d.holeRevealed ? 1 : undefined;
  // En modo dealer con "conozco mi oculta" se ve la esquina de la carta.
  const peeked = holeIdx !== undefined && mode === 'dealer' && knowHole;
  const asDealer = viewMode === 'dealer';

  const dealerHand = (
    <Hand
      key="dealer"
      label={asDealer ? 'Dealer (tú)' : 'Dealer'}
      cards={cards}
      hiddenIndex={holeIdx}
      peeked={peeked}
      testId="dealer-hand"
      slots={!sim || t.phase === 'idle' ? ['Visible', 'Oculta'] : []}
    />
  );

  const others =
    t.others.length > 0 ? (
      <div
        key="others"
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
    ) : null;

  // La apuesta va entre el jugador y el dealer: arriba de la mano en tu vista, abajo en la del repartidor.
  const playerHands = (
    <div
      key="player"
      className={`flex max-w-full items-center gap-2 ${asDealer ? 'flex-col-reverse' : 'flex-col'}`}
    >
      {sim && <BetSpot bank={asDealer ? 'house' : 'player'} />}
      <div
        className="flex max-w-full flex-wrap items-end justify-center gap-x-3 gap-y-2"
        aria-label={asDealer ? 'Manos del jugador' : 'Tus manos'}
      >
        {t.player.hands.map((h, i) => (
          <Hand
            key={h.id}
            label={t.player.hands.length > 1 ? `Mano ${i + 1}` : asDealer ? 'Jugador' : 'Tu mano'}
            cards={h.cards}
            fromSplit={h.fromSplit}
            active={t.player.hands.length > 1 && i === t.player.active && t.phase === 'player'}
            outcome={h.outcome}
            net={h.net}
            doubled={h.doubled}
            testId={`player-hand-${i}`}
            slots={
              (!sim || t.phase === 'idle') && i === 0 && !h.fromSplit
                ? [asDealer ? 'Carta' : 'Tu carta', asDealer ? 'Carta' : 'Tu carta']
                : []
            }
          />
        ))}
      </div>
    </div>
  );

  // Lo que está cerca de la cámara va abajo; lo lejano, arriba.
  const [far, middle, near]: ReactNode[] = asDealer
    ? [playerHands, others, dealerHand]
    : [dealerHand, others, playerHands];

  return (
    <section
      aria-label="Mesa"
      data-view={viewMode}
      className="felt relative flex flex-col items-center gap-5 px-3 pt-5 pb-5 sm:gap-6 sm:px-6 sm:pt-8 lg:min-h-0"
    >
      <motion.div
        ref={scope}
        initial={{ rotateX: tilt }}
        style={{ transformPerspective: 1100, originY: 1 }}
        className="flex w-full flex-1 flex-col items-center gap-5 sm:gap-6"
      >
        {far}
        {middle}
        <div className="flex w-full justify-center lg:mt-auto">{near}</div>
      </motion.div>

      <div className="flex w-full flex-col items-center gap-3">
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

/**
 * Cambio de cámara: la mesa gira hasta quedar de canto, se reacomoda y vuelve con la
 * inclinación del nuevo punto de vista. Con movimiento reducido el cambio es inmediato.
 */
function useCamera(mode: Mode) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(mode);
  const current = reduce ? mode : shown;

  useEffect(() => {
    if (reduce) {
      void animate(
        scope.current,
        { rotateX: mode === 'dealer' ? DEALER_TILT : 0 },
        { duration: 0 },
      );
      return;
    }
    if (mode === shown) return;
    let cancelled = false;
    void (async () => {
      await animate(scope.current, { rotateX: 80, opacity: 0 }, { duration: 0.28, ease: 'easeIn' });
      if (cancelled) return;
      setShown(mode);
      await animate(
        scope.current,
        { rotateX: mode === 'dealer' ? DEALER_TILT : 0, opacity: 1 },
        { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, shown, reduce, animate, scope]);

  return { scope, mode: current, tilt: mode === 'dealer' ? DEALER_TILT : 0 };
}

function PhaseLine() {
  const phase = useTableStore((s) => s.phase);
  const mode = useUiStore((s) => s.mode);
  const source = useUiStore((s) => s.source);
  const sim = source === 'simulation';
  const rules = useRulesStore((s) => s.rules);
  const dealer = useTableStore((s) => s.dealer);
  const peek = sim && peekedBlackjack(dealer, rules);
  const asDealer = mode === 'dealer';

  if (peek && (phase === 'dealer' || phase === 'settled')) {
    const revealed = dealer.holeRevealed;
    return (
      <p
        className="min-h-5 max-w-md text-center text-sm font-medium text-text"
        aria-live="polite"
        data-testid="peek-message"
      >
        {!revealed
          ? asDealer
            ? 'Revisaste tu carta oculta: tienes blackjack. Revélala para cerrar la ronda.'
            : 'El dealer revisa su carta oculta…'
          : asDealer
            ? 'Blackjack de la casa: la ronda termina sin que el jugador decida. Solo un blackjack suyo empata.'
            : 'Blackjack del dealer: lo revisó antes de que jugaras, así que no había decisión posible. Solo un blackjack tuyo empata.'}
      </p>
    );
  }

  const text =
    phase === 'bots'
      ? 'Juegan los otros asientos con la jugada de mayor EV del motor…'
      : phase === 'player' && sim && mode === 'dealer'
        ? 'El jugador juega solo con la jugada de mayor EV del motor…'
        : phase === 'dealer' && sim
          ? mode === 'dealer'
            ? 'Tu turno como repartidor: revela la oculta y saca cartas según las reglas.'
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
  const mode = useUiStore((s) => s.mode);
  const bots = useUiStore((s) => s.botSeats);
  const setBots = useUiStore((s) => s.setBotSeats);
  const canDeal = phase === 'idle' || phase === 'settled';
  const bank = mode === 'dealer' ? 'house' : 'player';
  const bet = useChipsStore((s) => stackTotal(s.stacks[bank]));

  if (!canDeal) {
    return mode === 'dealer' ? (
      <div className="flex min-h-10 flex-wrap justify-center gap-2">
        <DealerButtons />
      </div>
    ) : (
      <ActionButtons />
    );
  }
  return (
    <div className="flex flex-col items-center gap-3">
      <ChipTray bank={bank} />
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          className="btn btn-paper h-11 px-5 text-base"
          onClick={deal}
          disabled={bet < MIN_BET}
          title={bet < MIN_BET ? 'Pon fichas sobre la mesa para apostar' : undefined}
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
    </div>
  );
}
