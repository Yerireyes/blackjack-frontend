import { Info, Medal as MedalIcon, Trophy } from 'lucide-react';
import { useAccountStore } from '@/account/accountStore';
import { Segmented } from '@/components/Segmented';
import type { Medal, RankedRow } from '@/engine/contract';
import { PlayerTitle } from '@/progress/PlayerTitle';
import { formatChips, formatPct, upperFirst } from '@/lib/format';
import { ReviewDetail, Stat } from '@/play/ReviewView';
import type { RoundStore } from '@/play/round';
import { endsIn, previousSeason, seasonName } from './format';
import { useRankedStore } from './rankedStore';

const TOP_SHOWN = 10;

/** Panel lateral de Ranked: tu temporada, la revisión de la mano, el ranking y tus récords. */
export function RankedPanel() {
  return (
    <div className="flex flex-col gap-7">
      <SeasonSummary />
      <ReviewDetail store={useRankedStore as unknown as RoundStore} testId="ranked" />
      <SeasonBoard />
      <Records />
      <HowItWorks />
    </div>
  );
}

function SeasonSummary() {
  const account = useRankedStore((s) => s.account);
  const balance = useRankedStore((s) => s.wallet?.balance ?? s.account?.balance ?? 0);
  const me = useRankedStore((s) => (s.boardSeason === null ? (s.board?.me ?? null) : null));
  const tally = useRankedStore((s) => s.tally);
  if (!account) return null;
  const { hands, minHands, net, refilledTotal } = account;
  const missing = Math.max(0, minHands - hands);

  return (
    <section aria-labelledby="season-title" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="season-title" className="section-title">
          Temporada de {seasonName(account.season)}
        </h2>
        <span className="text-xs text-faint">{endsIn(account.seasonEndsAt)}</span>
      </div>
      <dl className="grid grid-cols-3 divide-x divide-ink-800 rounded-xl border border-ink-800 text-center">
        <Stat label="Saldo" value={formatChips(balance)} />
        <Stat
          label="Neto"
          value={formatChips(net, true)}
          tone={net > 0 ? 'text-pos' : net < 0 ? 'text-neg' : undefined}
        />
        <Stat
          label="Posición"
          value={me ? `${me.rank}` : '—'}
          hint={me?.provisional ? 'provisional' : undefined}
        />
      </dl>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-mute">Manos</span>
          <span className="tabular-nums">
            {hands} / {minHands}
          </span>
        </div>
        <div
          className="relative h-1.5 rounded-full bg-ink-800"
          role="progressbar"
          aria-label="Manos para clasificar"
          aria-valuemin={0}
          aria-valuemax={minHands}
          aria-valuenow={Math.min(hands, minHands)}
        >
          <span
            className={`absolute inset-y-0 left-0 rounded-full ${missing === 0 ? 'bg-pos' : 'bg-mute/70'}`}
            style={{ width: `${Math.min(1, hands / minHands) * 100}%` }}
          />
        </div>
        <p className="text-xs text-faint">
          {missing === 0
            ? 'Ya clasificas: tu posición cuenta para las medallas.'
            : `Te ${missing === 1 ? 'falta 1 mano' : `faltan ${missing} manos`} para entrar al ranking.`}
          {refilledTotal > 0 && ` Recargado: ${formatChips(refilledTotal)} (no suma al neto).`}
        </p>
      </div>

      {tally.decisions > 0 && (
        <p className="text-sm text-mute" data-testid="ranked-tally">
          En esta sesión:{' '}
          <span className="font-semibold text-text">
            {tally.optimal} de {tally.decisions}
          </span>{' '}
          decisiones óptimas ({formatPct(tally.optimal / tally.decisions)}).
        </p>
      )}
    </section>
  );
}

type SeasonPick = 'current' | 'previous';

function SeasonBoard() {
  const board = useRankedStore((s) => s.board);
  const boardSeason = useRankedStore((s) => s.boardSeason);
  const current = useRankedStore((s) => s.account?.season ?? null);
  const loadBoard = useRankedStore((s) => s.loadBoard);
  const pick: SeasonPick = boardSeason === null ? 'current' : 'previous';
  const options = [
    { value: 'current', label: 'Actual' },
    { value: 'previous', label: 'Anterior' },
  ] as const;
  const top = board ? board.top.slice(0, TOP_SHOWN) : [];
  const me = board?.me && !top.some((r) => r.isMe) ? board.me : null;

  return (
    <section aria-labelledby="ranked-board-title" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="ranked-board-title" className="section-title flex items-center gap-1.5">
          <Trophy className="size-3.5" aria-hidden /> Ranking
        </h2>
        {current && (
          <div className="w-44">
            <Segmented<SeasonPick>
              label="Temporada del ranking"
              value={pick}
              options={options}
              onChange={(v) => void loadBoard(v === 'current' ? null : previousSeason(current))}
            />
          </div>
        )}
      </div>
      {board ? (
        <p className="-mt-1.5 text-xs text-faint">
          {upperFirst(seasonName(board.season))} ·{' '}
          {board.closed
            ? 'cerrada: posiciones finales y medallas.'
            : `por ganancia neta; cuentan quienes tienen ${board.minHands} manos o más.`}
        </p>
      ) : (
        boardSeason !== null && (
          <p className="text-sm text-mute">No hay datos de {seasonName(boardSeason)}.</p>
        )
      )}
      {board &&
        (top.length === 0 && !me ? (
          <p className="text-sm text-mute">
            {board.closed
              ? 'Nadie clasificó en esa temporada.'
              : `Todavía nadie llegó a ${board.minHands} manos esta temporada.`}
          </p>
        ) : (
          <ol className="flex flex-col divide-y divide-ink-800 rounded-xl border border-ink-800">
            {top.map((r) => (
              <BoardRow key={`${r.rank}-${r.displayName}`} row={r} />
            ))}
            {me && (
              <>
                {top.length > 0 && (
                  <li className="px-3 py-1 text-center text-xs text-faint" aria-hidden>
                    ⋯
                  </li>
                )}
                <BoardRow row={me} />
              </>
            )}
          </ol>
        ))}
    </section>
  );
}

