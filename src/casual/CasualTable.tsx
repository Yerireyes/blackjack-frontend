import { Play } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useAccountStore } from '@/account/accountStore';
import { PRESETS, type PresetId } from '@/domain/rules';
import { formatChips } from '@/lib/format';
import {
  AccountUnavailable,
  Centered,
  ElsewherePrompt,
  FELT,
  Game,
  LoadFailed,
  NamePrompt,
  RoundProvider,
  SignInPrompt,
} from '@/play/ServerTable';
import type { RoundStore } from '@/play/round';
import { isCurrent, useAnalysisStore } from '@/store/analysisStore';
import { START_CHIPS } from '@/store/chipsStore';
import { useShoeStore } from '@/store/shoeStore';
import { casualWallet, useCasualStore } from './casualStore';

/** Mesa de Casual: el servidor reparte y liquida; aquí solo se dibuja y se mandan intenciones. */
export function CasualTable() {
  const account = useAccountStore((s) => s.status);
  const status = useCasualStore((s) => s.status);
  const elsewhere = useCasualStore((s) => s.elsewhere);
  const enter = useCasualStore((s) => s.enter);

  let body: ReactNode;
  if (account === 'loading' || status === 'loading') body = <Centered>Cargando…</Centered>;
  else if (account === 'unavailable') body = <AccountUnavailable mode="Casual" />;
  else if (account === 'anonymous')
    body = (
      <SignInPrompt title="Casual se juega con cuenta">
        El servidor baraja y reparte, y tu mejor partida de la semana entra en el ranking. Práctica
        sigue disponible sin cuenta.
      </SignInPrompt>
    );
  else if (status === 'unavailable')
    body = <LoadFailed text="No se pudo cargar tu partida." onRetry={() => void enter()} />;
  else if (elsewhere) body = <ElsewherePrompt kind={elsewhere} />;
  else if (status === 'playing') body = <CasualGame />;
  else body = <NewRun />;

  return (
    <section aria-label="Mesa Casual" className={FELT} data-testid="casual-table">
      <RoundProvider store={useCasualStore as unknown as RoundStore}>{body}</RoundProvider>
    </section>
  );
}

/** Sin partida activa: elegir reglas y empezar con 500 fichas. */
function NewRun() {
  const createRun = useCasualStore((s) => s.createRun);
  const busy = useCasualStore((s) => s.busy);
  const ended = useCasualStore((s) => s.ended);
  const needsName = useAccountStore((s) => s.me?.needsDisplayName ?? false);
  const [preset, setPreset] = useState<PresetId>('vegas');

  return (
    <div className="m-auto flex w-full max-w-lg flex-col gap-5 py-4">
      <div className="flex flex-col gap-1.5 text-center">
        <h2 className="text-lg font-semibold">Nueva partida Casual</h2>
        <p className="text-sm text-felt-ink">
          Empiezas con {formatChips(START_CHIPS)} fichas. La partida termina cuando te retiras o te
          quedas sin fichas; tu pico entra en el ranking semanal.
        </p>
        {ended && (
          <p className="text-sm text-text" data-testid="casual-ended">
            Tu última partida terminó {ended.status === 'busted' ? 'sin fichas' : 'al retirarte'}{' '}
            con {formatChips(ended.balance)} · pico {formatChips(ended.peak)} · {ended.hands} manos.
          </p>
        )}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="section-title mb-2 text-felt-ink">Reglas</legend>
        {PRESETS.map((p) => (
          <label
            key={p.id}
            className={`flex cursor-pointer flex-col gap-0.5 rounded-xl border p-3 has-focus-visible:outline-2 has-focus-visible:outline-paper ${
              preset === p.id
                ? 'border-paper bg-felt-950/50'
                : 'border-felt-line/60 bg-felt-950/25 hover:border-felt-line'
            }`}
          >
            <input
              type="radio"
              name="casual-preset"
              value={p.id}
              checked={preset === p.id}
              onChange={() => setPreset(p.id)}
              className="sr-only"
            />
            <span className="text-sm font-semibold">{p.name}</span>
            <span className="text-xs text-felt-ink">{p.summary}</span>
          </label>
        ))}
      </fieldset>

      {needsName ? (
        <NamePrompt />
      ) : (
        <button
          type="button"
          className="btn btn-paper h-11 self-center px-5 text-base"
          onClick={() => void createRun(preset)}
          disabled={busy}
          data-testid="casual-start"
        >
          <Play className="size-4" aria-hidden /> Empezar partida
        </button>
      )}
    </div>
  );
}

/** Partida en curso. La recomendada del motor se marca en su botón (Casual tiene ayudas). */
function CasualGame() {
  const maxBet = useCasualStore((s) => casualWallet(s)?.maxBet ?? 0);
  const slot = useAnalysisStore((s) => s.hand);
  const version = useShoeStore((s) => s.version);
  const current = slot.result && isCurrent(slot, version) ? slot.result : null;
  return (
    <Game
      testId="casual"
      maxBet={maxBet}
      best={current?.best ?? null}
      insuranceEv={current?.insuranceEv ?? null}
    />
  );
}
