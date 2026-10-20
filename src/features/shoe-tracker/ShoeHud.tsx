import { Layers, Shuffle } from 'lucide-react';
import { useState } from 'react';
import { reshuffle, hasCardsInPlay } from '@/store/actions';
import { useRulesStore } from '@/store/rulesStore';
import { useShoeStore } from '@/store/shoeStore';
import { ShoeEditor } from './ShoeEditor';

const dec = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Cartas y mazos restantes, penetración (la carta de corte en rojo) y rebarajar. */
export function ShoeHud() {
  const decks = useShoeStore((s) => s.decks);
  const remaining = useShoeStore((s) => s.remaining.length);
  const hidden = useShoeStore((s) => s.hidden.length);
  const penetration = useRulesStore((s) => s.rules.penetration);
  const [open, setOpen] = useState(false);
  const total = decks * 52;
  const unseen = remaining + hidden;
  const dealt = (total - remaining) / total;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn h-9 min-h-0 gap-3 px-3"
        aria-label={`Zapato: quedan ${unseen} cartas, ${dec.format(unseen / 52)} mazos. Abrir el editor del zapato`}
        data-testid="shoe-hud"
      >
        <Layers className="size-4 text-mute" aria-hidden />
        <span className="hidden text-[13px] md:inline">
          <span className="font-semibold">{unseen}</span>
          <span className="text-mute"> cartas · {dec.format(unseen / 52)} mazos</span>
        </span>
        <span className="text-[13px] font-semibold md:hidden">{unseen}</span>
        <span className="relative hidden h-2 w-28 rounded-full bg-ink-800 sm:block" aria-hidden>
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-mute/70"
            style={{ width: `${Math.min(1, dealt) * 100}%` }}
          />
          <span
            className="absolute -top-1 h-4 w-[3px] rounded-sm bg-cut"
            style={{ left: `calc(${penetration * 100}% - 1.5px)` }}
            title="Carta de corte"
          />
        </span>
      </button>
      <button
        type="button"
        className="btn size-9 min-h-0 p-0"
        aria-label="Rebarajar: zapato nuevo"
        title="Rebarajar"
        onClick={() => {
          if (
            !hasCardsInPlay() ||
            window.confirm('¿Rebarajar? Se limpia la mesa y el zapato vuelve completo.')
          ) {
            reshuffle();
          }
        }}
      >
        <Shuffle className="size-4" aria-hidden />
      </button>
      <ShoeEditor open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
