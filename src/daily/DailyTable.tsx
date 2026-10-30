import { CalendarCheck, Play, TriangleAlert } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useAccountStore } from '@/account/accountStore';
import { formatChips, upperFirst } from '@/lib/format';
import { ReviewLine } from '@/play/ReviewView';
import type { RoundStore } from '@/play/round';
import {
  AccountUnavailable,
  Centered,
  ElsewherePrompt,
  FELT,
  Game,
  LoadFailed,
  NamePrompt,
  RoundProvider,
  SignInPrompt,
} from '@/play/ServerTable';
import { useDailyStore } from './dailyStore';
import { dayName, nextDayIn } from './format';

const store = useDailyStore as unknown as RoundStore;

/** Mesa del reto diario: como Ranked (sin ayudas, con revisión), con 30 manos y un intento. */
export function DailyTable() {
  const account = useAccountStore((s) => s.status);
  const needsName = useAccountStore((s) => s.me?.needsDisplayName ?? false);
  const status = useDailyStore((s) => s.status);
  const elsewhere = useDailyStore((s) => s.elsewhere);
  const hasRound = useDailyStore((s) => s.round !== null);
  const enter = useDailyStore((s) => s.enter);

  let body: ReactNode;
  if (
    account === 'loading' ||
    status === 'loading' ||
    (account === 'signedIn' && status === 'idle')
  )
    body = <Centered>Cargando…</Centered>;
  else if (account === 'unavailable') body = <AccountUnavailable mode="El reto diario" />;
  else if (account === 'anonymous')
    body = (
      <SignInPrompt title="El reto diario se juega con cuenta">
        Todos juegan las mismas cartas cada día: 30 manos, un solo intento y gana el saldo final.
      </SignInPrompt>
    );
  else if (status === 'unavailable')
    body = <LoadFailed text="No se pudo cargar el reto de hoy." onRetry={() => void enter()} />;
  else if (elsewhere) body = <ElsewherePrompt kind={elsewhere} />;
  else if (status === 'none') body = needsName ? <NameFirst /> : <Intro />;
  // Al terminar con la última mano todavía en la mesa, se ve su liquidación y su revisión.
  else if (status === 'active' || hasRound) body = <DailyGame />;
  else body = <Done />;

  return (
    <section aria-label="Mesa del reto diario" className={FELT} data-testid="daily-table">
      <RoundProvider store={store}>{body}</RoundProvider>
    </section>
  );
}

function NameFirst() {
  return (
    <Centered>
      <h2 className="text-lg font-semibold text-text">Reto diario</h2>
      <NamePrompt />
    </Centered>
  );
}

/** Antes de empezar: las reglas y el aviso de que hay un solo intento. */
function Intro() {
  const start = useDailyStore((s) => s.start);
  const busy = useDailyStore((s) => s.busy);
  const day = useDailyStore((s) => s.today);

  return (
    <div className="m-auto flex w-full max-w-lg flex-col items-center gap-5 py-4 text-center">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-semibold">Reto de hoy</h2>
        {day && <p className="text-sm text-felt-ink">{upperFirst(dayName(day))} (UTC)</p>}
      </div>
      <ul className="flex flex-col gap-1.5 text-sm text-felt-ink">
        <li>Las mismas cartas para todos: el zapato del día es igual para cada jugador.</li>
        <li>500 fichas y 30 manos, con las reglas de Las Vegas. Apuesta de 10 a 500.</li>
        <li>Gana el saldo final. Sin ayudas durante la mano; al terminar, la revisión.</li>
      </ul>
      <p className="flex items-start gap-2 rounded-xl border border-warn/40 bg-felt-950/60 px-4 py-3 text-left text-sm text-warn">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        Hay un solo intento por día. Si lo dejas a medias, a las 00:00 UTC se cierra sin entrar al
        ranking.
      </p>
      <button
        type="button"
        className="btn btn-paper h-11 px-5 text-base"
        onClick={() => void start()}
        disabled={busy}
        data-testid="daily-start"
      >
        <Play className="size-4" aria-hidden /> Empezar el reto de hoy
      </button>
    </div>
  );
}

function DailyGame() {
  const maxBet = useDailyStore((s) => s.wallet?.maxBet ?? 0);
  const finished = useDailyStore((s) => s.status === 'finished');
  return (
    <Game
      testId="daily"
      maxBet={maxBet}
      // Sin ayudas: nunca se marca una jugada recomendada.
      best={null}
      after={
        <>
          <HandCounter />
          <ReviewLine store={store} testId="daily" />
        </>
      }
      betBlocked={finished || maxBet === 0 ? <DoneBanner /> : undefined}
    />
  );
}

/** «Mano 7 de 30»: la que se está jugando o la próxima. */
function HandCounter() {
  const hands = useDailyStore((s) => s.attempt?.hands ?? 0);
  const total = useDailyStore((s) => s.attempt?.handsTotal ?? 30);
  const active = useDailyStore((s) => s.status === 'active');
  if (!active) return null;
  return (
    <p
      className="text-xs font-semibold tracking-wide text-felt-ink uppercase"
      data-testid="daily-hand"
    >
      Mano {Math.min(hands + 1, total)} de {total}
    </p>
  );
}

/** Minutos que faltan para el próximo reto, al día. */
function useNextDay() {
  const [text, setText] = useState(() => nextDayIn());
  useEffect(() => {
    const id = setInterval(() => setText(nextDayIn()), 30_000);
    return () => clearInterval(id);
  }, []);
  return text;
}

function useResult() {
  const balance = useDailyStore((s) => s.attempt?.balance ?? 0);
  const hands = useDailyStore((s) => s.attempt?.hands ?? 0);
  const rank = useDailyStore((s) => (s.boardDay === null ? (s.board?.me?.rank ?? null) : null));
  return { balance, hands, rank };
}

/** En lugar de las fichas, tras la última mano. */
function DoneBanner() {
  const { balance, rank } = useResult();
  const next = useNextDay();
  return (
    <div
      className="flex max-w-md flex-col items-center gap-1 rounded-xl border border-paper/30 bg-felt-950/60 px-4 py-3 text-center"
      data-testid="daily-done"
    >
      <p className="flex items-center gap-2 text-sm font-semibold">
        <CalendarCheck className="size-4" aria-hidden /> Terminaste el reto de hoy
      </p>
      <p className="text-sm text-felt-ink">
        Saldo final <strong className="text-text">{formatChips(balance)}</strong>
        {rank !== null && (
          <>
            {' '}
            · posición <strong className="text-text">{rank}</strong>
          </>
        )}
        . {next}.
      </p>
    </div>
  );
}

/** Al volver con el reto ya terminado: el resultado, sin botón de jugar. */
function Done() {
  const { balance, hands, rank } = useResult();
  const next = useNextDay();
  return (
    <Centered>
      <CalendarCheck className="size-7 text-text" aria-hidden />
      <h2 className="text-lg font-semibold text-text">Ya jugaste el reto de hoy</h2>
      <dl className="flex gap-6 text-center" data-testid="daily-done">
        <div>
          <dt className="text-xs">Saldo final</dt>
          <dd className="text-2xl font-semibold text-text tabular-nums">{formatChips(balance)}</dd>
        </div>
        <div>
          <dt className="text-xs">Posición</dt>
          <dd className="text-2xl font-semibold text-text tabular-nums">{rank ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs">Manos</dt>
          <dd className="text-2xl font-semibold text-text tabular-nums">{hands}</dd>
        </div>
      </dl>
      <p className="text-sm">{next}. Mientras tanto, mira el ranking del día en el panel.</p>
    </Centered>
  );
}
