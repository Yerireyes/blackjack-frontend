import { CircleAlert, Info } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useTableStore } from '@/store/tableStore';

/** Aviso breve (rebarajado, carta agotada…). Se va solo a los 4 s. */
export function Notice() {
  const notice = useTableStore((s) => s.notice);
  const [dismissed, setDismissed] = useState<number | null>(null);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setDismissed(notice.id), 4000);
    return () => clearTimeout(id);
  }, [notice]);
  const shown = notice && notice.id !== dismissed ? notice : null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <AnimatePresence>
        {shown && (
          <motion.div
            key={shown.id}
            role={shown.tone === 'error' ? 'alert' : 'status'}
            initial={{ opacity: 0, transform: 'translateY(100%)' }}
            animate={{ opacity: 1, transform: 'translateY(0%)' }}
            exit={{ opacity: 0, transform: 'translateY(30%)', transition: { duration: 0.15 } }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="pointer-events-auto flex max-w-md items-start gap-2.5 rounded-xl border border-ink-700 bg-ink-950 px-4 py-3 text-sm shadow-[0_12px_32px_rgb(0_0_0/0.5)]"
          >
            {shown.tone === 'error' ? (
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-neg" aria-hidden />
            ) : (
              <Info className="mt-0.5 size-4 shrink-0 text-mute" aria-hidden />
            )}
            {shown.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
