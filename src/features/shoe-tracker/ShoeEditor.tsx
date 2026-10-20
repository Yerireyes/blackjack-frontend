import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { Dialog } from '@/components/Dialog';
import { FACES, RANK_LABELS, type Face } from '@/domain/cards';
import { countByFace, faceCapacity, sumCounts } from '@/domain/shoe';
import { ShoeError, useShoeStore } from '@/store/shoeStore';
import { tableCardIds, useTableStore } from '@/store/tableStore';

/** Grilla de 13 rangos con lo que queda. Toda corrección sube la versión y recalcula. */
export function ShoeEditor({ open, onClose }: { open: boolean; onClose(): void }) {
  const remaining = useShoeStore((s) => s.remaining);
  const hidden = useShoeStore((s) => s.hidden);
  const seen = useShoeStore((s) => s.seen);
  const decks = useShoeStore((s) => s.decks);
  const counts = useShoeStore((s) => s.toCounts)();
  const table = useTableStore();
  const [error, setError] = useState<string | null>(null);

  const left = countByFace(remaining);
  const locked = tableCardIds(table);
  const onTable = countByFace([...seen.filter((c) => locked.has(c.id)), ...hidden]);
  const cap = faceCapacity(decks);

  const change = (face: Face, n: number) => {
    try {
      useShoeStore.getState().setFaceCount(face, n, locked);
      setError(null);
    } catch (e) {
      if (e instanceof ShoeError) setError(e.message);
      else throw e;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title="Zapato"
      description={`Quedan ${sumCounts(counts)} cartas sin ver de ${decks * 52}. La oculta del dealer cuenta como sin ver.`}
    >
      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5"
        data-testid="shoe-editor"
      >
        {FACES.map((f) => {
          const max = cap - onTable[f];
          return (
            <div
              key={f}
              className="flex items-center justify-between gap-2 rounded-xl border border-ink-800 bg-ink-950 p-2.5"
            >
              <div className="flex items-baseline gap-2">
                <span className="w-7 font-index text-xl font-semibold">{f}</span>
                <span className="flex flex-col leading-tight">
                  <span className="text-base font-semibold" data-testid={`shoe-count-${f}`}>
                    {left[f]}
                  </span>
                  <span className="text-[10px] text-faint">de {cap}</span>
                </span>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  className="btn size-8 min-h-0 p-0"
                  aria-label={`Quitar un ${f} del zapato`}
                  disabled={left[f] === 0}
                  onClick={() => change(f, left[f] - 1)}
                  data-testid={`shoe-minus-${f}`}
                >
                  <Minus className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  className="btn size-8 min-h-0 p-0"
                  aria-label={`Devolver un ${f} al zapato`}
                  disabled={left[f] >= max}
                  onClick={() => change(f, left[f] + 1)}
                >
                  <Plus className="size-3.5" aria-hidden />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-neg">
          {error}
        </p>
      )}
      <div className="mt-5">
        <h3 className="section-title">Lo que recibe el motor</h3>
        <p className="mt-1 text-xs text-mute">
          10 rangos: J, Q y K cuentan como 10. Incluye la oculta mientras no se revele.
        </p>
        <ol className="mt-2 grid grid-cols-5 gap-1 text-center text-sm sm:grid-cols-10">
          {counts.map((n, i) => (
            <li key={i} className="rounded-lg bg-ink-850 py-1.5">
              <span className="block font-index text-xs text-mute">{RANK_LABELS[i]}</span>
              <span className="font-semibold">{n}</span>
            </li>
          ))}
        </ol>
      </div>
    </Dialog>
  );
}
