import { Settings, Volume1, Volume2, VolumeX } from 'lucide-react';
import { useId } from 'react';
import { Dialog } from '@/components/Dialog';
import { Segmented } from '@/components/Segmented';
import { playSound } from '@/lib/sound';
import { useUiStore, type Motion } from '@/store/uiStore';

const MOTIONS = [
  { value: 'system', label: 'Como el sistema' },
  { value: 'reduced', label: 'Reducidas' },
] as const satisfies readonly { value: Motion; label: string }[];

const SHORTCUTS = [
  ['H', 'Pedir'],
  ['S', 'Plantarse'],
  ['D', 'Doblar'],
  ['P', 'Dividir'],
  ['R', 'Rendirse'],
  ['Enter', 'Repartir'],
] as const;

/** Botón de engranaje que abre los ajustes (cabecera de la mesa y del inicio). */
export function SettingsButton() {
  const open = useUiStore((s) => s.setSettingsOpen);
  return (
    <button
      type="button"
      className="btn h-9 min-h-0 shrink-0 px-2.5"
      onClick={() => open(true)}
      aria-label="Ajustes"
      title="Ajustes"
      data-testid="settings-button"
    >
      <Settings className="size-4 text-mute" aria-hidden />
    </button>
  );
}

/** Preferencias de este navegador. Se aplican al momento: no hay nada que guardar. */
export function SettingsDialog() {
  const open = useUiStore((s) => s.settingsOpen);
  const setOpen = useUiStore((s) => s.setSettingsOpen);
  const close = () => setOpen(false);

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Ajustes"
      description="Se guardan en este navegador."
      footer={
        <button type="button" className="btn btn-paper" onClick={close}>
          Listo
        </button>
      }
    >
      <div className="flex flex-col gap-7">
        <SoundSettings />
        <MotionSettings />
        <Shortcuts />
      </div>
    </Dialog>
  );
}

function SoundSettings() {
  const sound = useUiStore((s) => s.sound);
  const volume = useUiStore((s) => s.volume);
  const setSound = useUiStore((s) => s.setSound);
  const setVolume = useUiStore((s) => s.setVolume);
  const id = useId();
  const pct = Math.round(volume * 100);
  const Icon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3">
      <h3 id={`${id}-title`} className="section-title">
        Sonido
      </h3>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p id={`${id}-fx`} className="text-sm font-medium">
            Efectos de sonido
          </p>
          <p className="text-xs text-mute">Cartas, fichas y resultados.</p>
        </div>
        <Switch labelledBy={`${id}-fx`} on={sound} onChange={setSound} />
      </div>
      <div className={`flex items-center gap-3 ${sound ? '' : 'opacity-45'}`}>
        <label htmlFor={`${id}-vol`} className="w-16 shrink-0 text-sm">
          Volumen
        </label>
        <Icon className="size-4 shrink-0 text-mute" aria-hidden />
        <input
          id={`${id}-vol`}
          type="range"
          min={0}
          max={100}
          step={5}
          value={pct}
          disabled={!sound}
          aria-valuetext={`${pct} %`}
          onChange={(e) => setVolume(Number(e.target.value) / 100)}
          // Al soltar, una ficha de muestra para oír cómo queda.
          onPointerUp={() => playSound('chip')}
          onKeyUp={(e) => e.key.startsWith('Arrow') && playSound('chip')}
          className="h-6 min-w-0 flex-1 cursor-pointer accent-paper disabled:cursor-default"
        />
        <span className="w-10 shrink-0 text-right text-sm text-mute tabular-nums">{pct} %</span>
      </div>
    </section>
  );
}

function MotionSettings() {
  const motion = useUiStore((s) => s.motion);
  const setMotion = useUiStore((s) => s.setMotion);
  return (
    <section className="flex flex-col gap-3">
      <h3 className="section-title">Animaciones</h3>
      <Segmented label="Animaciones" value={motion} options={MOTIONS} onChange={setMotion} />
      <p className="text-xs text-mute">
        Reducidas quita el giro de cámara del modo dealer, el vuelo de las fichas y el reparto
        animado. «Como el sistema» sigue la preferencia de accesibilidad de tu dispositivo.
      </p>
    </section>
  );
}

function Shortcuts() {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="section-title">Atajos de teclado</h3>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        {SHORTCUTS.map(([key, label]) => (
          <div key={key} className="flex items-center gap-2">
            <dt>
              <kbd className="kbd">{key}</kbd>
            </dt>
            <dd className="text-mute">{label}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Switch({
  on,
  onChange,
  labelledBy,
}: {
  on: boolean;
  onChange(on: boolean): void;
  labelledBy: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-labelledby={labelledBy}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper ${
        on ? 'border-paper bg-paper' : 'border-ink-600 bg-ink-950'
      }`}
    >
      <span
        aria-hidden
        className={`absolute top-0.5 left-0.5 size-4.5 rounded-full transition-transform duration-150 ease-(--ease-out) ${
          on ? 'translate-x-5 bg-paper-ink' : 'bg-mute'
        }`}
      />
    </button>
  );
}
