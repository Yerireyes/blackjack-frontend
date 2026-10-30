import { Clock } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAccountStore } from '@/account/accountStore';
import { formatChips } from '@/lib/format';
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
import { fullyShown } from '@/play/view';
import { formatWhen } from './format';
import { useRankedStore } from './rankedStore';
import { reviewSummary } from './review';

/** Mesa de Ranked: como Casual, pero sin ayudas durante la mano y con revisión al terminar. */
export function RankedTable() {
  const account = useAccountStore((s) => s.status);
  const needsName = useAccountStore((s) => s.me?.needsDisplayName ?? false);
  const status = useRankedStore((s) => s.status);
  const elsewhere = useRankedStore((s) => s.elsewhere);
  const enter = useRankedStore((s) => s.enter);

  let body: ReactNode;
  if (
    account === 'loading' ||
    status === 'loading' ||
    (account === 'signedIn' && status === 'idle')
  )
    body = <Centered>Cargando…</Centered>;
  else if (account === 'unavailable') body = <AccountUnavailable mode="Ranked" />;
  else if (account === 'anonymous')
    body = (
      <SignInPrompt title="Ranked se juega con cuenta">
        Temporadas mensuales, todos con las mismas reglas y sin ayudas durante la mano. Tu ganancia
        neta te ubica en el ranking.
      </SignInPrompt>
    );
  else if (status === 'unavailable')
    body = <LoadFailed text="No se pudo cargar tu temporada." onRetry={() => void enter()} />;
  else if (elsewhere) body = <ElsewherePrompt kind={elsewhere} />;
  else if (needsName)
    body = (
      <Centered>
        <h2 className="text-lg font-semibold text-text">Ranked</h2>
        <NamePrompt />
      </Centered>
    );
  else body = <RankedGame />;

  return (
    <section aria-label="Mesa Ranked" className={FELT} data-testid="ranked-table">
      <RoundProvider store={useRankedStore as unknown as RoundStore}>{body}</RoundProvider>
    </section>
  );
}

function RankedGame() {
  const maxBet = useRankedStore((s) => s.wallet?.maxBet ?? 0);
  const refillAt = useRankedStore((s) => s.wallet?.refillAvailableAt ?? null);
  return (
    <Game
      testId="ranked"
      maxBet={maxBet}
      // Sin ayudas: nunca se marca una jugada recomendada.
      best={null}
      after={<ReviewLine />}
      betBlocked={maxBet === 0 ? <RefillWait at={refillAt} /> : undefined}
    />
  );
}

/** Bajo el resultado: cómo jugaste la mano (el detalle está en el panel). */
function ReviewLine() {
  const round = useRankedStore((s) => s.round);
  const shown = useRankedStore((s) => s.shown);
  if (!round) {
    return (
      <p className="max-w-md text-center text-sm text-felt-ink">
        Sin ayudas durante la mano. Al terminar verás cada decisión comparada con la óptima.
      </p>
    );
  }
  if (round.phase !== 'settled' || !fullyShown(round, shown) || !round.result?.review) return null;
  const s = reviewSummary(round.result.review, round.bet);
  return (
    <p
      className={`max-w-md text-center text-sm ${s.decisions > 0 && s.optimal === s.decisions ? 'text-pos' : 'text-text'}`}
      data-testid="ranked-review-line"
    >
      {s.text}
    </p>
  );
}

/** Sin saldo para la apuesta mínima: hay que esperar la recarga a 100. */
function RefillWait({ at }: { at: string | null }) {
  const balance = useRankedStore((s) => s.wallet?.balance ?? 0);
  return (
    <div
      className="flex max-w-md flex-col items-center gap-2 rounded-xl border border-warn/40 bg-felt-950/60 px-4 py-3 text-center"
      data-testid="ranked-refill-wait"
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-warn">
        <Clock className="size-4" aria-hidden /> Te quedaste sin fichas ({formatChips(balance)})
      </p>
      <p className="text-sm text-felt-ink">
        {at
          ? `La recarga a 100 estará disponible el ${formatWhen(at)}. La mesa se actualiza sola.`
          : 'La recarga a 100 llega en cuanto el servidor la aplique.'}
      </p>
    </div>
  );
}
