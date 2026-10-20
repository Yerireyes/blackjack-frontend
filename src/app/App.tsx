import { MotionConfig } from 'motion/react';
import { ModeSwitch } from '@/components/ModeSwitch';
import { DealerView } from '@/features/dealer-mode/DealerView';
import { PlayerView } from '@/features/player-mode/PlayerView';
import { RulesPanel } from '@/features/settings/RulesPanel';
import { ShoeHud } from '@/features/shoe-tracker/ShoeHud';
import { Table } from '@/features/table/Table';
import { useUiStore } from '@/store/uiStore';
import { Announcer } from './Announcer';
import { Notice } from './Notice';
import { useKeyboard } from './useKeyboard';

export function App() {
  useKeyboard();
  const mode = useUiStore((s) => s.mode);

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-dvh flex-col lg:h-dvh">
        <header className="sticky top-0 z-30 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-ink-800 bg-ink-950/95 px-3 py-2.5 backdrop-blur-sm sm:px-5 lg:h-14 lg:flex-nowrap lg:py-0">
          <h1 className="mr-1 flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]">
            <span
              aria-hidden
              className="grid h-6 w-[1.15rem] place-items-center rounded-[3px] bg-paper font-index text-[11px] font-bold text-pip"
            >
              A
            </span>
            Blackjack Guide
          </h1>
          <div className="order-3 w-full lg:order-2 lg:w-auto">
            <ModeSwitch />
          </div>
          <div className="order-2 ml-auto flex min-w-0 items-center justify-end gap-2 lg:order-3 lg:flex-1">
            <RulesPanel />
            <ShoeHud />
          </div>
        </header>

        <main className="grid flex-1 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_27.5rem]">
          <Table />
          <aside
            aria-label={mode === 'player' ? 'Análisis del jugador' : 'Análisis del dealer'}
            className="border-t border-ink-800 bg-ink-900 px-4 py-6 sm:px-6 lg:overflow-y-auto lg:border-t-0 lg:border-l"
          >
            {mode === 'player' ? <PlayerView /> : <DealerView />}
          </aside>
        </main>
      </div>
      <Announcer />
      <Notice />
    </MotionConfig>
  );
}
