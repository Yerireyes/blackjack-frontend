import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose(): void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

/** Diálogo nativo: foco atrapado, Escape y fondo inerte sin librerías. */
export function Dialog({ open, onClose, title, description, children, footer, wide }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="dialog-title"
      className={`dialog m-auto max-h-[min(90dvh,52rem)] w-[calc(100%-2rem)] overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 p-0 text-text shadow-[0_24px_64px_rgb(0_0_0/0.55)] backdrop:bg-ink-950/70 ${wide ? 'max-w-3xl' : 'max-w-xl'}`}
    >
      {open && (
        <div className="flex max-h-[inherit] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-ink-800 px-5 py-4">
            <div>
              <h2 id="dialog-title" className="text-lg font-semibold tracking-[-0.01em]">
                {title}
              </h2>
              {description && <p className="mt-0.5 text-sm text-mute">{description}</p>}
            </div>
            <button
              type="button"
              className="btn size-9 min-h-0 p-0"
              onClick={onClose}
              aria-label="Cerrar"
            >
              <X className="size-4" aria-hidden />
            </button>
          </header>
          <div className="overflow-y-auto px-5 py-5">{children}</div>
          {footer && (
            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-ink-800 px-5 py-3.5">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}
