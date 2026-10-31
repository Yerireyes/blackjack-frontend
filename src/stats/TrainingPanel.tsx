import { Check, Crosshair, X } from 'lucide-react';
import { useEffect } from 'react';
import { useAccountStore } from '@/account/accountStore';
import { ACTION_LABEL } from '@/features/player-mode/actions';
import { formatPct, formatUnits } from '@/lib/format';
import { useUiStore } from '@/store/uiStore';
import { spotLabel } from './spots';
import { useStatsStore } from './statsStore';
import { useTrainingStore } from './trainingStore';

/** En Práctica: el entrenamiento dirigido con tus puntos débiles (lo de serie, una invitación). */
export function TrainingPanel() {
  const signedIn = useAccountStore((s) => s.status === 'signedIn');
  const active = useTrainingStore((s) => s.active);
  const statsStatus = useStatsStore((s) => s.statsStatus);
  const loadStats = useStatsStore((s) => s.loadStats);
  useEffect(() => {
    if (signedIn && statsStatus === 'idle') void loadStats();
  }, [signedIn, statsStatus, loadStats]);
  if (!signedIn) return null;
  return active ? <Drilling /> : <Offer />;
}

function Offer() {
  const spots = useStatsStore((s) => s.stats?.decisions.weakSpots ?? null);
  const start = useTrainingStore((s) => s.start);
  const setScreen = useUiStore((s) => s.setScreen);
  if (!spots) return null;
  return (
    <section
      aria-labelledby="training-offer"
      className="flex flex-col gap-2 rounded-xl border border-ink-800 p-3.5"
    >
      <h2 id="training-offer" className="flex items-center gap-1.5 text-sm font-semibold">
        <Crosshair className="size-4 text-mute" aria-hidden /> Entrenamiento dirigido
      </h2>
      {spots.length === 0 ? (
        <p className="text-sm text-mute">
          Juega unas manos de Ranked o el reto diario: con tus errores se arma un entrenamiento a tu
          medida.
        </p>
      ) : (
        <>
          <p className="text-sm text-mute">
            {spots.length === 1
              ? 'Una situación te costó'
              : `${spots.length} situaciones te costaron`}{' '}
            EV en Ranked y el reto, como {spotLabel(spots[0]!.spot).toLowerCase()}. Repártelas aquí
            hasta dominarlas.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-paper"
              onClick={() => start(spots)}
              data-testid="training-start"
            >
              Practicar mis puntos débiles
            </button>
            <button type="button" className="btn" onClick={() => setScreen('stats')}>
              Ver mis estadísticas
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function Drilling() {
  const current = useTrainingStore((s) => s.current);
  const last = useTrainingStore((s) => s.last);
  const decisions = useTrainingStore((s) => s.decisions);
  const optimal = useTrainingStore((s) => s.optimal);
  const stop = useTrainingStore((s) => s.stop);
  return (
    <section
      aria-labelledby="training-title"
      className="flex flex-col gap-3 rounded-xl border border-paper/40 bg-ink-950/60 p-3.5"
      data-testid="training"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="training-title" className="flex items-center gap-1.5 text-sm font-semibold">
          <Crosshair className="size-4" aria-hidden /> Entrenamiento dirigido
        </h2>
        <button type="button" className="btn h-8 min-h-0 px-2.5 text-xs" onClick={stop}>
          Terminar
        </button>
      </div>
      <p className="text-sm">
        {current ? (
          <>
            Situación: <strong className="font-semibold">{spotLabel(current)}</strong>
          </>
        ) : (
          'Reparte: cada mano cae en uno de tus puntos débiles.'
        )}
      </p>
      {last && (
        <p
          className={`flex items-start gap-2 text-sm ${last.chosen === last.best ? 'text-pos' : 'text-text'}`}
          aria-live="polite"
          data-testid="training-verdict"
        >
          {last.chosen === last.best ? (
            <>
              <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
              {ACTION_LABEL[last.chosen]}: la óptima en {spotLabel(last.spot).toLowerCase()}.
            </>
          ) : (
            <>
              <X className="mt-0.5 size-4 shrink-0 text-neg" aria-hidden />
              <span>
                En {spotLabel(last.spot).toLowerCase()} lo óptimo era{' '}
                <strong>{ACTION_LABEL[last.best]}</strong>, no{' '}
                {ACTION_LABEL[last.chosen].toLowerCase()} ({formatUnits(-last.lost)} de EV).
              </span>
            </>
          )}
        </p>
      )}
      {decisions > 0 && (
        <p className="text-xs text-faint" data-testid="training-tally">
          {optimal} de {decisions} óptimas ({formatPct(optimal / decisions)}) en este entrenamiento.
        </p>
      )}
    </section>
  );
}
