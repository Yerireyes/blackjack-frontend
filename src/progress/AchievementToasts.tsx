import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { playSound } from '@/lib/sound';
import { useUiStore } from '@/store/uiStore';
import { ACHIEVEMENTS, COSMETICS, SLOTS } from './catalog';
import { useProgressStore, type Toast } from './progressStore';

const SHOWN_MS = 6000;
const MAX_SHOWN = 3;

/** Un aviso por logro nuevo, arriba y aparte de los avisos de la mesa. */
export function AchievementToasts() {
  const toasts = useProgressStore((s) => s.toasts);
  const shown = toasts.slice(0, MAX_SHOWN);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4 sm:top-16 sm:right-5 sm:left-auto sm:items-end"
    >
      <AnimatePresence initial={false}>
        {shown.map((t) => (
          <AchievementToast key={t.key} toast={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function AchievementToast({ toast }: { toast: Toast }) {
  const dismiss = useProgressStore((s) => s.dismiss);
  const reward = useProgressStore(
    (s) => s.catalog?.find((c) => c.unlockedBy === toast.id && c.id in COSMETICS) ?? null,
  );
  const setScreen = useUiStore((s) => s.setScreen);
  const info = ACHIEVEMENTS[toast.id];
  const Icon = info.icon;

  useEffect(() => {
    if (useUiStore.getState().sound) playSound('achievement');
    const id = setTimeout(() => dismiss(toast.key), SHOWN_MS);
    return () => clearTimeout(id);
  }, [dismiss, toast.key]);

  return (
    <motion.div
      layout
      role="status"
      initial={{ opacity: 0, transform: 'translateY(-12px) scale(0.97)' }}
      animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
      exit={{
        opacity: 0,
        transform: 'translateY(-8px) scale(0.98)',
        transition: { duration: 0.15 },
      }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-warn/40 bg-ink-950 p-3 shadow-[0_12px_32px_rgb(0_0_0/0.5)]"
      data-testid="achievement-toast"
    >
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-full border border-warn/50 bg-warn/10 text-warn"
      >
        <Icon className="size-5" />
      </span>
      <button
        type="button"
        className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left"
        onClick={() => {
          dismiss(toast.key);
          setScreen('progress');
        }}
      >
        <span className="text-[11px] font-semibold tracking-wide text-warn uppercase">
          Logro desbloqueado
        </span>
        <span className="text-sm font-semibold">{info.name}</span>
        <span className="text-xs text-mute">{info.description}</span>
        {reward && (
          <span className="mt-1 text-xs text-text">
            Nuevo para tu mesa: {SLOTS.find((s) => s.slot === reward.slot)?.name.toLowerCase()} «
            {COSMETICS[reward.id].name}». <span className="underline">Ver en Logros</span>
          </span>
        )}
      </button>
      <button
        type="button"
        className="grid size-7 shrink-0 place-items-center rounded-md text-mute hover:text-text"
        onClick={() => dismiss(toast.key)}
        aria-label="Cerrar aviso"
      >
        <X className="size-4" aria-hidden />
      </button>
    </motion.div>
  );
}
