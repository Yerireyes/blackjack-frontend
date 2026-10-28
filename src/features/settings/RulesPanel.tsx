import { SlidersHorizontal, TriangleAlert } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Dialog } from '@/components/Dialog';
import { DECK_OPTIONS, PRESETS, presetRules, type PresetId, type Rules } from '@/domain/rules';
import { applyRules, hasCardsInPlay } from '@/store/actions';
import { useRulesStore } from '@/store/rulesStore';
import { rulesSummary } from './rulesSummary';

/** Reglas y presets. Aplicar reinicia el zapato, por eso se confirma aquí mismo. */
export function RulesPanel() {
  const rules = useRulesStore((s) => s.rules);
  const preset = useRulesStore((s) => s.preset);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Rules>(rules);
  const [draftPreset, setDraftPreset] = useState<PresetId | 'custom'>(preset);

  const openPanel = () => {
    setDraft(rules);
    setDraftPreset(preset);
    setOpen(true);
  };
  const set = <K extends keyof Rules>(k: K, v: Rules[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setDraftPreset('custom');
  };
  const changed = JSON.stringify(draft) !== JSON.stringify(rules);
  const presetName = PRESETS.find((p) => p.id === preset)?.name ?? 'Personalizadas';

  return (
    <>
      <button
        type="button"
        className="btn h-9 min-h-0 max-w-full min-w-0 gap-2 px-3"
        onClick={openPanel}
        data-testid="rules-button"
        aria-label={`Reglas: ${presetName}, ${rulesSummary(rules)}. Cambiar reglas`}
      >
        <SlidersHorizontal className="size-4 shrink-0 text-mute" aria-hidden />
        <span className="hidden min-w-0 truncate text-[13px] sm:block">
          <span className="font-semibold">{presetName}</span>
          <span className="hidden text-mute xl:inline"> · {rulesSummary(rules)}</span>
        </span>
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Reglas de la mesa"
        description="El motor calcula con estas reglas exactas."
        wide
        footer={
          <>
            {changed && hasCardsInPlay() && (
              <p className="mr-auto flex items-center gap-1.5 text-xs text-warn">
                <TriangleAlert className="size-3.5" aria-hidden /> Aplicar reinicia el zapato y
                limpia la mesa.
              </p>
            )}
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-paper"
              disabled={!changed}
              data-testid="rules-apply"
              onClick={() => {
                applyRules(draft, draftPreset);
                setOpen(false);
              }}
            >
              Aplicar y reiniciar el zapato
            </button>
          </>
        }
      >
        <fieldset>
          <legend className="section-title mb-2">Preset</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {PRESETS.map((p) => {
              const on = draftPreset === p.id;
              return (
                <label
                  key={p.id}
                  className={`cursor-pointer rounded-xl border p-3 transition-colors duration-150 has-focus-visible:outline-2 has-focus-visible:outline-paper ${
                    on
                      ? 'border-paper bg-paper text-paper-ink'
                      : 'border-ink-700 bg-ink-950 hover:border-ink-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="preset"
                    className="sr-only"
                    checked={on}
                    onChange={() => {
                      setDraft(presetRules(p.id));
                      setDraftPreset(p.id);
                    }}
                  />
                  <span className="block font-semibold">{p.name}</span>
                  <span className={`mt-0.5 block text-xs ${on ? 'text-paper-mute' : 'text-mute'}`}>
                    {p.summary}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-6 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <Field label="Mazos">
            <select
              className="select"
              value={draft.decks}
              data-testid="rule-decks"
              onChange={(e) => set('decks', Number(e.target.value))}
            >
              {DECK_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Blackjack paga">
            <select
              className="select"
              value={draft.blackjackPays}
              onChange={(e) => set('blackjackPays', Number(e.target.value))}
            >
              <option value={1.5}>3:2</option>
              <option value={1.2}>6:5</option>
            </select>
          </Field>
          <Field label="Dealer con 17 suave">
            <select
              className="select"
              value={draft.dealerHitsSoft17 ? 'h17' : 's17'}
              onChange={(e) => set('dealerHitsSoft17', e.target.value === 'h17')}
            >
              <option value="s17">Se planta (S17)</option>
              <option value="h17">Pide (H17)</option>
            </select>
          </Field>
          <Field label="Doblar con">
            <select
              className="select"
              value={draft.doubleOn}
              onChange={(e) => set('doubleOn', e.target.value as Rules['doubleOn'])}
            >
              <option value="any">Cualquier par de cartas</option>
              <option value="nineToEleven">Solo 9, 10 u 11</option>
              <option value="tenToEleven">Solo 10 u 11</option>
            </select>
          </Field>
          <Field label="Máximo de manos al dividir">
            <select
              className="select"
              value={draft.maxSplitHands}
              onChange={(e) => set('maxSplitHands', Number(e.target.value))}
            >
              <option value={2}>2 (sin re-dividir)</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </Field>
          <Field label="Rendición">
            <select
              className="select"
              value={draft.surrender}
              disabled={!draft.dealerPeeks}
              onChange={(e) => set('surrender', e.target.value as Rules['surrender'])}
            >
              <option value="none">No permitida</option>
              <option value="late">Tardía</option>
            </select>
          </Field>
          <Toggle
            label="Doblar después de dividir (DAS)"
            checked={draft.doubleAfterSplit}
            onChange={(v) => set('doubleAfterSplit', v)}
          />
          <Toggle
            label="Re-dividir ases"
            checked={draft.resplitAces}
            onChange={(v) => set('resplitAces', v)}
          />
          <Toggle
            label="Pedir tras dividir ases"
            checked={draft.hitSplitAces}
            onChange={(v) => set('hitSplitAces', v)}
          />
          <Toggle
            label="El dealer revisa su oculta (peek)"
            hint="Apagado = regla europea: sin peek y sin rendición."
            checked={draft.dealerPeeks}
            onChange={(v) => {
              set('dealerPeeks', v);
              if (!v) setDraft((d) => ({ ...d, dealerPeeks: false, surrender: 'none' }));
            }}
          />
          <Field label={`Penetración: se rebaraja al ${Math.round(draft.penetration * 100)} %`}>
            <input
              type="range"
              min={0.5}
              max={0.9}
              step={0.05}
              value={draft.penetration}
              onChange={(e) => set('penetration', Number(e.target.value))}
              className="w-full accent-paper"
            />
          </Field>
        </div>
      </Dialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-mute">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange(v: boolean): void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 text-sm">
      <span>
        {label}
        {hint && <span className="block text-xs text-faint">{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-ink-700 transition-colors duration-150 peer-checked:bg-paper peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-paper after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-text after:transition-transform after:duration-150 peer-checked:after:translate-x-4 peer-checked:after:bg-paper-ink"
      />
    </label>
  );
}
