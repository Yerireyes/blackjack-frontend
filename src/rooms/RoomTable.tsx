import { Check, Hand as HandIcon, Link2, RotateCcw, WifiOff } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';
import { useAccountStore } from '@/account/accountStore';
import { Hand } from '@/components/Hand';
import type { Action, RoomSeat, RoomState, SeatRoundView } from '@/engine/contract';
import { BetStack } from '@/features/chips/BetSpot';
import { ChipButtons } from '@/features/chips/ChipTray';
import { ACTION_KEY, ACTION_LABEL, ACTION_ORDER } from '@/features/player-mode/actions';
import { formatChips } from '@/lib/format';
import {
  AccountUnavailable,
  Centered,
  FELT,
  LoadFailed,
  NamePrompt,
  SignInPrompt,
} from '@/play/ServerTable';
import { InsuranceAsk } from '@/play/Insurance';
import { isNatural } from '@/play/view';
import { isCurrent, useAnalysisStore } from '@/store/analysisStore';
import { MIN_BET, stackTotal } from '@/store/chipsStore';
import { useShoeStore } from '@/store/shoeStore';
import { useUiStore } from '@/store/uiStore';
import { seconds, useCountdown } from './countdown';
import { PlayerName, TimerBar } from './parts';
import { REACTIONS, reactionOf } from './reactions';
import { maxBetOf, myInsuranceOf, mySeatOf, myTurnOf, useRoomsStore } from './roomsStore';
import { Podium, TournamentBadge, TournamentStart } from './Tournament';
import { dealerModel, resultShownOf, seatHands } from './view';

const TURN_MS = 20_000;
const BET_MS = 20_000;

/** La mesa de una sala: el dealer, los asientos, mis controles y las reacciones. */
export function RoomTable() {
  const account = useAccountStore((s) => s.status);
  const needsName = useAccountStore((s) => s.me?.needsDisplayName ?? false);
  const conn = useRoomsStore((s) => s.conn);
  const failure = useRoomsStore((s) => s.failure);
  const room = useRoomsStore((s) => s.room);
  const code = useUiStore((s) => s.roomCode);
  const join = useRoomsStore((s) => s.join);
  const openRoom = useUiStore((s) => s.openRoom);

  let body: ReactNode;
  if (account === 'loading') body = <Centered>Cargando…</Centered>;
  else if (account === 'unavailable') body = <AccountUnavailable mode="Las salas" />;
  else if (account === 'anonymous')
    body = (
      <SignInPrompt title="Las salas se juegan con cuenta">
        Te invitaron a la sala {code}: entra o crea tu cuenta y vuelves directo a la mesa.
      </SignInPrompt>
    );
  else if (needsName && conn === 'failed')
    body = (
      <Centered>
        <NamePrompt />
      </Centered>
    );
  else if (conn === 'failed')
    body = (
      <LoadFailed
        text={failure ?? 'No se pudo entrar a la sala.'}
        onRetry={() => code && join(code)}
      />
    );
  else if (!room) body = <Centered>Entrando a la sala {code}…</Centered>;
  else body = <Table room={room} />;

  return (
    <section aria-label={`Sala ${code ?? ''}`} className={FELT} data-testid="room-table">
      {room && conn === 'reconnecting' && (
        <p
          role="status"
          className="absolute inset-x-0 top-0 z-10 flex items-center justify-center gap-2 bg-warn/15 py-1.5 text-xs font-medium text-warn"
        >
          <WifiOff className="size-3.5" aria-hidden /> Se cortó la conexión. Reconectando…
        </p>
      )}
      {body}
      {conn === 'failed' && (
        <button type="button" className="btn" onClick={() => openRoom(null)}>
          Volver a las salas
        </button>
      )}
    </section>
  );
}

function Table({ room }: { room: RoomState }) {
  const roundNo = useRoomsStore((s) => s.roundNo);
  const shown = useRoomsStore((s) => s.shown);
  const dealer = room.round ? dealerModel(room.round, roundNo, shown) : null;

  return (
    <>
      <RoomHeader room={room} />
      <Hand
        label="Dealer"
        cards={dealer?.cards ?? []}
        hiddenIndex={dealer?.holeHidden ? 1 : undefined}
        testId="room-dealer-hand"
        slots={dealer ? [] : ['Visible', 'Oculta']}
      />
      <Seats room={room} />
      <div className="flex w-full flex-col items-center gap-3 lg:mt-auto">
        <Podium room={room} />
        <PhaseLine room={room} />
        <TournamentStart room={room} />
        <MyControls room={room} />
        <Reactions />
      </div>
    </>
  );
}

