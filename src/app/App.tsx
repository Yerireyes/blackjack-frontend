import { ChevronLeft } from 'lucide-react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { useEffect, useRef } from 'react';
import { AccountMenu } from '@/account/AccountMenu';
import { CasualPanel } from '@/casual/CasualPanel';
import { CasualTable } from '@/casual/CasualTable';
import { DailyPanel } from '@/daily/DailyPanel';
import { DailyTable } from '@/daily/DailyTable';
import { ModeSwitch } from '@/components/ModeSwitch';
import { ChipBalance } from '@/features/chips/ChipBalance';
import { DealerView } from '@/features/dealer-mode/DealerView';
import { PlayerView } from '@/features/player-mode/PlayerView';
import { RulesPanel } from '@/features/settings/RulesPanel';
import { ShoeHud } from '@/features/shoe-tracker/ShoeHud';
import { Table } from '@/features/table/Table';
import { AchievementToasts } from '@/progress/AchievementToasts';
import { ProgressScreen } from '@/progress/ProgressScreen';
import { RankedPanel } from '@/ranked/RankedPanel';
import { RoomPanel } from '@/rooms/RoomPanel';
import { RoomsLobby } from '@/rooms/RoomsLobby';
import { RoomTable } from '@/rooms/RoomTable';
import { StatsScreen } from '@/stats/StatsScreen';
import { TrainingPanel } from '@/stats/TrainingPanel';
import { RankedTable } from '@/ranked/RankedTable';
import { useUiStore } from '@/store/uiStore';
import { Announcer } from './Announcer';
import { Home } from './Home';
import { Notice } from './Notice';
import { SettingsButton, SettingsDialog } from './SettingsDialog';
import { SoundToggle } from './SoundToggle';
import { useKeyboard } from './useKeyboard';
import { AdminScreen } from '@/moderation/AdminScreen';
import { ReportDialog } from '@/moderation/Report';

const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.18, ease: 'easeOut' },
} as const;

export function App() {
  useKeyboard();
  const screen = useUiStore((s) => s.screen);
  const reduced = useUiStore((s) => s.motion === 'reduced');
  // Para las animaciones en CSS (las de motion ya siguen a MotionConfig).
  useEffect(() => {
    document.documentElement.dataset.motion = reduced ? 'reduce' : 'system';
  }, [reduced]);

  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>
      <AnimatePresence mode="wait" initial={false}>
        {screen === 'home' ? (
          <motion.div key="home" {...fade}>
            <Home />
          </motion.div>
        ) : screen === 'admin' ? (
          <motion.div key="admin" {...fade}>
            <AdminScreen />
          </motion.div>
        ) : screen === 'stats' ? (
          <motion.div key="stats" {...fade}>
            <StatsScreen />
          </motion.div>
        ) : screen === 'progress' ? (
          <motion.div key="progress" {...fade}>
            <ProgressScreen />
          </motion.div>
        ) : (
          <motion.div key="table" {...fade}>
            <TableScreen />
          </motion.div>
        )}
      </AnimatePresence>
      <SettingsDialog />
      <Announcer />
      <Notice />
      <ReportDialog />
      <AchievementToasts />
    </MotionConfig>
  );
}

const TITLE = {
  home: '',
  practice: 'Práctica',
  casual: 'Casual',
  ranked: 'Ranked',
  daily: 'Reto diario',
  progress: 'Logros',
  rooms: 'Salas',
  stats: 'Tu juego',
  admin: 'Administración',
} as const;

