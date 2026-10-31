import { Flag } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { create } from 'zustand';
import { useAccountStore } from '@/account/accountStore';
import { errorText } from '@/account/errors';
import { FormError } from '@/account/fields';
import { ApiRequestError } from '@/api/http';
import { Dialog } from '@/components/Dialog';
import { useTableStore } from '@/store/tableStore';
import { moderationApi, type ReportReason } from './api';

/** A quién se está reportando (por nombre visible): un solo diálogo para toda la app. */
const useReportStore = create<{ target: string | null; open(name: string | null): void }>()(
  (set) => ({ target: null, open: (target) => set({ target }) }),
);

const REASONS: { id: ReportReason; label: string; hint: string }[] = [
  { id: 'name', label: 'Nombre ofensivo', hint: 'Su nombre insulta o no es apropiado.' },
  { id: 'behavior', label: 'Comportamiento', hint: 'Molesta a otros en las salas.' },
  { id: 'cheating', label: 'Trampas', hint: 'Crees que hace trampa.' },
  { id: 'other', label: 'Otro motivo', hint: 'Cuéntalo en el detalle.' },
];
const MAX_DETAILS = 300;

/** Bandera junto a un nombre (rankings, amigos, salas). No aparece para uno mismo ni sin sesión. */
export function ReportButton({ name }: { name: string }) {
  const mine = useAccountStore((s) => s.me?.displayName === name);
  const signedIn = useAccountStore((s) => s.status === 'signedIn');
  const open = useReportStore((s) => s.open);
  if (!signedIn || mine) return null;
  return (
    <button
      type="button"
      className="grid size-7 shrink-0 place-items-center rounded-md text-faint transition-colors hover:bg-ink-850 hover:text-text"
      onClick={() => open(name)}
      aria-label={`Reportar a ${name}`}
      title="Reportar"
    >
      <Flag className="size-3.5" aria-hidden />
    </button>
  );
}

export function ReportDialog() {
  const target = useReportStore((s) => s.target);
  const open = useReportStore((s) => s.open);
  return (
    <Dialog
      open={target !== null}
      onClose={() => open(null)}
      title={target ? `Reportar a ${target}` : 'Reportar'}
      description="Un administrador lo revisa. Quien reportas no sabe que fuiste tú."
    >
      {target && <ReportForm key={target} target={target} onDone={() => open(null)} />}
    </Dialog>
  );
}

function ReportForm({ target, onDone }: { target: string; onDone(): void }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!reason) {
      setError('Elige un motivo.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await moderationApi.report({
        displayName: target,
        reason,
        ...(details.trim() ? { details: details.trim() } : {}),
      });
      useTableStore.getState().notify('Gracias: un administrador va a revisar el reporte.');
      onDone();
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) {
        useAccountStore.getState().sessionLost();
        onDone();
        return;
      }
      setError(
        err instanceof ApiRequestError && err.code === 'report_exists'
          ? 'Ya lo reportaste; un administrador lo va a revisar.'
          : err instanceof ApiRequestError && err.code === 'user_not_found'
            ? 'Esa persona ya no existe o cambió de nombre.'
            : errorText(err),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Motivo</legend>
        {REASONS.map((r) => (
          <label
            key={r.id}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-2.5 has-focus-visible:outline-2 has-focus-visible:outline-paper ${
              reason === r.id ? 'border-paper bg-ink-850' : 'border-ink-700 hover:border-ink-600'
            }`}
          >
            <input
              type="radio"
              name="report-reason"
              className="mt-1 accent-(--color-paper)"
              checked={reason === r.id}
              onChange={() => setReason(r.id)}
            />
            <span className="flex flex-col">
              <span className="text-sm font-medium">{r.label}</span>
              <span className="text-xs text-mute">{r.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Detalle (opcional)
        <textarea
          className="input h-24 resize-none py-2 text-sm"
          value={details}
          onChange={(e) => setDetails(e.target.value.slice(0, MAX_DETAILS))}
          maxLength={MAX_DETAILS}
        />
        <span className="text-xs font-normal text-faint">
          {details.length} de {MAX_DETAILS} caracteres.
        </span>
      </label>
      <FormError text={error} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={onDone}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-paper" disabled={busy} data-testid="report-submit">
          {busy ? 'Enviando…' : 'Enviar reporte'}
        </button>
      </div>
    </form>
  );
}