/** Nombre, código y el enlace de invitación para copiar. */
function RoomHeader({ room }: { room: RoomState }) {
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}${location.pathname}#/salas/${room.info.code}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin portapapeles (permiso denegado): el código queda a la vista igual.
    }
  }
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold">{room.info.name}</h2>
        <p className="text-xs text-felt-ink">
          {room.info.visibility === 'private' ? 'Privada' : 'Pública'} · anfitrión {room.info.host}
          {room.info.tournament && (
            <span className="ml-2 align-middle">
              <TournamentBadge t={room.info.tournament} />
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span
          className="rounded-md border border-felt-line bg-felt-950/50 px-2 py-1 font-mono text-sm tracking-[0.2em]"
          aria-label={`Código de la sala: ${room.info.code.split('').join(' ')}`}
          data-testid="room-code"
        >
          {room.info.code}
        </span>
        <button type="button" className="btn h-9 min-h-0" onClick={() => void copy()}>
          {copied ? (
            <Check className="size-4 text-pos" aria-hidden />
          ) : (
            <Link2 className="size-4" aria-hidden />
          )}
          <span className="hidden sm:inline">{copied ? 'Enlace copiado' : 'Copiar enlace'}</span>
          <span className="sr-only sm:hidden">{copied ? 'Enlace copiado' : 'Copiar enlace'}</span>
        </button>
      </div>
    </div>
  );
}

/** Los asientos en arco (en escritorio): libres para sentarse u ocupados con sus manos. */
function Seats({ room }: { room: RoomState }) {
  const n = room.seats.length;
  const mid = (n - 1) / 2;
  return (
    <ol
      className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-[repeat(var(--seats),minmax(0,1fr))] lg:gap-3"
      style={{ ['--seats' as string]: n }}
      data-testid="room-seats"
    >
      {room.seats.map((seat, i) => (
        <li
          key={seat.seat}
          className="flex lg:translate-y-(--arc)"
          // Los de los extremos más arriba: el arco de la mesa.
          style={{ ['--arc' as string]: `${-((i - mid) ** 2) * 0.25 + mid * mid * 0.25}rem` }}
        >
          <Seat room={room} seat={seat} />
        </li>
      ))}
    </ol>
  );
}

