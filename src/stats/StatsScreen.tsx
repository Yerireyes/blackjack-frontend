import { ChevronDown, CloudOff, Crosshair, LogIn, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAccountStore } from '@/account/accountStore';
import { PageScreen } from '@/app/PageScreen';
import { Hand } from '@/components/Hand';
import { Segmented } from '@/components/Segmented';
import { SUIT_SYMBOL } from '@/domain/cards';
import type { CardView, HistoryItem, ModeStats, RoundKind } from '@/engine/contract';
import { formatChips, formatPct, formatUnits } from '@/lib/format';
import { ReviewList, Stat } from '@/play/ReviewView';
import { KIND_NAME, MODE_NAME, spotLabel } from './spots';
import { useStatsStore } from './statsStore';
import { useTrainingStore } from './trainingStore';

type Tab = 'stats' | 'history';

/** Tu juego: estadísticas por modo y de decisiones, el historial de rondas y el entrenamiento. */
export function StatsScreen() {
  const account = useAccountStore((s) => s.status);
  const openDialog = useAccountStore((s) => s.openDialog);
  const [tab, setTab] = useState<Tab>('stats');

  return (
    <PageScreen title="Tu juego">
      {account === 'anonymous' ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-ink-700 bg-ink-950/60 p-5 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm text-mute">
            <strong className="font-semibold text-text">Tu historial se guarda con cuenta.</strong>{' '}
            Las rondas de Casual, Ranked y el reto diario quedan registradas, con tus estadísticas y
            tus puntos débiles para entrenarlos en Práctica.
          </p>
          <button type="button" className="btn btn-paper h-11" onClick={() => openDialog('auth')}>
            <LogIn className="size-4" aria-hidden /> Entrar o crear cuenta
          </button>
        </div>
      ) : (
        <>
          <div className="max-w-xs">
            <Segmented<Tab>
              label="Sección"
              value={tab}
              options={[
                { value: 'stats', label: 'Estadísticas' },
                { value: 'history', label: 'Historial' },
              ]}
              onChange={setTab}
            />
          </div>
          {tab === 'stats' ? <StatsView /> : <HistoryView />}
        </>
      )}
    </PageScreen>
  );
}

function Unavailable({ onRetry }: { onRetry(): void }) {
  return (
    <p className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-700 bg-ink-950/50 px-4 py-3 text-sm text-mute">
      <CloudOff className="size-4" aria-hidden /> El servidor no responde ahora.
      <button type="button" className="btn h-8 min-h-0" onClick={onRetry}>
        Reintentar
      </button>
    </p>
  );
}

// ---------- Estadísticas ----------

function StatsView() {
  const stats = useStatsStore((s) => s.stats);
  const status = useStatsStore((s) => s.statsStatus);
  const load = useStatsStore((s) => s.loadStats);

  if (status === 'unavailable' && !stats) return <Unavailable onRetry={() => void load()} />;
  if (!stats) return <p className="text-sm text-mute">Cargando…</p>;

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="modes-title" className="flex flex-col gap-3">
        <h2 id="modes-title" className="section-title">
          Por modo
        </h2>
        {stats.modes.length === 0 ? (
          <p className="text-sm text-mute">Todavía no jugaste rondas contra el servidor.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-3" data-testid="stats-modes">
            {stats.modes.map((m) => (
              <ModeCard key={m.kind} m={m} />
            ))}
          </div>
        )}
      </section>
      <Decisions />
    </div>
  );
}

function ModeCard({ m }: { m: ModeStats }) {
  const pct = (n: number) => (m.rounds ? (n / m.rounds) * 100 : 0);
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-ink-800 bg-ink-950/60 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">{MODE_NAME[m.kind]}</h3>
        <span className="text-xs text-faint">
          {m.rounds} {m.rounds === 1 ? 'ronda' : 'rondas'}
        </span>
      </div>
      <p
        className={`text-2xl font-semibold tabular-nums ${m.net > 0 ? 'text-pos' : m.net < 0 ? 'text-neg' : ''}`}
      >
        {formatChips(m.net, true)}
        <span className="ml-1.5 text-xs font-normal text-faint">fichas en total</span>
      </p>
      <div className="flex flex-col gap-1.5">
        <span
          className="flex h-2 overflow-hidden rounded-full bg-ink-800"
          role="img"
          aria-label={`${m.wins} ganadas, ${m.pushes} empatadas y ${m.losses} perdidas`}
        >
          <span className="bg-pos" style={{ width: `${pct(m.wins)}%` }} />
          <span className="bg-push" style={{ width: `${pct(m.pushes)}%` }} />
          <span className="bg-neg" style={{ width: `${pct(m.losses)}%` }} />
        </span>
        <span className="flex justify-between text-[11px] text-faint tabular-nums">
          <span>{m.wins} ganadas</span>
          <span>{m.pushes} empates</span>
          <span>{m.losses} perdidas</span>
        </span>
      </div>
      <dl className="grid grid-cols-3 divide-x divide-ink-800 rounded-xl border border-ink-800 text-center">
        <Stat label="Blackjacks" value={String(m.blackjacks)} />
        <Stat label="Mejor ronda" value={formatChips(m.bestWin, true)} tone="text-pos" />
        <Stat
          label="Peor ronda"
          value={formatChips(m.worstLoss, true)}
          tone={m.worstLoss < 0 ? 'text-neg' : ''}
        />
      </dl>
    </article>
  );
}