const MEDAL: Record<Medal, { label: string; className: string }> = {
  gold: { label: 'Oro', className: 'text-[#e8c35a]' },
  silver: { label: 'Plata', className: 'text-[#c9d1d9]' },
  bronze: { label: 'Bronce', className: 'text-[#d08a52]' },
  top10: { label: 'Top 10', className: 'text-mute' },
};

function MedalBadge({ medal }: { medal: Medal }) {
  const m = MEDAL[medal];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${m.className}`}>
      <MedalIcon className="size-3.5" aria-hidden />
      {m.label}
    </span>
  );
}

function BoardRow({ row }: { row: RankedRow }) {
  return (
    <li
      className={`flex items-center gap-3 px-3 py-2 text-sm ${row.isMe ? 'bg-paper/10 font-semibold' : ''}`}
      aria-current={row.isMe ? 'true' : undefined}
    >
      <span className="w-6 text-right text-mute tabular-nums">{row.rank}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">
          {row.displayName}
          <PlayerTitle id={row.title} />
          {row.isMe && <span className="text-mute"> (tú)</span>}
        </span>
        <span className="text-xs font-normal text-faint">
          {row.hands} manos{row.provisional && ' · provisional'}
        </span>
      </span>
      {row.medal && <MedalBadge medal={row.medal} />}
      <span className={`tabular-nums ${row.net > 0 ? 'text-pos' : row.net < 0 ? 'text-neg' : ''}`}>
        {formatChips(row.net, true)}
      </span>
    </li>
  );
}

function Records() {
  const records = useRankedStore((s) => s.records?.ranked ?? null);
  const signedIn = useAccountStore((s) => s.status === 'signedIn');
  if (!signedIn || !records) return null;

  return (
    <section aria-labelledby="ranked-records-title" className="flex flex-col gap-3">
      <h2 id="ranked-records-title" className="section-title">
        Tus temporadas
      </h2>
      {records.seasons.length === 0 ? (
        <p className="text-sm text-mute">
          Cuando termine una temporada en la que clasifiques, aparecerá aquí con tu medalla.
        </p>
      ) : (
        <>
          {records.bestRank !== undefined && (
            <p className="text-sm text-mute">
              Mejor posición final:{' '}
              <span className="font-semibold text-text">{records.bestRank}</span>
            </p>
          )}
          <ul className="flex flex-col divide-y divide-ink-800 rounded-xl border border-ink-800">
            {records.seasons.map((s) => (
              <li key={s.season} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{upperFirst(seasonName(s.season))}</span>
                {s.medal && <MedalBadge medal={s.medal} />}
                <span className="text-mute tabular-nums">#{s.rank}</span>
                <span
                  className={`w-16 text-right tabular-nums ${s.net > 0 ? 'text-pos' : s.net < 0 ? 'text-neg' : ''}`}
                >
                  {formatChips(s.net, true)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** Las reglas que el usuario tiene que conocer (sección «Reglas» de la guía del backend). */
function HowItWorks() {
  const fresh = useRankedStore((s) => (s.account?.hands ?? 0) === 0);
  return (
    <details open={fresh} className="group rounded-xl border border-ink-800">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-3 text-sm font-semibold">
        <Info className="size-4 text-mute" aria-hidden />
        Cómo funciona Ranked
        <span className="ml-auto text-xs font-normal text-faint group-open:hidden">Ver</span>
      </summary>
      <ul className="flex list-disc flex-col gap-1.5 px-3.5 pb-3.5 pl-8 text-sm text-mute">
        <li>Temporadas mensuales (UTC). Cada una empieza con 500 fichas.</li>
        <li>
          Reglas fijas de Las Vegas: 6 mazos, S17, doblar con dos cartas y tras dividir, hasta 4
          manos, rendición tardía, peek y 3:2.
        </li>
        <li>Apuesta máxima: el 25 % de tu saldo, entre 10 y 500.</li>
        <li>
          Si bajas de 100 fichas, se recarga a 100 una vez cada 24 h. Lo recargado no suma al
          ranking.
        </li>
        <li>
          El ranking ordena por ganancia neta. Para aparecer y ganar medalla hacen falta 200 manos.
        </li>
        <li>Sin ayudas durante la mano; al terminar, la revisión de cada decisión.</li>
      </ul>
    </details>
  );
}
