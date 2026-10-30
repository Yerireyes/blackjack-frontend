// Piezas de la mesa contra el servidor, comunes a Casual y Ranked. Leen la ronda del store
// del modo (por contexto) y solo mandan intenciones: nunca deciden qué se puede hacer.
import { CloudOff, LogIn, Play, UserRound } from 'lucide-react';
import { createContext, useContext, type ReactNode } from 'react';
import { useAccountStore } from '@/account/accountStore';
import { Hand } from '@/components/Hand';
import type { Action, RoundKind } from '@/engine/contract';
import { BetStack } from '@/features/chips/BetSpot';
import { ChipButtons } from '@/features/chips/ChipTray';
import { ACTION_KEY, ACTION_LABEL, ACTION_ORDER } from '@/features/player-mode/actions';
import { formatChips } from '@/lib/format';
import { MIN_BET, stackTotal } from '@/store/chipsStore';
import { useUiStore } from '@/store/uiStore';
import { roundLocked, type RoundState, type RoundStore } from './round';
import { tableModel } from './view';

const RoundContext = createContext<RoundStore | null>(null);

/** Da a las piezas de la mesa el store del modo (Casual o Ranked). */
export function RoundProvider({ store, children }: { store: RoundStore; children: ReactNode }) {
  return <RoundContext.Provider value={store}>{children}</RoundContext.Provider>;
}

function useRound<T>(selector: (s: RoundState) => T): T {
  const store = useContext(RoundContext);
  if (!store) throw new Error('Falta RoundProvider');
  return store(selector);
}

export const FELT =
  'felt relative flex flex-col items-center gap-5 px-3 pt-5 pb-5 sm:gap-6 sm:px-6 sm:pt-8 lg:min-h-0';

export function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="m-auto flex max-w-md flex-col items-center gap-4 py-10 text-center text-felt-ink">
      {children}
    </div>
  );
}

export function SignInPrompt({ title, children }: { title: string; children: ReactNode }) {
  const openDialog = useAccountStore((s) => s.openDialog);
  return (
    <Centered>
      <h2 className="text-lg font-semibold text-text">{title}</h2>
      <p className="text-sm">{children}</p>
      <button type="button" className="btn btn-paper h-11" onClick={() => openDialog('auth')}>
        <LogIn className="size-4" aria-hidden /> Entrar o crear cuenta
      </button>
    </Centered>
  );
}

export function AccountUnavailable({ mode }: { mode: string }) {
  const init = useAccountStore((s) => s.init);
  return (
    <Centered>
      <CloudOff className="size-6" aria-hidden />
      <p className="text-sm">
        El servidor no responde. {mode} lo necesita; Práctica sigue funcionando sin él.
      </p>
      <button type="button" className="btn" onClick={() => void init()}>
        Reintentar
      </button>
    </Centered>
  );
}

export function LoadFailed({ text, onRetry }: { text: string; onRetry(): void }) {
  return (
    <Centered>
      <CloudOff className="size-6" aria-hidden />
      <p className="text-sm">{text}</p>
      <button type="button" className="btn" onClick={onRetry}>
        Reintentar
      </button>
    </Centered>
  );
}

/** Nombre provisional: hay que elegir uno antes de jugar (aparece en el ranking). */
export function NamePrompt() {
  const openDialog = useAccountStore((s) => s.openDialog);
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <p className="text-sm text-felt-ink">
        Antes de jugar elige tu nombre: es el que aparece en el ranking.
      </p>
      <button type="button" className="btn btn-paper h-11" onClick={() => openDialog('name')}>
        <UserRound className="size-4" aria-hidden /> Elegir nombre
      </button>
    </div>
  );
}

interface GameProps {
  /** Prefijo de los data-testid (casual, ranked). */
  testId: string;
  /** Tope de la próxima apuesta (de la partida o de la cuenta del modo). */
  maxBet: number;
  /** La jugada recomendada por el motor (Casual) o null (Ranked: sin ayudas). */
  best?: Action | null;
  /** Debajo del resultado de la ronda (la revisión en Ranked, la recarga…). */
  after?: ReactNode;
  /** En lugar de las fichas y Repartir, cuando no se puede apostar (sin saldo en Ranked). */
  betBlocked?: ReactNode;
}

/** La mesa con la última ronda, la apuesta y las acciones. */
export function Game({ testId, maxBet, best = null, after, betBlocked }: GameProps) {
  const round = useRound((s) => s.round);
  const shown = useRound((s) => s.shown);
  const stack = useRound((s) => s.stack);
  const locked = useRound(roundLocked);
  const removeChip = useRound((s) => s.removeChip);
  const model = round ? tableModel(round, shown) : null;
  const inPlay = round?.phase === 'player';

  return (
    <>
      <Hand
        label="Dealer"
        cards={model?.dealer ?? []}
        hiddenIndex={model?.holeHidden ? 1 : undefined}
        testId={`${testId}-dealer-hand`}
        slots={model ? [] : ['Visible', 'Oculta']}
      />

      <div className="flex max-w-full flex-col items-center gap-2 lg:mt-auto">
        <BetStack stack={stack} locked={locked} onRemove={removeChip} testId={`${testId}-bet`} />
        <div
          className="flex max-w-full flex-wrap items-end justify-center gap-x-3 gap-y-2"
          aria-label="Tus manos"
        >
          {model ? (
            model.hands.map((h, i) => (
              <Hand
                key={h.id}
                label={model.hands.length > 1 ? `Mano ${i + 1}` : 'Tu mano'}
                cards={h.cards}
                fromSplit={h.fromSplit}
                active={model.hands.length > 1 && inPlay && i === round?.player.active}
                outcome={h.outcome}
                net={h.net === null || !round ? null : h.net / round.bet}
                doubled={h.doubled}
                testId={`${testId}-hand-${i}`}
              />
            ))
          ) : (
            <Hand label="Tu mano" cards={[]} slots={['Tu carta', 'Tu carta']} />
          )}
        </div>
      </div>

      <div className="flex w-full flex-col items-center gap-3">
        <RoundLine testId={testId} />
        {after}
        {inPlay ? (
          <Actions best={best} />
        ) : (
          (betBlocked ?? <BetControls testId={testId} maxBet={maxBet} />)
        )}
      </div>
    </>
  );
}

