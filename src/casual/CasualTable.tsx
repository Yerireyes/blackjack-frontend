import { CloudOff, LogIn, Play, UserRound } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useAccountStore } from '@/account/accountStore';
import { Hand } from '@/components/Hand';
import { PRESETS, type PresetId } from '@/domain/rules';
import { BetStack } from '@/features/chips/BetSpot';
import { ChipButtons } from '@/features/chips/ChipTray';
import { ACTION_KEY, ACTION_LABEL, ACTION_ORDER } from '@/features/player-mode/actions';
import { formatChips } from '@/lib/format';
import { isCurrent, useAnalysisStore } from '@/store/analysisStore';
import { MIN_BET, START_CHIPS, stackTotal } from '@/store/chipsStore';
import { useShoeStore } from '@/store/shoeStore';
import { casualLocked, casualWallet, useCasualStore } from './casualStore';
import { tableModel } from './view';

const FELT =
  'felt relative flex flex-col items-center gap-5 px-3 pt-5 pb-5 sm:gap-6 sm:px-6 sm:pt-8 lg:min-h-0';

/** Mesa de Casual: el servidor reparte y liquida; aquí solo se dibuja y se mandan intenciones. */
export function CasualTable() {
  const account = useAccountStore((s) => s.status);
  const status = useCasualStore((s) => s.status);

  let body: ReactNode;
  if (account === 'loading' || status === 'loading') body = <Centered>Cargando…</Centered>;
  else if (account === 'unavailable') body = <AccountUnavailable />;
  else if (account === 'anonymous') body = <SignInPrompt />;
  else if (status === 'unavailable') body = <CasualUnavailable />;
  else if (status === 'playing') body = <CasualGame />;
  else body = <NewRun />;

  return (
    <section aria-label="Mesa Casual" className={FELT} data-testid="casual-table">
      {body}
    </section>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="m-auto flex max-w-md flex-col items-center gap-4 py-10 text-center text-felt-ink">
      {children}
    </div>
  );
}

function SignInPrompt() {
  const openDialog = useAccountStore((s) => s.openDialog);
  return (
    <Centered>
      <h2 className="text-lg font-semibold text-text">Casual se juega con cuenta</h2>
      <p className="text-sm">
        El servidor baraja y reparte, y tu mejor partida de la semana entra en el ranking. Práctica
        sigue disponible sin cuenta.
      </p>
      <button type="button" className="btn btn-paper h-11" onClick={() => openDialog('auth')}>
        <LogIn className="size-4" aria-hidden /> Entrar o crear cuenta
      </button>
    </Centered>
  );
}

function AccountUnavailable() {
  const init = useAccountStore((s) => s.init);
  return (
    <Centered>
      <CloudOff className="size-6" aria-hidden />
      <p className="text-sm">
        El servidor no responde. Casual lo necesita; Práctica sigue funcionando sin él.
      </p>
      <button type="button" className="btn" onClick={() => void init()}>
        Reintentar
      </button>
    </Centered>
  );
}

function CasualUnavailable() {
  const enter = useCasualStore((s) => s.enter);
  return (
    <Centered>
      <CloudOff className="size-6" aria-hidden />
      <p className="text-sm">No se pudo cargar tu partida.</p>
      <button type="button" className="btn" onClick={() => void enter()}>
        Reintentar
      </button>
    </Centered>
  );
}

/** Sin partida activa: elegir reglas y empezar con 500 fichas. */
function NewRun() {
  const createRun = useCasualStore((s) => s.createRun);
  const busy = useCasualStore((s) => s.busy);
  const ended = useCasualStore((s) => s.ended);
  const needsName = useAccountStore((s) => s.me?.needsDisplayName ?? false);
  const openDialog = useAccountStore((s) => s.openDialog);
  const [preset, setPreset] = useState<PresetId>('vegas');

  return (
    <div className="m-auto flex w-full max-w-lg flex-col gap-5 py-4">
      <div className="flex flex-col gap-1.5 text-center">
        <h2 className="text-lg font-semibold">Nueva partida Casual</h2>
        <p className="text-sm text-felt-ink">
          Empiezas con {formatChips(START_CHIPS)} fichas. La partida termina cuando te retiras o te
          quedas sin fichas; tu pico entra en el ranking semanal.
        </p>
        {ended && (
          <p className="text-sm text-text" data-testid="casual-ended">
            Tu última partida terminó {ended.status === 'busted' ? 'sin fichas' : 'al retirarte'}{' '}
            con {formatChips(ended.balance)} · pico {formatChips(ended.peak)} · {ended.hands} manos.
          </p>
        )}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="section-title mb-2 text-felt-ink">Reglas</legend>
        {PRESETS.map((p) => (
          <label
            key={p.id}
            className={`flex cursor-pointer flex-col gap-0.5 rounded-xl border p-3 has-focus-visible:outline-2 has-focus-visible:outline-paper ${
              preset === p.id
                ? 'border-paper bg-felt-950/50'
                : 'border-felt-line/60 bg-felt-950/25 hover:border-felt-line'
            }`}
          >
            <input
              type="radio"
              name="casual-preset"
              value={p.id}
              checked={preset === p.id}
              onChange={() => setPreset(p.id)}
              className="sr-only"
            />
            <span className="text-sm font-semibold">{p.name}</span>
            <span className="text-xs text-felt-ink">{p.summary}</span>
          </label>
        ))}
      </fieldset>

      {needsName ? (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-felt-ink">
            Antes de jugar elige tu nombre: es el que aparece en el ranking.
          </p>
          <button type="button" className="btn btn-paper h-11" onClick={() => openDialog('name')}>
            <UserRound className="size-4" aria-hidden /> Elegir nombre
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-paper h-11 self-center px-5 text-base"
          onClick={() => void createRun(preset)}
          disabled={busy}
          data-testid="casual-start"
        >
          <Play className="size-4" aria-hidden /> Empezar partida
        </button>
      )}
    </div>
  );
}

