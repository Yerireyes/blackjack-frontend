import { Info, Trophy } from 'lucide-react';
import { useAccountStore } from '@/account/accountStore';
import { Segmented } from '@/components/Segmented';
import type { DailyRow } from '@/engine/contract';
import { PlayerTitle } from '@/progress/PlayerTitle';
import { formatChips, formatPct, upperFirst } from '@/lib/format';
import { ReviewDetail, Stat } from '@/play/ReviewView';
import type { RoundStore } from '@/play/round';
import { useDailyStore } from './dailyStore';
import type { BoardScope } from './api';
import { dayName, previousDay } from './format';
import { ReportButton } from '@/moderation/Report';

const TOP_SHOWN = 10;

/** Panel lateral del reto: tu intento, la revisión de la mano, el ranking del día y récords. */
export function DailyPanel() {
  return (
    <div className="flex flex-col gap-7">
      <AttemptSummary />
      <ReviewDetail store={useDailyStore as unknown as RoundStore} testId="daily" />
      <DayBoard />
      <Records />
      <HowItWorks />
    </div>
  );
}

function AttemptSummary() {
  const attempt = useDailyStore((s) => s.attempt);
  const balance = useDailyStore((s) => s.wallet?.balance ?? s.attempt?.balance ?? 0);
  const tally = useDailyStore((s) => s.tally);
  if (!attempt) return null;
  const { hands, handsTotal, peak, status, day } = attempt;

  return (
    <section aria-labelledby="attempt-title" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="attempt-title" className="section-title">
          Tu reto
        </h2>
        <span className="text-xs text-faint">{upperFirst(dayName(day))}</span>
      </div>
      <dl className="grid grid-cols-3 divide-x divide-ink-800 rounded-xl border border-ink-800 text-center">
        <Stat
          label={status === 'finished' ? 'Saldo final' : 'Saldo'}
          value={formatChips(balance)}
        />
        <Stat label="Pico" value={formatChips(peak)} />
        <Stat label="Manos" value={`${hands} / ${handsTotal}`} />
      </dl>
      <div
        className="relative h-1.5 rounded-full bg-ink-800"
        role="progressbar"
        aria-label="Manos jugadas"
        aria-valuemin={0}
        aria-valuemax={handsTotal}
        aria-valuenow={hands}
      >
        <span
          className={`absolute inset-y-0 left-0 rounded-full ${status === 'finished' ? 'bg-pos' : 'bg-mute/70'}`}
          style={{ width: `${Math.min(1, hands / handsTotal) * 100}%` }}
        />
      </div>
      {tally.decisions > 0 && (
        <p className="text-sm text-mute" data-testid="daily-tally">
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

type DayPick = 'today' | 'yesterday';

function DayBoard() {
  const board = useDailyStore((s) => s.board);
  const boardDay = useDailyStore((s) => s.boardDay);
  const today = useDailyStore((s) => s.today);
  const loadBoard = useDailyStore((s) => s.loadBoard);
  const scope = useDailyStore((s) => s.boardScope);
  const setScope = useDailyStore((s) => s.setBoardScope);
  const signedIn = useAccountStore((s) => s.status === 'signedIn');
  const friends = signedIn && scope === 'friends';
  const pick: DayPick = boardDay === null ? 'today' : 'yesterday';
  const options = [
    { value: 'today', label: 'Hoy' },
    { value: 'yesterday', label: 'Ayer' },
  ] as const;
  const top = board ? board.top.slice(0, TOP_SHOWN) : [];
  const me = board?.me && !top.some((r) => r.isMe) ? board.me : null;

  return (
    <section aria-labelledby="daily-board-title" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="daily-board-title" className="section-title flex items-center gap-1.5">
          <Trophy className="size-3.5" aria-hidden /> Ranking del día
        </h2>
        {today && (
          <div className="w-36">
            <Segmented<DayPick>
              label="Día del ranking"
              value={pick}
              options={options}
              onChange={(v) => void loadBoard(v === 'today' ? null : previousDay(today))}
            />
          </div>
        )}
      </div>
      {signedIn && (
        <div className="w-48">
          <Segmented<BoardScope>
            label="Quiénes"
            value={scope}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'friends', label: 'Amigos' },
            ]}
            onChange={(v) => void setScope(v)}
          />
        </div>
      )}
      {board && (
        <p className="-mt-1.5 text-xs text-faint">
          {upperFirst(dayName(board.day))} · por saldo final; solo los retos terminados
          {friends ? ', entre tú y tus amigos' : ''}.
        </p>
      )}
      {board &&
        (top.length === 0 && !me ? (
          <p className="text-sm text-mute">
            {friends
              ? 'Ninguno de tus amigos terminó el reto ese día. Invítalos desde el botón de amigos.'
              : boardDay === null
                ? 'Todavía nadie terminó el reto de hoy.'
                : 'Nadie terminó el reto ese día.'}
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

function BoardRow({ row }: { row: DailyRow }) {
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
          {row.hands} manos{!row.finished && ' · en juego (posición que tendría)'}
        </span>
      </span>
      {!row.isMe && <ReportButton name={row.displayName} />}
      <span className="tabular-nums">{formatChips(row.balance)}</span>
    </li>
  );
}

function Records() {
  const records = useDailyStore((s) => s.records?.daily ?? null);
  const signedIn = useAccountStore((s) => s.status === 'signedIn');
  if (!signedIn || !records) return null;

  return (
    <section aria-labelledby="daily-records-title" className="flex flex-col gap-3">
      <h2 id="daily-records-title" className="section-title">
        Tus retos
      </h2>
      <dl className="grid grid-cols-3 divide-x divide-ink-800 rounded-xl border border-ink-800 text-center">
        <Stat label="Terminados" value={String(records.finished)} />
        <Stat
          label="Mejor saldo"
          value={records.bestBalance === undefined ? '—' : formatChips(records.bestBalance)}
        />
        <Stat
          label="Mejor posición"
          value={records.bestRank === undefined ? '—' : String(records.bestRank)}
        />
      </dl>
    </section>
  );
}

/** Las reglas que el usuario tiene que conocer (sección «Reglas» de la guía del backend). */
function HowItWorks() {
  const fresh = useDailyStore((s) => s.attempt === null);
  return (
    <details open={fresh} className="group rounded-xl border border-ink-800">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-3 text-sm font-semibold">
        <Info className="size-4 text-mute" aria-hidden />
        Cómo funciona el reto
        <span className="ml-auto text-xs font-normal text-faint group-open:hidden">Ver</span>
      </summary>
      <ul className="flex list-disc flex-col gap-1.5 px-3.5 pb-3.5 pl-8 text-sm text-mute">
        <li>
          Un reto por día, con un solo intento. El día cambia a las 00:00 UTC (en México, la tarde o
          noche del día anterior).
        </li>
        <li>El mismo zapato para todos ese día, con las reglas de Las Vegas.</li>
        <li>
          500 fichas y 30 manos; apuesta de 10 a 500 sin pasar del saldo. Termina en la mano 30 o si
          bajas de 10 fichas.
        </li>
        <li>Gana el saldo final. Solo entran al ranking los retos terminados.</li>
        <li>Sin ayudas durante la mano; al terminar, la revisión de cada decisión.</li>
      </ul>
    </details>
  );
}