/** La mesa de Práctica, Casual o Ranked, con su cabecera y su panel de análisis. */
function TableScreen() {
  const mode = useUiStore((s) => s.mode);
  const screen = useUiStore((s) => s.screen);
  const practice = screen === 'practice';
  const roomCode = useUiStore((s) => s.roomCode);
  const setScreen = useUiStore((s) => s.setScreen);
  const title = useRef<HTMLHeadingElement>(null);
  // Se llega desde el inicio con un clic: el botón que tenía el foco ya no existe.
  useEffect(() => {
    if (document.activeElement === document.body) title.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <header className="sticky top-0 z-30 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-ink-800 bg-ink-950/95 px-3 py-2.5 backdrop-blur-sm sm:px-5 lg:h-14 lg:flex-nowrap lg:py-0">
        <div className="mr-1 flex items-center gap-1">
          <button
            type="button"
            className="btn h-9 min-h-0 gap-2 border-transparent bg-transparent pr-2.5 pl-1.5"
            onClick={() => setScreen('home')}
            aria-label="Volver al inicio"
            title="Volver al inicio"
            data-testid="home-button"
          >
            <ChevronLeft className="size-4 text-mute" aria-hidden />
            <span
              aria-hidden
              className="grid h-6 w-[1.15rem] place-items-center rounded-[3px] bg-paper font-index text-[11px] font-bold text-pip"
            >
              A
            </span>
          </button>
          <h1
            ref={title}
            tabIndex={-1}
            className="text-[15px] font-semibold tracking-[-0.01em] outline-none"
          >
            {TITLE[screen]}
          </h1>
        </div>
        {/* Jugador/Dealer y Simulación/Manual son de Práctica; Casual tiene su propia mesa. */}
        {practice && (
          <div className="order-3 flex w-full flex-col gap-2 lg:order-2 lg:w-auto lg:flex-row lg:items-center">
            <ModeSwitch />
          </div>
        )}
        {/* En móvil las herramientas van en su propia fila: junto al título no caben. */}
        <div className="order-2 flex w-full min-w-0 items-center justify-end gap-1.5 sm:ml-auto sm:w-auto sm:gap-2 lg:order-3 lg:flex-1">
          {practice && (
            <>
              <RulesPanel />
              <ShoeHud />
            </>
          )}
          <ChipBalance />
          {/* En móvil el sonido está en Ajustes: aquí no cabe. */}
          <SoundToggle className="hidden sm:inline-flex" />
          <SettingsButton />
          <AccountMenu />
        </div>
      </header>

      <main className="grid flex-1 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_27.5rem]">
        {practice ? (
          <Table />
        ) : screen === 'ranked' ? (
          <RankedTable />
        ) : screen === 'rooms' ? (
          roomCode ? (
            <RoomTable />
          ) : (
            <RoomsLobby />
          )
        ) : screen === 'daily' ? (
          <DailyTable />
        ) : (
          <CasualTable />
        )}
        <aside
          aria-label={
            screen === 'casual'
              ? 'Análisis y partida Casual'
              : screen === 'ranked'
                ? 'Temporada Ranked'
                : screen === 'daily'
                  ? 'Reto diario'
                  : screen === 'rooms'
                    ? 'Sala'
                    : mode === 'player'
                      ? 'Análisis del jugador'
                      : 'Análisis del dealer'
          }
          className="border-t border-ink-800 bg-ink-900 px-4 py-6 sm:px-6 lg:overflow-y-auto lg:border-t-0 lg:border-l"
        >
          {screen === 'rooms' ? (
            // Con ayudas, el análisis de mi mano en mi turno; sin ayudas, nada del motor.
            <RoomPanel />
          ) : screen === 'daily' ? (
            // Sin ayudas, como Ranked: el intento, la revisión y el ranking del día.
            <DailyPanel />
          ) : screen === 'ranked' ? (
            // Sin ayudas: ni EV ni recomendaciones, solo la temporada y la revisión.
            <RankedPanel />
          ) : !practice ? (
            <div className="flex flex-col gap-7">
              <PlayerView />
              <CasualPanel />
            </div>
          ) : mode === 'player' ? (
            <div className="flex flex-col gap-6">
              <TrainingPanel />
              <PlayerView />
            </div>
          ) : (
            <DealerView />
          )}
        </aside>
      </main>
    </div>
  );
}