function Seat({ room, seat }: { room: RoomState; seat: RoomSeat }) {
  const me = useRoomsStore((s) => s.me);
  const seated = useRoomsStore((s) => mySeatOf(s) !== null);
  const sit = useRoomsStore((s) => s.sit);
  const roundNo = useRoomsStore((s) => s.roundNo);
  const shown = useRoomsStore((s) => s.shown);
  const ms = useCountdown();
  const player = seat.player;
  const mine = !!player && player.id === me;
  const inRound = room.round?.seats.find((s) => s.seat === seat.seat) ?? null;
  const turn = room.phase === 'playing' && room.round?.turn === seat.seat;
  const resultShown = resultShownOf(room, shown);

  if (!player) {
    return (
      <div className="flex min-h-16 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-felt-line/70 p-2 text-center sm:min-h-36">
        <span className="text-xs text-felt-ink">Asiento {seat.seat}</span>
        {!seated && room.tournament?.status !== 'running' && (
          <button
            type="button"
            className="btn h-9 min-h-0 px-3 text-[13px]"
            onClick={() => sit(seat.seat)}
            data-testid={`room-sit-${seat.seat}`}
          >
            Sentarse
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative flex min-h-36 w-full flex-col items-center gap-1.5 rounded-xl p-2 transition-[background-color,box-shadow] duration-200 ${
        turn
          ? 'bg-felt-950/50 shadow-[inset_0_0_0_2px_var(--color-paper)]'
          : mine
            ? 'bg-felt-950/35 shadow-[inset_0_0_0_1px_var(--color-felt-line)]'
            : 'bg-felt-950/20'
      }`}
      data-testid={`room-seat-${seat.seat}`}
      data-mine={mine || undefined}
      data-turn={turn || undefined}
    >
      <SeatReaction playerId={player.id} />
      <p className="flex w-full min-w-0 items-center justify-center gap-1 text-center text-xs font-semibold">
        {!seat.connected && (
          <WifiOff className="size-3 shrink-0 text-warn" aria-label="Desconectado" />
        )}
        <span className="truncate">
          <PlayerName player={player} me={mine} />
        </span>
      </p>
      <p className="text-[11px] text-felt-ink tabular-nums">
        Pila {formatChips(seat.stack)}
        {room.phase === 'betting' && seat.bet ? ` · apostó ${formatChips(seat.bet)}` : ''}
      </p>
      {inRound && (
        <SeatRound
          s={inRound}
          roundNo={roundNo}
          resultShown={resultShown}
          turn={turn}
          insuring={room.round?.phase === 'insurance'}
        />
      )}
      {turn && ms !== null && (
        <span className="mt-auto w-full px-1">
          <TimerBar ms={ms} total={TURN_MS} urgent={ms < 5000} />
        </span>
      )}
    </div>
  );
}

function SeatRound({
  s,
  roundNo,
  resultShown,
  turn,
  insuring,
}: {
  s: SeatRoundView;
  roundNo: number;
  resultShown: boolean;
  turn: boolean;
  insuring: boolean;
}) {
  const hands = seatHands(s, roundNo, resultShown);
  return (
    <>
      <span className="text-[11px] text-felt-ink">
        Apuesta {formatChips(s.bet)}
        {s.insured && <span className="font-semibold text-text"> · seguro</span>}
        {insuring && s.insured === undefined && <span> · decidiendo seguro…</span>}
      </span>
      <div className="flex max-w-full flex-wrap items-end justify-center gap-1">
        {hands.map((h, i) => (
          <Hand
            key={h.id}
            label={hands.length > 1 ? `Mano ${i + 1}` : 'Mano'}
            cards={h.cards}
            fromSplit={h.fromSplit}
            active={hands.length > 1 && turn && i === s.active}
            outcome={h.outcome}
            // En un asiento estrecho solo la etiqueta; el neto en fichas va debajo.
            net={null}
            doubled={h.doubled}
            size="sm"
          />
        ))}
      </div>
      {resultShown && s.net !== undefined && s.net !== 0 && (
        <span
          className={`text-xs font-semibold tabular-nums ${s.net > 0 ? 'text-pos' : s.net < 0 ? 'text-neg' : 'text-mute'}`}
        >
          {formatChips(s.net, true)}
        </span>
      )}
    </>
  );
}

/** La reacción de un jugador sentado, flotando sobre su asiento unos segundos. */
function SeatReaction({ playerId }: { playerId: string }) {
  const shown = useRoomsStore((s) => s.reactions.find((r) => r.playerId === playerId) ?? null);
  const dismiss = useRoomsStore((s) => s.dismissReaction);
  useEffect(() => {
    if (!shown) return;
    const id = setTimeout(() => dismiss(shown.key), 2500);
    return () => clearTimeout(id);
  }, [shown, dismiss]);
  const r = shown ? reactionOf(shown.reaction) : null;
  return (
    <AnimatePresence>
      {shown && r && (
        <motion.span
          key={shown.key}
          initial={{ opacity: 0, transform: 'translateY(6px) scale(0.8)' }}
          animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
          exit={{ opacity: 0, transform: 'translateY(-6px) scale(0.9)' }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className="absolute -top-3 right-1 z-10 grid h-8 min-w-8 place-items-center rounded-full border border-ink-700 bg-ink-950 px-1.5 text-base font-bold shadow-lg"
          aria-label={r.label}
          role="img"
        >
          {r.emoji}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

/** Qué está pasando en la mesa y cuánto queda. */
function PhaseLine({ room }: { room: RoomState }) {
  const ms = useCountdown();
  const me = useRoomsStore((s) => s.me);
  const myTurn = useRoomsStore(myTurnOf);
  const shown = useRoomsStore((s) => s.shown);
  const turnSeat = room.round?.turn;
  const turnPlayer = room.seats.find((s) => s.seat === turnSeat)?.player;
  const secs = ms === null ? null : seconds(ms);

  let text: ReactNode;
  const t = room.tournament;
  if (room.phase === 'waiting')
    text = t
      ? t.status === 'finished'
        ? 'Terminó el torneo.'
        : `Torneo de ${t.hands} manos: siéntate y espera a que empiece.`
      : 'Esperando jugadores: siéntate para empezar.';
  else if (room.phase === 'betting')
    text = `Apuestas abiertas${secs !== null ? ` · ${secs} s` : ''}`;
  else if (room.phase === 'playing' && room.round?.phase === 'insurance')
    text = `El dealer muestra un As: seguro para todos${secs !== null ? ` · ${secs} s` : ''}`;
  else if (room.phase === 'playing')
    text = myTurn ? (
      <span className="font-semibold text-text">Te toca{secs !== null ? ` · ${secs} s` : ''}</span>
    ) : turnPlayer ? (
      <>
        Decide {turnPlayer.id === me ? 'tú' : turnPlayer.displayName}
        {secs !== null ? ` · ${secs} s` : ''}
      </>
    ) : (
      'Repartiendo…'
    );
  else
    text = resultShownOf(room, shown)
      ? `Resultados · nueva ronda${secs !== null ? ` en ${secs} s` : ' enseguida'}`
      : room.round?.peekBlackjack
        ? 'El dealer revisa su carta oculta…'
        : 'Juega el dealer…';

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-1.5" aria-live="polite">
      {t?.status === 'running' && (
        <p
          className="text-xs font-semibold tracking-wide text-felt-ink uppercase"
          data-testid="tournament-progress"
        >
          Torneo · {t.played} de {t.hands} manos jugadas
        </p>
      )}
      <p className="text-center text-sm text-felt-ink" data-testid="room-phase">
        {text}
      </p>
      {(room.phase === 'betting' || room.round?.phase === 'insurance') && ms !== null && (
        <TimerBar ms={ms} total={BET_MS} />
      )}
    </div>
  );
}

/** Lo que puedo hacer ahora: sentarme, apostar, decidir, recomprar o levantarme. */
function MyControls({ room }: { room: RoomState }) {
  const seat = useRoomsStore(mySeatOf);
  const rebuy = useRoomsStore((s) => s.rebuy);
  const leaveSeat = useRoomsStore((s) => s.leaveSeat);
  const myTurn = useRoomsStore(myTurnOf);
  const insurance = useRoomsStore(myInsuranceOf);
  const shown = useRoomsStore((s) => s.shown);

  if (!seat) {
    const free = room.seats.some((s) => !s.player);
    return (
      <p className="text-center text-sm text-felt-ink" data-testid="room-spectating">
        Estás mirando.{' '}
        {free ? 'Elige un asiento libre para jugar.' : 'No hay asientos libres ahora.'}
      </p>
    );
  }

  const inRound = room.round?.seats.find((s) => s.seat === seat.seat) ?? null;
  const handInPlay = room.phase === 'playing' && !!inRound && !inRound.done;
  const running = room.tournament?.status === 'running';
  const out =
    running && room.tournament!.standings.some((s) => s.player.id === seat.player?.id && s.out);
  const broke = seat.stack < MIN_BET && !handInPlay;
  const mine = resultShownOf(room, shown) ? inRound?.net : undefined;

  return (
    <div className="flex w-full flex-col items-center gap-3">
      {mine !== undefined && (
        <p
          className={`text-sm font-semibold ${mine > 0 ? 'text-pos' : mine < 0 ? 'text-neg' : 'text-mute'}`}
          data-testid="room-my-result"
        >
          {mine > 0
            ? `Ganas ${formatChips(mine, true)} fichas.`
            : mine < 0
              ? `Pierdes ${formatChips(-mine)} fichas.`
              : 'Empate: recuperas tu apuesta.'}
        </p>
      )}
      {insurance === 'pending' && inRound ? (
        <RoomInsurance room={room} stack={seat.stack} bet={inRound.bet} />
      ) : room.round?.phase === 'insurance' && insurance !== 'none' ? (
        <p className="text-sm text-felt-ink" data-testid="room-insurance-done">
          {insurance === 'taken' ? 'Tomaste el seguro.' : 'Sin seguro.'} Esperando al resto…
        </p>
      ) : myTurn ? (
        <Actions room={room} />
      ) : out || (broke && running) ? (
        <p className="text-center text-sm text-felt-ink" data-testid="tournament-out">
          Quedaste eliminado del torneo. Sigue mirando hasta el final.
        </p>
      ) : broke && !room.tournament ? (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-felt-ink">Te quedaste sin fichas para la apuesta mínima.</p>
          <button
            type="button"
            className="btn btn-paper h-11"
            onClick={rebuy}
            data-testid="room-rebuy"
          >
            <RotateCcw className="size-4" aria-hidden /> Recomprar 500 fichas
          </button>
        </div>
      ) : room.phase === 'betting' ? (
        seat.bet ? (
          <p className="text-sm text-felt-ink" data-testid="room-bet-done">
            Apostaste {formatChips(seat.bet)}. Esperando al resto…
          </p>
        ) : (
          <BetControls />
        )
      ) : null}
      <button
        type="button"
        className="btn h-8 min-h-0 border-transparent bg-transparent px-2 text-xs text-felt-ink"
        onClick={leaveSeat}
        disabled={handInPlay}
        title={handInPlay ? 'Termina tu mano antes de levantarte' : undefined}
        data-testid="room-leave-seat"
      >
        <HandIcon className="size-3.5" aria-hidden /> Levantarme (pasar a mirar)
      </button>
    </div>
  );
}

function BetControls() {
  const stack = useRoomsStore((s) => s.stack);
  const maxBet = useRoomsStore(maxBetOf);
  const addChip = useRoomsStore((s) => s.addChip);
  const removeChip = useRoomsStore((s) => s.removeChip);
  const clearStack = useRoomsStore((s) => s.clearStack);
  const bet = useRoomsStore((s) => s.bet);
  const total = stackTotal(stack);
  return (
    <div className="flex flex-col items-center gap-3">
      <BetStack stack={stack} locked={false} onRemove={removeChip} testId="room-bet" />
      <ChipButtons
        stack={stack}
        maxBet={maxBet}
        onAdd={addChip}
        onClear={clearStack}
        label="Tus fichas"
      />
      <button
        type="button"
        className="btn btn-paper h-11 px-5 text-base"
        onClick={bet}
        disabled={total < MIN_BET}
        aria-keyshortcuts="Enter"
        data-testid="room-bet-submit"
      >
        Apostar {formatChips(total)}
        <kbd className="kbd hidden sm:inline">Enter</kbd>
      </button>
    </div>
  );
}

/** El seguro de mi asiento: todos deciden a la vez; con ayudas, el consejo del motor. */
function RoomInsurance({ room, stack, bet }: { room: RoomState; stack: number; bet: number }) {
  const insure = useRoomsStore((s) => s.insure);
  const hand = useRoomsStore((s) => {
    const seat = mySeatOf(s);
    return s.room?.round?.seats.find((x) => x.seat === seat?.seat)?.hands[0] ?? null;
  });
  const slot = useAnalysisStore((s) => s.hand);
  const version = useShoeStore((s) => s.version);
  const ev =
    room.info.aids && slot.result && isCurrent(slot, version)
      ? (slot.result.insuranceEv ?? null)
      : null;
  return (
    <InsuranceAsk
      natural={
        !!hand &&
        isNatural(
          hand.cards.map((c) => ({ face: c.rank })),
          hand.fromSplit,
        )
      }
      cost={bet / 2}
      // La pila incluye la apuesta: para el seguro hace falta 1,5 veces la apuesta.
      canTake={stack >= bet * 1.5}
      ev={ev}
      onDecide={insure}
      testId="room"
    />
  );
}

/** En mi turno: solo las acciones de `round.allowed`; con ayudas, la recomendada marcada. */
function Actions({ room }: { room: RoomState }) {
  const act = useRoomsStore((s) => s.act);
  const slot = useAnalysisStore((s) => s.hand);
  const version = useShoeStore((s) => s.version);
  const best: Action | null =
    room.info.aids && slot.result && isCurrent(slot, version) ? slot.result.best : null;
  const allowed = room.round?.allowed;
  if (!allowed) return null;
  return (
    <div
      className="grid w-full max-w-md grid-cols-3 gap-1.5 min-[400px]:grid-cols-5 sm:flex sm:w-auto sm:max-w-none sm:flex-wrap sm:justify-center sm:gap-2"
      role="group"
      aria-label="Acciones"
    >
      {ACTION_ORDER.map((a) => {
        const rec = allowed[a] && best === a;
        return (
          <button
            key={a}
            type="button"
            className={`btn h-11 px-2 text-[13px] sm:h-10 sm:px-3.5 sm:text-sm ${rec ? 'btn-paper' : ''}`}
            disabled={!allowed[a]}
            onClick={() => act(a)}
            aria-keyshortcuts={ACTION_KEY[a]}
            aria-label={`${ACTION_LABEL[a]}${rec ? ' (recomendada)' : ''}`}
          >
            {ACTION_LABEL[a]}
            <kbd className="kbd hidden sm:inline">{ACTION_KEY[a]}</kbd>
          </button>
        );
      })}
    </div>
  );
}

/** Reacciones para todos (jugadores y espectadores), una cada 2 s. */
function Reactions() {
  const react = useRoomsStore((s) => s.react);
  const cooling = useRoomsStore((s) => s.reactCooling);
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-1"
      role="group"
      aria-label="Reacciones"
    >
      {REACTIONS.map((r) => (
        <button
          key={r.id}
          type="button"
          className="grid size-9 place-items-center rounded-full text-base font-bold transition-[transform,background-color] duration-150 enabled:hover:bg-felt-950/50 enabled:active:scale-90 disabled:opacity-40"
          onClick={() => react(r.id)}
          disabled={cooling}
          aria-label={r.label}
          title={r.label}
        >
          {r.emoji}
        </button>
      ))}
    </div>
  );
}
