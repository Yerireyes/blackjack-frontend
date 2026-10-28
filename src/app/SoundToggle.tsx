import { Volume2, VolumeX } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';

export function SoundToggle({ className = '' }: { className?: string }) {
  const sound = useUiStore((s) => s.sound);
  const setSound = useUiStore((s) => s.setSound);
  const Icon = sound ? Volume2 : VolumeX;

  return (
    <button
      type="button"
      className={`btn h-9 min-h-0 shrink-0 px-2.5 ${className}`}
      onClick={() => setSound(!sound)}
      aria-pressed={sound}
      aria-label={sound ? 'Silenciar sonidos' : 'Activar sonidos'}
      title={sound ? 'Silenciar sonidos' : 'Activar sonidos'}
      data-testid="sound-toggle"
    >
      <Icon className="size-4 text-mute" aria-hidden />
    </button>
  );
}