/** Decisiones revisadas (Ranked y el reto): % óptimas, por tipo de mano y puntos débiles. */
function Decisions() {
  const d = useStatsStore((s) => s.stats?.decisions ?? null);
  const start = useTrainingStore((s) => s.start);
  if (!d) return null;

  return (
    <section aria-labelledby="decisions-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="decisions-title" className="section-title">
          Tus decisiones
        </h2>
        <p className="text-xs text-faint">
          Solo las de Ranked y el reto diario, que se revisan contra la óptima.
        </p>
      </div>
      {d.decisions === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-700 px-4 py-3 text-sm text-mute">
          Todavía no hay decisiones revisadas. Juega unas manos de Ranked o el reto diario y aquí
          verás qué situaciones te cuestan y podrás entrenarlas.
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-3 divide-x divide-ink-800 rounded-xl border border-ink-800 text-center">
            <Stat label="Decisiones" value={String(d.decisions)} />
            <Stat
              label="Óptimas"
              value={formatPct(d.optimal / d.decisions)}
              hint={`${d.optimal} de ${d.decisions}`}
            />
            <Stat label="EV perdido" value={formatUnits(-d.evLost)} hint="en apuestas" />
          </dl>
          {d.byKind.length > 0 && (
            <ul className="grid gap-2 sm:grid-cols-3">
              {d.byKind.map((k) => (
                <li
                  key={k.kind}
                  className="flex flex-col gap-1 rounded-xl border border-ink-800 p-3"
                >
                  <span className="text-xs text-faint">{KIND_NAME[k.kind]}</span>
                  <span className="text-base font-semibold tabular-nums">
                    {k.decisions ? formatPct(k.optimal / k.decisions) : '—'}
                    <span className="ml-1 text-xs font-normal text-faint">óptimas</span>
                  </span>
                  <span className="text-xs text-faint tabular-nums">
                    {k.decisions} decisiones · EV perdido {formatUnits(-k.evLost)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Tus puntos débiles</h3>
              {d.weakSpots.length > 0 && (
                <button
                  type="button"
                  className="btn btn-paper"
                  onClick={() => start(d.weakSpots)}
                  data-testid="train-weak-spots"
                >
                  <Crosshair className="size-4" aria-hidden /> Practicar mis puntos débiles
                </button>
              )}
            </div>
            {d.weakSpots.length === 0 ? (
              <p className="text-sm text-mute">
                Sin errores registrados: todas tus decisiones fueron óptimas.
              </p>
            ) : (
              <ol
                className="flex flex-col divide-y divide-ink-800 rounded-xl border border-ink-800"
                data-testid="weak-spots"
              >
                {d.weakSpots.map((w, i) => (
                  <li key={i} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                    <span className="w-5 text-right text-faint tabular-nums">{i + 1}</span>
                    <span className="flex-1 font-medium">{spotLabel(w.spot)}</span>
                    <span className="text-xs text-faint tabular-nums">
                      {w.optimal}/{w.decisions} óptimas
                    </span>
                    <span className="w-20 text-right text-neg tabular-nums">
                      {formatUnits(-w.evLost)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}
    </section>
  );
}

// ---------- Historial ----------

type KindPick = 'all' | RoundKind;

function HistoryView() {
  const items = useStatsStore((s) => s.items);
  const status = useStatsStore((s) => s.historyStatus);
  const kind = useStatsStore((s) => s.kind);
  const nextBefore = useStatsStore((s) => s.nextBefore);
  const loadingMore = useStatsStore((s) => s.loadingMore);
  const setKind = useStatsStore((s) => s.setKind);
  const loadMore = useStatsStore((s) => s.loadMore);
  const sentinel = useRef<HTMLDivElement>(null);

  // Scroll infinito: al asomar el final de la lista se pide la página siguiente.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !nextBefore || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void loadMore();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [nextBefore, loadMore]);

  return (
    <section aria-labelledby="history-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="history-title" className="section-title">
          Tus rondas
        </h2>
        <div className="w-full max-w-md">
          <Segmented<KindPick>
            label="Modo"
            value={kind ?? 'all'}
            options={[
              { value: 'all', label: 'Todas' },
              { value: 'casual', label: 'Casual' },
              { value: 'ranked', label: 'Ranked' },
              { value: 'daily', label: 'Reto' },
            ]}
            onChange={(v) => void setKind(v === 'all' ? null : v)}
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-faint">Las rondas de las salas no se guardan.</p>
      {status === 'unavailable' && items.length === 0 ? (
        <Unavailable onRetry={() => void setKind(kind)} />
      ) : status === 'loading' ? (
        <p className="text-sm text-mute">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-700 px-4 py-6 text-center text-sm text-mute">
          {kind ? `Todavía no jugaste rondas de ${MODE_NAME[kind]}.` : 'Todavía no jugaste rondas.'}
        </p>
      ) : (
        <>
          <ol
            className="flex flex-col divide-y divide-ink-800 rounded-xl border border-ink-800"
            data-testid="history"
          >
            {items.map((it) => (
              <HistoryRow key={it.id} it={it} />
            ))}
          </ol>
          <div ref={sentinel} className="flex justify-center">
            {nextBefore ? (
              <button
                type="button"
                className="btn"
                onClick={() => void loadMore()}
                disabled={loadingMore}
              >
                {loadingMore ? 'Cargando…' : 'Cargar más'}
              </button>
            ) : (
              <p className="text-xs text-faint">No hay más rondas.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

const when = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const cardText = (c: CardView) => `${c.rank}${SUIT_SYMBOL[c.suit]}`;

function HistoryRow({ it }: { it: HistoryItem }) {
  const [open, setOpen] = useState(false);
  const dealer = [it.dealer.up, ...(it.dealer.hole ? [it.dealer.hole] : []), ...it.dealer.hits];
  return (
    <li>
      <button
        type="button"
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-ink-850"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="w-24 shrink-0 text-xs text-faint">
          {when.format(new Date(it.settledAt))}
        </span>
        <span className="w-16 shrink-0 text-xs text-mute">{MODE_NAME[it.kind]}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-[13px]">
          {it.player.hands.map((h) => h.cards.map(cardText).join(' ')).join(' · ')}
          <span className="text-faint"> vs </span>
          {dealer.map(cardText).join(' ')}
        </span>
        {it.insured && (
          <ShieldCheck className="size-3.5 shrink-0 text-mute" aria-label="Con seguro" />
        )}
        <span className="hidden w-14 shrink-0 text-right text-xs text-faint tabular-nums sm:block">
          {formatChips(it.bet)}
        </span>
        <span
          className={`w-16 shrink-0 text-right font-semibold tabular-nums ${it.net > 0 ? 'text-pos' : it.net < 0 ? 'text-neg' : 'text-mute'}`}
        >
          {formatChips(it.net, true)}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-faint transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open && <HistoryDetail it={it} />}
    </li>
  );
}

/** La ronda como el final de una mano: cartas, resultado, seguro y, si hay, la revisión. */
function HistoryDetail({ it }: { it: HistoryItem }) {
  const toCard = (c: CardView, id: string) => ({ id, face: c.rank, suit: c.suit });
  const dealer = [it.dealer.up, ...(it.dealer.hole ? [it.dealer.hole] : []), ...it.dealer.hits];
  const many = it.player.hands.length > 1;
  return (
    <div className="flex flex-col gap-4 border-t border-ink-800 bg-ink-950/40 px-3 py-4">
      <div className="felt flex flex-wrap items-end justify-center gap-6 rounded-xl px-3 py-4">
        <Hand label="Dealer" cards={dealer.map((c, i) => toCard(c, `${it.id}-d${i}`))} size="sm" />
        {it.player.hands.map((h, i) => (
          <Hand
            key={i}
            label={many ? `Mano ${i + 1}` : 'Tu mano'}
            cards={h.cards.map((c, j) => toCard(c, `${it.id}-h${i}-${j}`))}
            fromSplit={h.fromSplit}
            doubled={h.doubled}
            outcome={h.outcome ?? null}
            size="sm"
          />
        ))}
      </div>
      <Line>
        Apuesta {formatChips(it.bet)} · resultado{' '}
        <strong className={it.net > 0 ? 'text-pos' : it.net < 0 ? 'text-neg' : ''}>
          {formatChips(it.net, true)}
        </strong>
        {it.insuranceNet !== undefined && <> · seguro {formatChips(it.insuranceNet, true)}</>}
        {it.peekBlackjack && ' · el dealer tenía blackjack (lo revisó antes de jugar)'}
      </Line>
      {it.review &&
        (it.review.length > 0 ? (
          <ReviewList review={it.review} bet={it.bet} many={many} testId={`history-${it.id}`} />
        ) : (
          <Line>Sin decisiones que revisar en esta ronda.</Line>
        ))}
    </div>
  );
}

const Line = ({ children }: { children: ReactNode }) => (
  <p className="text-center text-sm text-mute">{children}</p>
);
