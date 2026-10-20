import { Undo2, Eraser } from 'lucide-react';
import { useEffect } from 'react';
import { FACES, type Face } from '@/domain/cards';
import { countByFace } from '@/domain/shoe';
import { clearRound } from '@/store/actions';
import { useShoeStore } from '@/store/shoeStore';
import { useTableStore, type Target } from '@/store/tableStore';
import { useUiStore } from '@/store/uiStore';
import { create } from 'zustand';
import { isTypingTarget } from '@/lib/keys';

type TargetKey = 'player' | 'dealer' | 'discard' | `other-${number}`;

const usePickerTarget = create<{ target: TargetKey; set(t: TargetKey): void }>()((set) => ({
  target: 'player',
  set: (target) => set({ target }),
}));

const toTarget = (k: TargetKey): Target =>
  k.startsWith('other-') ? { kind: 'other', seat: Number(k.slice(6)) } : ({ kind: k } as Target);

/** Teclas rápidas del selector: A, 2–9, 0 o T = 10, J, Q, K. */
const KEY_FACE: Record<string, Face> = {
  a: 'A',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '0': '10',
  t: '10',
  j: 'J',
  q: 'Q',
  k: 'K',
};

/**
 * Selector de 13 rangos del modo manual: tocas la carta que viste y eliges a
 * quién va. Cada carta se descuenta del zapato al instante.
 */
export function CardPicker() {
  const { target, set } = usePickerTarget();
  const others = useTableStore((s) => s.others);
  const dealer = useTableStore((s) => s.dealer);
  const history = useTableStore((s) => s.history);
  const assign = useTableStore((s) => s.assignCard);
  const undo = useTableStore((s) => s.undoLast);
  const remaining = useShoeStore((s) => s.remaining);
  const mode = useUiStore((s) => s.mode);
  const left = countByFace(remaining);

  const add = (face: Face) => {
    const ok = assign(face, toTarget(target));
    // Tras la carta visible del dealer, lo normal es volver a la mano del jugador.
    if (ok && target === 'dealer' && !dealer.up && mode === 'player') set('player');
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      const face = KEY_FACE[e.key.toLowerCase()];
      if (face) {
        e.preventDefault();
        document.querySelector<HTMLButtonElement>(`[data-face="${face}"]`)?.click();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo]);

  const dealerNext = !dealer.up ? 'visible' : !dealer.hole ? 'oculta' : 'pide';
  const targets: { key: TargetKey; label: string }[] = [
    { key: 'player', label: 'Tu mano' },
    { key: 'dealer', label: `Dealer · ${dealerNext}` },
    ...others.map((o, i) => ({ key: `other-${i}` as TargetKey, label: o.name })),
    ...(others.length < 6
      ? [{ key: `other-${others.length}` as TargetKey, label: '+ Otra mano' }]
      : []),
    { key: 'discard', label: 'Descartada' },
  ];

  return (
    <div
      id="card-picker"
      tabIndex={-1}
      className="flex w-full max-w-2xl flex-col gap-3 rounded-2xl border border-ink-800 bg-ink-900/95 p-3 shadow-[0_12px_32px_rgb(0_0_0/0.35)] outline-none sm:p-4"
      aria-label="Selector de cartas"
    >
      <div
        className="flex flex-wrap items-center gap-1.5"
        role="radiogroup"
        aria-label="La carta va a"
      >
        <span className="mr-1 text-xs text-mute">Va a</span>
        {targets.map((t) => (
          <button
            key={t.key}
            type="button"
            role="radio"
            aria-checked={target === t.key}
            onClick={() => set(t.key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150 ${
              target === t.key
                ? 'border-paper bg-paper text-paper-ink'
                : 'border-ink-700 text-mute hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-13">
        {FACES.map((f) => {
          const n = left[f];
          return (
            <button
              key={f}
              type="button"
              data-face={f}
              onClick={() => add(f)}
              disabled={n === 0}
              aria-label={`${f}, quedan ${n}`}
              className="group flex aspect-[5/6] flex-col items-center justify-center rounded-lg bg-paper text-paper-ink shadow-[0_1px_0_var(--color-paper-edge)] transition-transform duration-100 active:scale-[0.95] disabled:bg-ink-800 disabled:text-faint disabled:shadow-none"
            >
              <span className="font-index text-lg leading-none font-semibold sm:text-xl">{f}</span>
              <span className="mt-0.5 text-[10px] text-paper-mute group-disabled:text-faint">
                {n}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="hidden text-xs text-faint sm:block">
          Teclado: A, 2–9, 0 = 10, J, Q, K · Retroceso deshace
        </p>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            className="btn h-9 min-h-0"
            onClick={undo}
            disabled={history.length === 0}
          >
            <Undo2 className="size-4" aria-hidden /> Deshacer
          </button>
          <button
            type="button"
            className="btn h-9 min-h-0"
            onClick={() => {
              clearRound();
              set('player');
            }}
          >
            <Eraser className="size-4" aria-hidden /> Nueva ronda
          </button>
        </div>
      </div>
    </div>
  );
}
