import { hasCardsInPlay, switchSource } from '@/store/actions';
import { useUiStore, type Mode, type Source } from '@/store/uiStore';
import { Segmented } from './Segmented';

const MODES = [
  { value: 'player', label: 'Jugador' },
  { value: 'dealer', label: 'Dealer' },
] as const satisfies readonly { value: Mode; label: string }[];

const SOURCES = [
  { value: 'simulation', label: 'Simulación' },
  { value: 'manual', label: 'Manual' },
] as const satisfies readonly { value: Source; label: string }[];

/** Jugador / Dealer conserva mesa y zapato. Simulación / Manual empieza un zapato nuevo. */
export function ModeSwitch() {
  const mode = useUiStore((s) => s.mode);
  const source = useUiStore((s) => s.source);
  const setMode = useUiStore((s) => s.setMode);

  const changeSource = (next: Source) => {
    if (
      hasCardsInPlay() &&
      !window.confirm(
        'Cambiar la fuente de cartas empieza un zapato nuevo y limpia la mesa. ¿Continuar?',
      )
    ) {
      return;
    }
    switchSource(next);
  };

  return (
    <div className="grid grid-cols-2 gap-2 lg:flex lg:items-center">
      <Segmented label="Modo" value={mode} options={MODES} onChange={setMode} />
      <Segmented
        label="Fuente de cartas"
        value={source}
        options={SOURCES}
        onChange={changeSource}
      />
    </div>
  );
}