/** Partida en curso: la mesa con la última ronda, la apuesta y las acciones. */
function CasualGame() {
  const round = useCasualStore((s) => s.round);
  const shown = useCasualStore((s) => s.shown);
  const stack = useCasualStore((s) => s.stack);
  const locked = useCasualStore(casualLocked);
  const removeChip = useCasualStore((s) => s.removeChip);
  const model = round ? tableModel(round, shown) : null;
  const inPlay = round?.phase === 'player';

  return (
    <>
      <Hand
        label="Dealer"
        cards={model?.dealer ?? []}
        hiddenIndex={model?.holeHidden ? 1 : undefined}
        testId="casual-dealer-hand"
        slots={model ? [] : ['Visible', 'Oculta']}
      />

      <div className="flex max-w-full flex-col items-center gap-2 lg:mt-auto">
        <BetStack stack={stack} locked={locked} onRemove={removeChip} testId="casual-bet" />
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
                testId={`casual-hand-${i}`}
              />
            ))
          ) : (
            <Hand label="Tu mano" cards={[]} slots={['Tu carta', 'Tu carta']} />
          )}
        </div>
      </div>

      <div className="flex w-full flex-col items-center gap-3">
        <RoundLine />
        {inPlay ? <CasualActions /> : <BetControls />}
      </div>
    </>
  );
}

/** Qué está pasando: el peek del dealer y, al terminar la revelación, el resultado. */
function RoundLine() {
  const round = useCasualStore((s) => s.round);
  const revealing = useCasualStore((s) => s.revealing);
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

  return (
    <div className="flex min-h-5 flex-col items-center gap-1 text-center" aria-live="polite">
      {text && <p className="max-w-md text-sm font-medium text-text">{text}</p>}
      {result && (
        <p
          className={`text-sm font-semibold ${net! > 0 ? 'text-pos' : net! < 0 ? 'text-neg' : 'text-mute'}`}
          data-testid="casual-result"
        >
          {result}
        </p>
      )}
    </div>
  );
}

/** Acciones de la mano activa: solo las que permite el servidor (`allowed`, con su saldo). */
function CasualActions() {
  const round = useCasualStore((s) => s.round);
  const busy = useCasualStore((s) => s.busy);
  const act = useCasualStore((s) => s.act);
  const slot = useAnalysisStore((s) => s.hand);
  const version = useShoeStore((s) => s.version);
  if (!round) return null;
  const best = slot.result && isCurrent(slot, version) ? slot.result.best : null;

  return (
    <div
      className="grid w-full max-w-md grid-cols-3 gap-1.5 min-[400px]:grid-cols-5 sm:flex sm:w-auto sm:max-w-none sm:flex-wrap sm:justify-center sm:gap-2"
      role="group"
      aria-label="Acciones"
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
function BetControls() {
  const stack = useCasualStore((s) => s.stack);
  const maxBet = useCasualStore((s) => casualWallet(s)?.maxBet ?? 0);
  const locked = useCasualStore(casualLocked);
  const busy = useCasualStore((s) => s.busy);
  const settled = useCasualStore((s) => s.round?.phase === 'settled');
  const addChip = useCasualStore((s) => s.addChip);
  const clearStack = useCasualStore((s) => s.clearStack);
  const deal = useCasualStore((s) => s.deal);
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
        data-testid="casual-deal"
      >
        <Play className="size-4" aria-hidden />
        {busy ? 'Repartiendo…' : settled ? 'Siguiente ronda' : 'Repartir'}
        <kbd className="kbd hidden sm:inline">Enter</kbd>
      </button>
    </div>
  );
}