/** Qué está pasando: el peek del dealer y, al terminar la revelación, el resultado. */
function RoundLine({ testId }: { testId: string }) {
  const round = useRound((s) => s.round);
  const revealing = useRound((s) => s.revealing);
  let text: string | null = null;
  if (round?.peekBlackjack) {
    text = revealing
      ? 'El dealer revisa su carta oculta…'
      : 'Blackjack del dealer: lo revisó antes de que jugaras, así que no había decisión posible.';
  }
  const done = round && round.phase === 'settled' && !revealing && round.result;
  const net = done ? round.result!.net : null;
  const result =
    net === null
      ? null
      : net > 0
        ? `Ganas ${formatChips(net, true)} fichas.`
        : net < 0
          ? `Pierdes ${formatChips(-net)} fichas.`
          : 'Empate: recuperas tu apuesta.';
  const refilled = done ? round.result!.refilled : undefined;

  return (
    <div className="flex min-h-5 flex-col items-center gap-1 text-center" aria-live="polite">
      {text && <p className="max-w-md text-sm font-medium text-text">{text}</p>}
      {result && (
        <p
          className={`text-sm font-semibold ${net! > 0 ? 'text-pos' : net! < 0 ? 'text-neg' : 'text-mute'}`}
          data-testid={`${testId}-result`}
        >
          {result}
        </p>
      )}
      {refilled ? (
        <p className="text-sm text-warn" data-testid={`${testId}-refilled`}>
          Se recargó tu saldo a {formatChips(done ? round.wallet.balance : 0)} (+
          {formatChips(refilled)}). La recarga no suma al ranking.
        </p>
      ) : null}
    </div>
  );
}

/** Acciones de la mano activa: solo las que permite el servidor (`allowed`, con su saldo). */
function Actions({ best }: { best: Action | null }) {
  const round = useRound((s) => s.round);
  const busy = useRound((s) => s.busy);
  const act = useRound((s) => s.act);
  if (!round) return null;

  return (
    <div
      className="grid w-full max-w-md grid-cols-3 gap-1.5 min-[400px]:grid-cols-5 sm:flex sm:w-auto sm:max-w-none sm:flex-wrap sm:justify-center sm:gap-2"
      role="group"
      aria-label="Acciones"
      aria-busy={busy}
    >
      {ACTION_ORDER.map((a) => {
        const enabled = round.allowed[a] && !busy;
        const rec = enabled && best === a;
        return (
          <button
            key={a}
            type="button"
            className={`btn h-11 px-2 text-[13px] sm:h-10 sm:px-3.5 sm:text-sm ${rec ? 'btn-paper' : ''}`}
            disabled={!enabled}
            onClick={() => void act(a)}
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

/** Entre rondas: armar la apuesta con fichas y repartir. */
function BetControls({ testId, maxBet }: { testId: string; maxBet: number }) {
  const stack = useRound((s) => s.stack);
  const locked = useRound(roundLocked);
  const busy = useRound((s) => s.busy);
  const settled = useRound((s) => s.round?.phase === 'settled');
  const addChip = useRound((s) => s.addChip);
  const clearStack = useRound((s) => s.clearStack);
  const deal = useRound((s) => s.deal);
  const bet = stackTotal(stack);

  return (
    <div className="flex flex-col items-center gap-3">
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
        onClick={() => void deal()}
        disabled={locked || bet < MIN_BET}
        title={bet < MIN_BET ? 'Pon fichas sobre la mesa para apostar' : undefined}
        aria-keyshortcuts="Enter"
        data-testid={`${testId}-deal`}
      >
        <Play className="size-4" aria-hidden />
        {busy ? 'Repartiendo…' : settled ? 'Siguiente ronda' : 'Repartir'}
        <kbd className="kbd hidden sm:inline">Enter</kbd>
      </button>
    </div>
  );
}

const MODE_NAME: Record<RoundKind, { of: string; to: string }> = {
  casual: { of: 'de Casual', to: 'a Casual' },
  ranked: { of: 'de Ranked', to: 'a Ranked' },
  daily: { of: 'del reto diario', to: 'al reto diario' },
};

/** La mano en juego es del otro modo: el servidor no deja repartir aquí hasta terminarla. */
export function ElsewherePrompt({ kind }: { kind: RoundKind }) {
  const setScreen = useUiStore((s) => s.setScreen);
  return (
    <Centered>
      <h2 className="text-lg font-semibold text-text">
        Tienes una mano {MODE_NAME[kind].of} a medias
      </h2>
      <p className="text-sm">
        Termínala antes de jugar aquí: solo puede haber una mano en juego a la vez.
      </p>
      <button
        type="button"
        className="btn btn-paper h-11"
        onClick={() => setScreen(kind)}
        data-testid="go-elsewhere"
      >
        Ir {MODE_NAME[kind].to}
      </button>
    </Centered>
  );
}
