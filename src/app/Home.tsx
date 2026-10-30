import {
  ArrowRight,
  Award,
  CalendarDays,
  GraduationCap,
  Settings,
  Spade,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { AccountMenu } from '@/account/AccountMenu';
import { useAccountStore } from '@/account/accountStore';
import { useCasualStore } from '@/casual/casualStore';
import { PlayingCard } from '@/components/PlayingCard';
import { useDailyStore } from '@/daily/dailyStore';
import { nextDayIn } from '@/daily/format';
import { ACHIEVEMENT_IDS, isKnownAchievement } from '@/progress/catalog';
import { PlayerTitle } from '@/progress/PlayerTitle';
import { useProgressStore } from '@/progress/progressStore';
import { endsIn, seasonName } from '@/ranked/format';
import { useRankedStore } from '@/ranked/rankedStore';
import { formatChips } from '@/lib/format';
import { useChipsStore } from '@/store/chipsStore';
import { useUiStore } from '@/store/uiStore';
import { SettingsButton } from './SettingsDialog';
import { SoundToggle } from './SoundToggle';

const EASE = [0.23, 1, 0.32, 1] as const;
const rise = (i: number) => ({
  initial: { opacity: 0, transform: 'translateY(12px)' },
  animate: { opacity: 1, transform: 'translateY(0px)' },
  transition: { duration: 0.4, ease: EASE, delay: 0.08 * i },
});

/** Pantalla de inicio: jugar contra el servidor, practicar en el navegador o ajustar. */
export function Home() {
  const title = useRef<HTMLHeadingElement>(null);
  // Al volver de una mesa el foco queda en el título, no perdido en un botón que ya no existe.
  useEffect(() => {
    if (document.activeElement === document.body || !document.activeElement) {
      title.current?.focus({ preventScroll: true });
    }
  }, []);
  const openSettings = useUiStore((s) => s.setSettingsOpen);

  return (
    <div className="felt home-felt relative flex min-h-dvh flex-col">
      <header className="flex items-center justify-end gap-2 px-3 py-2.5 sm:px-5">
        <SoundToggle />
        <SettingsButton />
        <AccountMenu />
      </header>

      <main className="flex flex-1 flex-col items-center px-4 pt-4 pb-12 sm:justify-center sm:pt-0">
        <motion.div {...rise(0)} aria-hidden className="mb-5 flex h-24 items-end sm:mb-7">
          <PlayingCard
            card={{ id: 'home-a', face: 'A', suit: 'S' }}
            className="-mr-5 origin-bottom-right -rotate-8"
          />
          <PlayingCard
            card={{ id: 'home-k', face: 'K', suit: 'H' }}
            className="origin-bottom-left rotate-6"
          />
        </motion.div>

        <motion.div {...rise(1)} className="flex flex-col items-center text-center">
          <h1
            ref={title}
            tabIndex={-1}
            className="font-index text-[2.6rem] leading-none font-semibold tracking-[-0.02em] outline-none sm:text-6xl"
          >
            Blackjack Guide
          </h1>
          <p className="mt-3 max-w-md text-[15px] text-felt-ink sm:text-base">
            Cada decisión con su valor esperado exacto. Juega por el ranking o practica a tu ritmo.
          </p>
        </motion.div>

        <nav
          aria-label="Qué quieres hacer"
          className="mt-9 grid w-full max-w-6xl gap-3 sm:mt-11 sm:grid-cols-2 md:gap-4 lg:grid-cols-3"
        >
          <motion.div {...rise(2)} className="flex">
            <CasualChoice />
          </motion.div>
          <motion.div {...rise(3)} className="flex">
            <RankedChoice />
          </motion.div>
          <motion.div {...rise(4)} className="flex">
            <DailyChoice />
          </motion.div>
          <motion.div {...rise(5)} className="flex">
            <RoomsChoice />
          </motion.div>
          <motion.div {...rise(6)} className="flex">
            <PracticeChoice />
          </motion.div>
        </nav>

        <motion.div {...rise(7)} className="mt-5 flex flex-col items-center gap-6">
          <div className="flex flex-wrap justify-center gap-x-2">
            <ProgressLink />
            <button
              type="button"
              className="btn h-11 gap-2 border-transparent bg-transparent text-felt-ink"
              onClick={() => openSettings(true)}
            >
              <Settings className="size-4" aria-hidden />
              Ajustes
              <span className="hidden text-felt-ink/70 sm:inline">
                · sonido, volumen y animaciones
              </span>
            </button>
          </div>
          <WeeklyTop />
        </motion.div>
      </main>
    </div>
  );
}

/** Logros y la apariencia de la mesa; con sesión, cuántos logros lleva. */
function ProgressLink() {
  const unlocked = useProgressStore((s) => s.achievements?.unlocked ?? null);
  const setScreen = useUiStore((s) => s.setScreen);
  const got = unlocked?.filter((u) => isKnownAchievement(u.id)).length ?? null;
  return (
    <button
      type="button"
      className="btn h-11 gap-2 border-transparent bg-transparent text-felt-ink"
      onClick={() => setScreen('progress')}
      data-testid="home-progress"
    >
      <Award className="size-4" aria-hidden />
      Logros
      <span className="text-felt-ink/70">
        · {got === null ? 'personaliza tu mesa' : `${got} de ${ACHIEVEMENT_IDS.length}`}
      </span>
    </button>
  );
}

/** Casual: lo que diga depende de la cuenta y de si hay una partida en curso. */
function CasualChoice() {
  const account = useAccountStore((s) => s.status);
  const openDialog = useAccountStore((s) => s.openDialog);
  const status = useCasualStore((s) => s.status);
  const balance = useCasualStore((s) => s.round?.wallet.balance ?? s.run?.balance ?? null);
  const hands = useCasualStore((s) => s.run?.hands ?? 0);
  const midHand = useCasualStore((s) => s.round?.phase === 'player');
  const setScreen = useUiStore((s) => s.setScreen);

  let badge: ReactNode = null;
  let detail: ReactNode =
    'Empiezas con 500 fichas y eliges las reglas. Tu mejor pico entra al ranking semanal.';
  let cta = 'Jugar Casual';
  let go = () => setScreen('casual');

  if (
    account === 'loading' ||
    (account === 'signedIn' && (status === 'idle' || status === 'loading'))
  ) {
    badge = <Badge>Cargando…</Badge>;
  } else if (account === 'unavailable' || status === 'unavailable') {
    badge = <Badge tone="warn">Sin conexión</Badge>;
    detail = 'El servidor no responde ahora. Práctica sigue disponible sin conexión.';
    cta = 'Ver estado';
  } else if (account === 'anonymous') {
    badge = <Badge>Con cuenta</Badge>;
    cta = 'Entrar y jugar';
    go = () => {
      setScreen('casual');
      openDialog('auth');
    };
  } else if (status === 'playing' && balance !== null) {
    badge = <Badge tone="live">{midHand ? 'Mano a medias' : 'En curso'}</Badge>;
    detail = (
      <>
        Saldo <strong className="font-semibold text-text">{formatChips(balance)}</strong> · {hands}{' '}
        {hands === 1 ? 'mano' : 'manos'}
      </>
    );
    cta = 'Continuar partida';
  } else {
    cta = 'Nueva partida';
  }

  return (
    <Choice
      icon={Spade}
      title="Casual"
      lead="Contra el servidor, con las ayudas del motor a la vista."
      detail={detail}
      badge={badge}
      cta={cta}
      primary
      onClick={go}
      testId="home-casual"
    />
  );
}

/** Ranked: la temporada solo se conoce al entrar al modo (pedirla la crea). */
function RankedChoice() {
  const account = useAccountStore((s) => s.status);
  const openDialog = useAccountStore((s) => s.openDialog);
  const status = useRankedStore((s) => s.status);
  const season = useRankedStore((s) => s.account);
  const midHand = useCasualStore((s) => s.elsewhere === 'ranked');
  const setScreen = useUiStore((s) => s.setScreen);

  let badge: ReactNode = <Badge>Sin ayudas</Badge>;
  let detail: ReactNode = `Temporada de ${seasonName(currentSeason())}. Con 200 manos entras al ranking y compites por medalla.`;
  let cta = 'Jugar Ranked';
  let go = () => setScreen('ranked');

  if (account === 'unavailable' || status === 'unavailable') {
    badge = <Badge tone="warn">Sin conexión</Badge>;
    detail = 'El servidor no responde ahora. Práctica sigue disponible sin conexión.';
    cta = 'Ver estado';
  } else if (account === 'anonymous') {
    badge = <Badge>Con cuenta</Badge>;
    cta = 'Entrar y jugar';
    go = () => {
      setScreen('ranked');
      openDialog('auth');
    };
  } else if (midHand) {
    badge = <Badge tone="live">Mano a medias</Badge>;
    cta = 'Continuar mano';
  } else if (season) {
    detail = (
      <>
        Neto{' '}
        <strong
          className={`font-semibold ${season.net > 0 ? 'text-pos' : season.net < 0 ? 'text-neg' : 'text-text'}`}
        >
          {formatChips(season.net, true)}
        </strong>{' '}
        · {season.hands} / {season.minHands} manos · {endsIn(season.seasonEndsAt).toLowerCase()}
      </>
    );
  }

  return (
    <Choice
      icon={Trophy}
      title="Ranked"
      lead="Temporada mensual con reglas fijas. Al terminar cada mano, la revisión."
      detail={detail}
      badge={badge}
      cta={cta}
      onClick={go}
      testId="home-ranked"
    />
  );
}

/** Temporada en curso (`AAAA-MM`, UTC) para nombrarla antes de pedir la cuenta. */
function currentSeason() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Reto diario: por empezar, en juego (mano N de 30) o terminado (saldo final y posición). */
function DailyChoice() {
  const account = useAccountStore((s) => s.status);
  const openDialog = useAccountStore((s) => s.openDialog);
  const status = useDailyStore((s) => s.status);
  const attempt = useDailyStore((s) => s.attempt);
  const rank = useDailyStore((s) => (s.boardDay === null ? (s.board?.me?.rank ?? null) : null));
  const midHand = useCasualStore((s) => s.elsewhere === 'daily');
  const setScreen = useUiStore((s) => s.setScreen);

  let badge: ReactNode = <Badge>Sin ayudas</Badge>;
  let detail: ReactNode = 'Las mismas cartas para todos hoy: 30 manos y un solo intento.';
  let cta = 'Jugar el reto';
  let go = () => setScreen('daily');

  if (
    account === 'loading' ||
    (account === 'signedIn' && (status === 'idle' || status === 'loading'))
  ) {
    badge = <Badge>Cargando…</Badge>;
  } else if (account === 'unavailable' || status === 'unavailable') {
    badge = <Badge tone="warn">Sin conexión</Badge>;
    detail = 'El servidor no responde ahora. Práctica sigue disponible sin conexión.';
    cta = 'Ver estado';
  } else if (account === 'anonymous') {
    badge = <Badge>Con cuenta</Badge>;
    cta = 'Entrar y jugar';
    go = () => {
      setScreen('daily');
      openDialog('auth');
    };
  } else if (status === 'finished' && attempt) {
    badge = <Badge tone="live">Hecho</Badge>;
    detail = (
      <>
        Saldo final{' '}
        <strong className="font-semibold text-text">{formatChips(attempt.balance)}</strong>
        {rank !== null && <> · posición {rank}</>}. {nextDayIn()}.
      </>
    );
    cta = 'Ver resultado';
  } else if (status === 'active' && attempt) {
    badge = <Badge tone="live">{midHand ? 'Mano a medias' : 'En curso'}</Badge>;
    detail = (
      <>
        Mano {Math.min(attempt.hands + 1, attempt.handsTotal)} de {attempt.handsTotal} · saldo{' '}
        <strong className="font-semibold text-text">{formatChips(attempt.balance)}</strong>
      </>
    );
    cta = 'Continuar el reto';
  }

  return (
    <Choice
      icon={CalendarDays}
      title="Reto diario"
      lead="Todos juegan el mismo zapato del día. Gana el saldo final."
      detail={detail}
      badge={badge}
      cta={cta}
      onClick={go}
      testId="home-daily"
    />
  );
}

/** Salas: multijugador en tiempo real; sin cuenta se puede ver el lobby. */
function RoomsChoice() {
  const account = useAccountStore((s) => s.status);
  const setScreen = useUiStore((s) => s.setScreen);
  return (
    <Choice
      icon={Users}
      title="Salas"
      lead="Mesas de 5 a 7 jugadores en tiempo real contra el dealer."
      detail="Crea una sala e invita con un enlace, o entra a una pública. Pila propia de 500 fichas y reacciones."
      badge={<Badge>{account === 'signedIn' ? 'Multijugador' : 'Con cuenta'}</Badge>}
      cta="Ver salas"
      onClick={() => setScreen('rooms')}
      testId="home-rooms"
    />
  );
}

function PracticeChoice() {
  const chips = useChipsStore((s) => s.player);
  const setScreen = useUiStore((s) => s.setScreen);
  return (
    <Choice
      icon={GraduationCap}
      title="Practicar"
      lead="En tu navegador, sin cuenta. Juega o reparte con el análisis a la vista."
      detail={
        <>
          Tus fichas de práctica:{' '}
          <strong className="font-semibold text-text">{formatChips(chips)}</strong>
        </>
      }
      badge={<Badge>Sin cuenta</Badge>}
      cta="Practicar"
      onClick={() => setScreen('practice')}
      testId="home-practice"
    />
  );
}

function Choice({
  icon: Icon,
  title,
  lead,
  detail,
  badge,
  cta,
  primary = false,
  onClick,
  testId,
}: {
  icon: LucideIcon;
  title: string;
  lead: string;
  detail: ReactNode;
  badge: ReactNode;
  cta: string;
  primary?: boolean;
  onClick(): void;
  testId: string;
}) {
  const id = useId();
  return (
    <button
      type="button"
      onClick={onClick}
      // Nombre corto ("Jugar: Continuar partida"); el resto se lee como descripción.
      aria-label={`${title}: ${cta}`}
      aria-describedby={`${id}-lead ${id}-detail`}
      data-testid={testId}
      className="group flex w-full flex-col gap-4 rounded-2xl border border-ink-700/80 bg-ink-950/70 p-5 text-left shadow-[0_12px_32px_rgb(0_0_0/0.28)] backdrop-blur-sm transition-[transform,border-color,background-color] duration-200 ease-(--ease-out) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper active:scale-[0.98] sm:p-6 [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-0.5 [@media(hover:hover)_and_(pointer:fine)]:hover:border-paper/40 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-ink-950/85"
    >
      <span className="flex items-start justify-between gap-3">
        <span
          aria-hidden
          className={`grid size-11 place-items-center rounded-xl ${primary ? 'bg-paper text-paper-ink' : 'border border-ink-700 bg-ink-900 text-text'}`}
        >
          <Icon className="size-5" />
        </span>
        {badge}
      </span>
      <span className="flex flex-col gap-1.5">
        <span className="text-xl font-semibold tracking-[-0.01em]">{title}</span>
        <span id={`${id}-lead`} className="text-sm text-mute">
          {lead}
        </span>
      </span>
      <span id={`${id}-detail`} className="text-sm text-mute">
        {detail}
      </span>
      <span
        className={`mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors duration-150 ${
          primary
            ? 'bg-paper text-paper-ink group-hover:bg-[#fff7e6]'
            : 'border border-ink-600 text-text group-hover:border-ink-600 group-hover:bg-ink-850'
        }`}
      >
        {cta}
        <ArrowRight
          className="size-4 transition-transform duration-200 ease-(--ease-out) group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>
    </button>
  );
}

function Badge({ children, tone }: { children: ReactNode; tone?: 'live' | 'warn' }) {
  const color =
    tone === 'live'
      ? 'border-pos/40 bg-pos/10 text-pos'
      : tone === 'warn'
        ? 'border-warn/40 bg-warn/10 text-warn'
        : 'border-ink-700 text-mute';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${color}`}
    >
      {tone === 'live' && <span className="size-1.5 rounded-full bg-pos" aria-hidden />}
      {children}
    </span>
  );
}

/** Los tres primeros del ranking semanal: un vistazo a la competencia. */
function WeeklyTop() {
  const board = useCasualStore((s) => s.board);
  const top = board?.top.slice(0, 3) ?? [];
  if (top.length === 0) return null;
  return (
    <section aria-labelledby="home-weekly" className="flex flex-col items-center gap-2">
      <h2 id="home-weekly" className="section-title flex items-center gap-1.5 text-felt-ink">
        <Trophy className="size-3.5" aria-hidden /> Top Casual de la semana
      </h2>
      <ol className="flex flex-wrap justify-center gap-2">
        {top.map((r) => (
          <li
            key={`${r.rank}-${r.displayName}`}
            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${r.isMe ? 'border-paper/50 bg-paper/10' : 'border-ink-700/80 bg-ink-950/50'}`}
          >
            <span className="text-faint tabular-nums">{r.rank}</span>
            <span className="max-w-48 truncate font-medium">
              {r.displayName}
              <PlayerTitle id={r.title} />
              {r.isMe && <span className="text-mute"> (tú)</span>}
            </span>
            <span className="text-mute tabular-nums">{formatChips(r.value)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
