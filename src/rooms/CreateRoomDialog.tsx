import { useState, type FormEvent } from 'react';
import { useAccountStore } from '@/account/accountStore';
import { FormError, TextField } from '@/account/fields';
import { Dialog } from '@/components/Dialog';
import { Segmented } from '@/components/Segmented';
import { PRESETS, type PresetId } from '@/domain/rules';
import type { CreateRoomRequest, RoomVisibility } from '@/engine/contract';
import { rulesSummary } from '@/features/settings/rulesSummary';
import { useRulesStore } from '@/store/rulesStore';
import { useRoomsStore } from './roomsStore';

type RulesPick = PresetId | 'practice';
type SeatsPick = '5' | '6' | '7';

/** Crear sala: nombre, pública o privada, asientos, reglas y ayudas. */
export function CreateRoomDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const name0 = useAccountStore((s) => (s.me ? `Mesa de ${s.me.displayName}` : ''));
  const practiceRules = useRulesStore((s) => s.rules);
  const create = useRoomsStore((s) => s.create);
  const busy = useRoomsStore((s) => s.creating);
  const [name, setName] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<RoomVisibility>('public');
  const [seats, setSeats] = useState<SeatsPick>('7');
  const [rules, setRules] = useState<RulesPick>('vegas');
  const [aids, setAids] = useState(true);
  const [tournament, setTournament] = useState(false);
  const [hands, setHands] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const value = (name ?? name0).slice(0, 30);
  const nameError =
    value.trim().length > 0 && value.trim().length < 3 ? 'Mínimo 3 caracteres.' : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (value.trim().length < 3) {
      setError('El nombre de la sala necesita entre 3 y 30 caracteres.');
      return;
    }
    const req: CreateRoomRequest = {
      name: value.trim(),
      visibility,
      seats: Number(seats),
      aids,
      ...(tournament ? { tournament: { hands } } : {}),
      ...(rules === 'practice' ? { rules: practiceRules } : { preset: rules }),
    };
    setError(null);
    const failed = await create(req);
    if (failed) setError(failed);
    else onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Crear sala"
      description="Eres el anfitrión: puedes sacar a quien moleste. La sala cierra a los 2 minutos sin nadie."
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            form="create-room"
            className="btn btn-paper"
            disabled={busy}
            data-testid="room-create-submit"
          >
            {busy ? 'Creando…' : 'Crear y entrar'}
          </button>
        </>
      }
    >
      <form id="create-room" className="flex flex-col gap-5" onSubmit={(e) => void submit(e)}>
        <TextField
          label="Nombre de la sala"
          value={value}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          error={nameError}
          hint="De 3 a 30 caracteres. Lo ve quien entra."
          data-testid="room-name"
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Quién la ve</span>
            <Segmented<RoomVisibility>
              label="Visibilidad"
              value={visibility}
              options={[
                { value: 'public', label: 'Pública' },
                { value: 'private', label: 'Privada' },
              ]}
              onChange={setVisibility}
            />
            <span className="text-xs text-faint">
              {visibility === 'public'
                ? 'Aparece en la lista de salas.'
                : 'Solo entra quien tenga el código o el enlace.'}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Asientos</span>
            <Segmented<SeatsPick>
              label="Asientos"
              value={seats}
              options={[
                { value: '5', label: '5' },
                { value: '6', label: '6' },
                { value: '7', label: '7' },
              ]}
              onChange={setSeats}
            />
            <span className="text-xs text-faint">Y hasta 10 espectadores.</span>
          </div>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Reglas</legend>
          {[
            ...PRESETS.map((p) => ({ id: p.id as RulesPick, name: p.name, summary: p.summary })),
            {
              id: 'practice' as RulesPick,
              name: 'Las de tu Práctica',
              summary: rulesSummary(practiceRules),
            },
          ].map((o) => (
            <label
              key={o.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-2.5 has-focus-visible:outline-2 has-focus-visible:outline-paper ${
                rules === o.id ? 'border-paper bg-ink-850' : 'border-ink-700 hover:border-ink-600'
              }`}
            >
              <input
                type="radio"
                name="room-rules"
                className="mt-1 accent-(--color-paper)"
                checked={rules === o.id}
                onChange={() => setRules(o.id)}
              />
              <span className="flex flex-col">
                <span className="text-sm font-medium">{o.name}</span>
                <span className="text-xs text-mute">{o.summary}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-700 px-3.5 py-3 has-focus-visible:outline-2 has-focus-visible:outline-paper">
          <input
            type="checkbox"
            className="mt-1 accent-(--color-paper)"
            checked={aids}
            onChange={(e) => setAids(e.target.checked)}
            data-testid="room-aids"
          />
          <span className="flex flex-col">
            <span className="text-sm font-medium">Ayudas del motor para todos</span>
            <span className="text-xs text-mute">
              EV de cada acción y la jugada recomendada en tu turno. Sin ayudas, la mesa se juega
              como Ranked.
            </span>
          </span>
        </label>

        <div className="flex flex-col gap-3 rounded-xl border border-ink-700 px-3.5 py-3">
          <label className="flex cursor-pointer items-start gap-3 has-focus-visible:outline-2 has-focus-visible:outline-paper">
            <input
              type="checkbox"
              className="mt-1 accent-(--color-paper)"
              checked={tournament}
              onChange={(e) => setTournament(e.target.checked)}
              data-testid="room-tournament"
            />
            <span className="flex flex-col">
              <span className="text-sm font-medium">Torneo</span>
              <span className="text-xs text-mute">
                Todos empiezan con 500 fichas de torneo, sin recompras. Lo inicias tú cuando haya 2
                o más sentados; gana la pila más alta al terminar las manos.
              </span>
            </span>
          </label>
          {tournament && (
            <label className="flex items-center gap-3 pl-7 text-sm">
              Manos
              <select
                className="select"
                value={hands}
                onChange={(e) => setHands(Number(e.target.value))}
                data-testid="room-tournament-hands"
              >
                {[5, 10, 15, 20, 25, 30].map((n) => (
                  <option key={n} value={n} className="bg-ink-900">
                    {n}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <FormError text={error} />
      </form>
    </Dialog>
  );
}
