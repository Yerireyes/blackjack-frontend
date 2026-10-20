import { LoaderCircle, RotateCcw, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cancelAnalysis, retryAnalysis } from '@/engine/sync';
import { formatMs } from '@/lib/format';
import type { Slot } from '@/store/analysisStore';

interface Props {
  title: string;
  slot: Slot<{ computeMs: number }>;
  stale: boolean;
  /** Qué mostrar cuando no hay nada que calcular. */
  empty?: ReactNode;
  children: ReactNode;
  testId?: string;
}

/**
 * Marco de una sección de análisis. Mientras el motor calcula, los números
 * anteriores se atenúan y no se pueden confundir con los del estado actual.
 */
export function AnalysisFrame({ title, slot, stale, empty, children, testId }: Props) {
  const computing = slot.status === 'computing';
  const hasResult = slot.result !== null;
  return (
    <section
      aria-labelledby={`${testId}-title`}
      data-testid={testId}
      data-state={
        computing
          ? 'computing'
          : slot.status === 'error'
            ? 'error'
            : hasResult
              ? stale
                ? 'stale'
                : 'current'
              : 'empty'
      }
      aria-busy={computing}
      className="flex flex-col gap-3"
    >
      <header className="flex min-h-5 items-center justify-between gap-3">
        <h2 id={`${testId}-title`} className="section-title">
          {title}
        </h2>
        <Status slot={slot} stale={stale} />
      </header>

      {slot.status === 'error' ? (
        <div role="alert" className="rounded-xl border border-ink-700 bg-ink-950 p-4 text-sm">
          <p className="font-medium text-neg">El motor no pudo calcular este estado.</p>
          <p className="mt-1 text-mute">{slot.error}</p>
          <button type="button" className="btn mt-3" onClick={retryAnalysis}>
            <RotateCcw className="size-4" aria-hidden /> Reintentar
          </button>
        </div>
      ) : hasResult ? (
        <div
          className={`transition-[opacity,filter] duration-200 ${stale || computing ? 'pointer-events-none opacity-40 saturate-50' : ''}`}
          aria-hidden={stale || undefined}
        >
          {children}
        </div>
      ) : computing ? (
        <Skeleton />
      ) : (
        <div className="rounded-xl border border-dashed border-ink-700 p-4 text-sm text-mute">
          {slot.reason ?? empty}
        </div>
      )}
    </section>
  );
}

function Status({ slot, stale }: { slot: Slot<{ computeMs: number }>; stale: boolean }) {
  if (slot.status === 'computing') {
    return (
      <span className="flex items-center gap-2 text-xs text-warn" role="status">
        <LoaderCircle className="size-3.5 animate-spin [animation-duration:700ms]" aria-hidden />
        Calculando…
        {slot.slow && (
          <button type="button" className="btn h-7 min-h-0 px-2 text-xs" onClick={cancelAnalysis}>
            <X className="size-3.5" aria-hidden /> Cancelar
          </button>
        )}
      </span>
    );
  }
  if (slot.result && !stale) {
    return <span className="text-xs text-faint">motor · {formatMs(slot.result.computeMs)}</span>;
  }
  return null;
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl bg-ink-850" />
      ))}
    </div>
  );
}
