import { ChevronLeft } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { AccountMenu } from '@/account/AccountMenu';
import { useUiStore } from '@/store/uiStore';
import { SettingsButton } from './SettingsDialog';
import { SoundToggle } from './SoundToggle';

/** Pantalla de página (Logros, Tu juego, Administración): cabecera con volver y el contenido. */
export function PageScreen({ title, children }: { title: string; children: ReactNode }) {
  const setScreen = useUiStore((s) => s.setScreen);
  const heading = useRef<HTMLHeadingElement>(null);
  // Se llega con un clic: el botón que tenía el foco ya no existe.
  useEffect(() => {
    if (document.activeElement === document.body) heading.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-ink-800 bg-ink-950/95 px-3 py-2.5 backdrop-blur-sm sm:px-5 lg:h-14 lg:py-0">
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
          ref={heading}
          tabIndex={-1}
          className="text-[15px] font-semibold tracking-[-0.01em] outline-none"
        >
          {title}
        </h1>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <SoundToggle className="hidden sm:inline-flex" />
          <SettingsButton />
          <AccountMenu />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
