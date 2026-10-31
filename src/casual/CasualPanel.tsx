import { Flag, Trophy } from 'lucide-react';
import { useState } from 'react';
import { PRESETS } from '@/domain/rules';
import { rulesSummary } from '@/features/settings/rulesSummary';
import type { CosmeticId } from '@/engine/contract';
import { formatChips, formatPct } from '@/lib/format';
import { PlayerTitle } from '@/progress/PlayerTitle';
import { useAccountStore } from '@/account/accountStore';
import { casualLocked, useCasualStore } from './casualStore';
import { ReportButton } from '@/moderation/Report';

const TOP_SHOWN = 10;
const weekDate = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

/** Panel lateral de Casual: tu partida, el ranking semanal y tus récords. */
export function CasualPanel() {
  return (
    <div className="flex flex-col gap-7">
      <RunSummary />
      <WeeklyBoard />
      <Records />
    </div>
  );
}

function RunSummary() {
  const run = useCasualStore((s) => s.run);
  const balance = useCasualStore((s) => s.round?.wallet.balance ?? s.run?.balance ?? 0);
  const penetration = useCasualStore((s) => s.round?.penetration ?? s.run?.penetration ?? 0);
  const locked = useCasualStore(casualLocked);
  const retire = useCasualStore((s) => s.retire);
  const [confirm, setConfirm] = useState(false);
  if (!run) return null;
  const preset = PRESETS.find((p) => p.id === run.preset);

  return (
    <section aria-labelledby="run-title" className="flex flex-col gap-3">
      <h2 id="run-title" className="section-title">
        Tu partida
      </h2>
      <p className="text-sm">
        <span className="font-semibold">{preset?.name ?? 'Reglas personalizadas'}</span>
        <span className="text-mute"> · {rulesSummary(run.rules)}</span>
      </p>
      <dl className="grid grid-cols-3 divide-x divide-ink-800 rounded-xl border border-ink-800 text-center">
        <Stat label="Saldo" value={formatChips(balance)} />
        <Stat label="Pico" value={formatChips(run.peak)} />
        <Stat label="Manos" value={String(run.hands)} />
      </dl>
      <div className="flex items-center gap-3 text-xs text-mute">
        <span>Zapato repartido</span>
        <span className="relative h-1.5 flex-1 rounded-full bg-ink-800" aria-hidden>
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-mute/70"
            style={{ width: `${Math.min(1, penetration) * 100}%` }}
          />
        </span>
        <span className="tabular-nums">{formatPct(penetration)}</span>
      </div>

      {confirm ? (
        <div
          role="group"
          aria-label="Confirmar retirada"
          className="flex flex-col gap-3 rounded-xl border border-warn/50 bg-warn/10 p-3.5"
        >
          <p className="text-sm">
            La partida termina con {formatChips(balance)} fichas y no se puede reabrir. Tu pico
            queda en el ranking de la semana.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn" onClick={() => setConfirm(false)}>
              Seguir jugando
            </button>
            <button
              type="button"
              className="btn btn-paper"
              disabled={locked}
              onClick={() => {
                setConfirm(false);
                void retire();
              }}
            >
              Retirarme
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="btn self-start"
          onClick={() => setConfirm(true)}
          disabled={locked}
          title={locked ? 'Termina la ronda antes de retirarte' : undefined}
        >
          <Flag className="size-4" aria-hidden /> Retirarme
        </button>
      )}
    </section>
  );
}

function WeeklyBoard() {
  const board = useCasualStore((s) => s.board);
  if (!board) return null;
  const top = board.top.slice(0, TOP_SHOWN);
  const me = board.me && !top.some((r) => r.isMe) ? board.me : null;

  return (
    <section aria-labelledby="board-title" className="flex flex-col gap-3">
      <h2 id="board-title" className="section-title flex items-center gap-1.5">
        <Trophy className="size-3.5" aria-hidden /> Ranking semanal
      </h2>
      <p className="-mt-1.5 text-xs text-faint">
        Mejor pico por jugador desde el lunes {weekDate.format(new Date(board.weekStart))}.
      </p>
      {top.length === 0 ? (
        <p className="text-sm text-mute">Todavía nadie jugó esta semana.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-ink-800 rounded-xl border border-ink-800">
          {top.map((r) => (
            <BoardRow key={`${r.rank}-${r.displayName}`} {...r} />
          ))}
          {me && (
            <>
              <li className="px-3 py-1 text-center text-xs text-faint" aria-hidden>
                ⋯
              </li>
              <BoardRow {...me} />
            </>
          )}
        </ol>
      )}
    </section>
  );
}

function BoardRow({
  rank,
  displayName,
  title,
  value,
  isMe,
}: {
  rank: number;
  displayName: string;
  title?: CosmeticId;
  value: number;
  isMe: boolean;
}) {
  return (
    <li
      className={`flex items-center gap-3 px-3 py-2 text-sm ${isMe ? 'bg-paper/10 font-semibold' : ''}`}
      aria-current={isMe ? 'true' : undefined}
    >
      <span className="w-6 text-right text-mute tabular-nums">{rank}</span>
      <span className="min-w-0 flex-1 truncate">
        {displayName}
        <PlayerTitle id={title} />
        {isMe && <span className="text-mute"> (tú)</span>}
      </span>
      {!isMe && <ReportButton name={displayName} />}
      <span className="tabular-nums">{formatChips(value)}</span>
    </li>
  );
}

function Records() {
  const records = useCasualStore((s) => s.records);
  const signedIn = useAccountStore((s) => s.status === 'signedIn');
  if (!signedIn || !records) return null;
  const { runs, bestPeak, mostHands } = records.casual;

  return (
    <section aria-labelledby="records-title" className="flex flex-col gap-3">
      <h2 id="records-title" className="section-title">
        Tus récords
      </h2>
      <dl className="grid grid-cols-3 divide-x divide-ink-800 rounded-xl border border-ink-800 text-center">
        <Stat label="Partidas" value={String(runs)} />
        <Stat label="Mejor pico" value={bestPeak === undefined ? '—' : formatChips(bestPeak)} />
        <Stat label="Más manos" value={mostHands === undefined ? '—' : String(mostHands)} />
      </dl>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-2 py-3">
      <dt className="text-[11px] leading-tight text-faint">{label}</dt>
      <dd className="text-base font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
