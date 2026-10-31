import { Check, CloudOff, Flame, Lock, LogIn } from 'lucide-react';
import { type ReactNode } from 'react';
import { useAccountStore } from '@/account/accountStore';
import { PageScreen } from '@/app/PageScreen';
import { PlayingCard } from '@/components/PlayingCard';
import type { AchievementId, CosmeticId, CosmeticSlot, EquippedCosmetics } from '@/engine/contract';
import {
  ACHIEVEMENT_IDS,
  ACHIEVEMENTS,
  COSMETICS,
  DEFAULT_EQUIPPED,
  isKnownAchievement,
  isKnownCosmetic,
  SLOTS,
  themeKey,
  titleName,
} from './catalog';
import { equippedOf, useProgressStore } from './progressStore';

const dateFmt = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** Logros (del servidor) y la apariencia de la mesa: paño, dorso, fichas y título. */
export function ProgressScreen() {
  return (
    <PageScreen title="Logros">
      <Summary />
      <AchievementList />
      <TableLook />
    </PageScreen>
  );
}

/** Cuántos logros, la racha y, sin sesión o sin servidor, qué hacer. */
function Summary() {
  const account = useAccountStore((s) => s.status);
  const status = useProgressStore((s) => s.status);
  const achievements = useProgressStore((s) => s.achievements);
  const load = useProgressStore((s) => s.load);
  const init = useAccountStore((s) => s.init);
  const openDialog = useAccountStore((s) => s.openDialog);
  const total = ACHIEVEMENT_IDS.length;
  const got = achievements?.unlocked.filter((u) => isKnownAchievement(u.id)).length ?? 0;

  if (account === 'anonymous') {
    return (
      <Callout
        action={
          <button type="button" className="btn btn-paper h-11" onClick={() => openDialog('auth')}>
            <LogIn className="size-4" aria-hidden /> Entrar o crear cuenta
          </button>
        }
      >
        <strong className="font-semibold text-text">Los logros se ganan con cuenta.</strong> Juega
        Casual, Ranked o el reto diario: cada logro desbloquea algo para tu mesa (un paño, un dorso,
        fichas o un título). Solo cambian cómo se ve: nunca dan ventaja.
      </Callout>
    );
  }
  if (account === 'unavailable' || status === 'unavailable') {
    return (
      <Callout
        icon={<CloudOff className="size-5 shrink-0 text-mute" aria-hidden />}
        action={
          <button
            type="button"
            className="btn"
            onClick={() => void (account === 'unavailable' ? init() : load())}
          >
            Reintentar
          </button>
        }
      >
        El servidor no responde ahora: no se pueden cargar tus logros. Tu mesa se ve con lo de
        serie.
      </Callout>
    );
  }

  return (
    <section aria-label="Resumen" className="grid gap-3 sm:grid-cols-3">
      <SummaryStat label="Logros" testId="progress-count">
        {achievements ? (
          <>
            {got} <span className="text-base font-normal text-mute">de {total}</span>
          </>
        ) : (
          '—'
        )}
        <span
          className="mt-2 block h-1.5 rounded-full bg-ink-800"
          role="progressbar"
          aria-label="Logros desbloqueados"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={got}
        >
          <span
            className="block h-full rounded-full bg-warn"
            style={{ width: `${(got / total) * 100}%` }}
          />
        </span>
      </SummaryStat>
      <SummaryStat
        label="Racha de decisiones óptimas"
        hint="Ranked y el reto diario"
        testId="progress-streak"
      >
        <span className="inline-flex items-center gap-1.5">
          <Flame
            className={`size-5 ${achievements && achievements.optimalStreak > 0 ? 'text-warn' : 'text-faint'}`}
            aria-hidden
          />
          {achievements?.optimalStreak ?? '—'}
        </span>
      </SummaryStat>
      <SummaryStat label="Mejor racha" hint="Cabeza fría a las 10, De libro a las 50">
        {achievements?.bestOptimalStreak ?? '—'}
      </SummaryStat>
    </section>
  );
}

function SummaryStat({
  label,
  hint,
  testId,
  children,
}: {
  label: string;
  hint?: string;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-1 rounded-2xl border border-ink-800 bg-ink-950/60 p-4"
      data-testid={testId}
    >
      <span className="text-xs text-faint">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{children}</span>
      {hint && <span className="text-xs text-faint">{hint}</span>}
    </div>
  );
}

function Callout({
  icon,
  action,
  children,
}: {
  icon?: ReactNode;
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-ink-700 bg-ink-950/60 p-5 sm:flex-row sm:items-center">
      {icon}
      <p className="flex-1 text-sm text-mute">{children}</p>
      {action}
    </div>
  );
}

/** El catálogo completo: los conseguidos con su fecha y su recompensa; el resto, bloqueados. */
function AchievementList() {
  const unlocked = useProgressStore((s) => s.achievements?.unlocked ?? null);
  const catalog = useProgressStore((s) => s.catalog);
  const when = new Map(unlocked?.map((u) => [u.id, u.unlockedAt]));
  const rewardOf = (id: AchievementId) =>
    catalog?.find((c) => c.unlockedBy === id && isKnownCosmetic(c.id)) ?? null;

  return (
    <section aria-labelledby="achievements-title" className="flex flex-col gap-4">
      <h2 id="achievements-title" className="section-title">
        Logros
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="achievements">
        {ACHIEVEMENT_IDS.map((id) => {
          const info = ACHIEVEMENTS[id];
          const Icon = info.icon;
          const at = when.get(id);
          const reward = rewardOf(id);
          return (
            <li
              key={id}
              className={`flex gap-3 rounded-2xl border p-4 ${at ? 'border-warn/35 bg-ink-950/70' : 'border-ink-800 bg-ink-950/30'}`}
              data-unlocked={at ? 'true' : 'false'}
            >
              <span
                aria-hidden
                className={`grid size-11 shrink-0 place-items-center rounded-full border ${at ? 'border-warn/50 bg-warn/10 text-warn' : 'border-ink-700 text-faint'}`}
              >
                {at ? <Icon className="size-5" /> : <Lock className="size-4" />}
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <p className={`font-semibold ${at ? '' : 'text-mute'}`}>{info.name}</p>
                <p className="text-sm text-mute">{info.description}</p>
                <p className="text-xs text-faint">
                  {at ? `Conseguido el ${dateFmt.format(new Date(at))}` : 'Bloqueado'}
                  {reward && (
                    <>
                      {' · '}
                      {at ? 'Desbloqueó' : 'Desbloquea'} {slotName(reward.slot).toLowerCase()} «
                      {COSMETICS[reward.id].name}»
                    </>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const slotName = (slot: CosmeticSlot) => SLOTS.find((s) => s.slot === slot)?.name ?? slot;

/** Paño, dorso, fichas y título: los que tiene se eligen; los demás dicen qué logro piden. */
function TableLook() {
  const account = useAccountStore((s) => s.status);
  const cosmetics = useProgressStore((s) => s.cosmetics);
  const equipped = useProgressStore(equippedOf);
  const catalog = useProgressStore((s) => s.catalog);
  const saving = useProgressStore((s) => s.saving);
  const equip = useProgressStore((s) => s.equip);
  const canChoose = account === 'signedIn' && cosmetics !== null;
  const owned = new Set<CosmeticId>(
    cosmetics?.owned ?? [DEFAULT_EQUIPPED.felt, DEFAULT_EQUIPPED.cardBack, DEFAULT_EQUIPPED.chips],
  );

  // El orden y los logros salen del catálogo del servidor; sin él, el orden local y sin pista.
  const inSlot = (slot: CosmeticSlot) =>
    catalog
      ? catalog.filter((c) => c.slot === slot && isKnownCosmetic(c.id))
      : (Object.keys(COSMETICS) as CosmeticId[])
          .filter((id) => COSMETICS[id].slot === slot)
          .map((id) => ({ id, slot, unlockedBy: undefined }));

  return (
    <section aria-labelledby="look-title" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 id="look-title" className="section-title">
          Tu mesa
        </h2>
        <p className="text-sm text-mute">
          Se ve igual en todos los modos, también en Práctica, y en cualquier dispositivo con tu
          cuenta. Solo apariencia: nunca da ventaja.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
        <Preview equipped={equipped} />
        <div className="flex flex-col gap-6">
          {SLOTS.map(({ slot, name }) => (
            <fieldset key={slot} className="flex flex-col gap-2.5" data-testid={`slot-${slot}`}>
              <legend className="mb-2.5 text-sm font-semibold">{name}</legend>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {slot === 'title' && (
                  <Option
                    slot={slot}
                    id={null}
                    name="Sin título"
                    checked={equipped.title === null}
                    disabled={!canChoose || saving}
                    onChoose={() => void equip('title', null)}
                  />
                )}
                {inSlot(slot).map((c) => {
                  const has = owned.has(c.id);
                  const lockedBy =
                    !has && c.unlockedBy && isKnownAchievement(c.unlockedBy)
                      ? ACHIEVEMENTS[c.unlockedBy]
                      : null;
                  return (
                    <Option
                      key={c.id}
                      slot={slot}
                      id={c.id}
                      name={COSMETICS[c.id].name}
                      checked={equipped[slot] === c.id}
                      disabled={!canChoose || saving || !has}
                      locked={!has}
                      hint={
                        lockedBy
                          ? `${lockedBy.description.replace(/\.$/, '')} para desbloquearlo.`
                          : undefined
                      }
                      onChoose={() => void equip(slot, c.id)}
                    />
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      </div>
    </section>
  );
}

function Option({
  slot,
  id,
  name,
  checked,
  disabled,
  locked = false,
  hint,
  onChoose,
}: {
  slot: CosmeticSlot;
  id: CosmeticId | null;
  name: string;
  checked: boolean;
  disabled: boolean;
  locked?: boolean;
  hint?: string;
  onChoose(): void;
}) {
  return (
    <label
      className={`group relative flex flex-col gap-2 rounded-xl border p-2.5 text-left transition-colors duration-150 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-paper ${
        checked
          ? 'border-paper bg-ink-850'
          : locked
            ? 'border-ink-800 bg-ink-950/30'
            : 'border-ink-700 bg-ink-950/60 has-enabled:cursor-pointer has-enabled:hover:border-ink-600'
      }`}
      data-testid={`cosmetic-${id ?? 'none'}`}
    >
      <input
        type="radio"
        name={`cosmetic-${slot}`}
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={onChoose}
        aria-describedby={hint ? `${slot}-${id}-hint` : undefined}
      />
      <span className={locked ? 'opacity-70' : ''}>
        <Swatch slot={slot} id={id} />
      </span>
      <span className="flex items-center justify-between gap-1.5 text-sm font-medium">
        <span className="truncate">{name}</span>
        {checked ? (
          <Check className="size-4 shrink-0 text-pos" aria-label="Puesto" />
        ) : (
          locked && <Lock className="size-3.5 shrink-0 text-faint" aria-label="Bloqueado" />
        )}
      </span>
      {hint && (
        <span id={`${slot}-${id}-hint`} className="text-xs leading-snug text-faint">
          {hint}
        </span>
      )}
    </label>
  );
}

/** La muestra de un cosmético, con su propio atributo para verse aunque se lleve otro. */
function Swatch({ slot, id }: { slot: CosmeticSlot; id: CosmeticId | null }) {
  const box = 'grid h-16 place-items-center overflow-hidden rounded-lg';
  if (slot === 'felt' && id) {
    return <span data-felt={themeKey(id)} className={`felt ${box} block`} aria-hidden />;
  }
  if (slot === 'cardBack' && id) {
    return (
      <span data-back={themeKey(id)} className={`${box} bg-ink-900`} aria-hidden>
        <span className="card-back block h-12 w-[2.15rem] rounded-sm border-[3px] border-paper" />
      </span>
    );
  }
  if (slot === 'chips' && id) {
    return (
      <span data-chips={themeKey(id)} className={`${box} bg-ink-900`} aria-hidden>
        <span className="flex -space-x-1">
          {([10, 50, 100, 500] as const).map((v) => (
            <span key={v} className={`chip chip-sm chip-${v} text-[8px] [--chip-size:1.75rem]`}>
              {v}
            </span>
          ))}
        </span>
      </span>
    );
  }
  return (
    <span className={`${box} bg-ink-900 px-2`} aria-hidden>
      {id ? (
        <span className="rounded-full border border-warn/50 bg-warn/10 px-2.5 py-0.5 text-xs font-semibold text-warn">
          {COSMETICS[id].name}
        </span>
      ) : (
        <span className="text-xs text-faint">—</span>
      )}
    </span>
  );
}

/** La mesa con todo lo puesto: dos cartas boca abajo, las fichas y tu nombre con el título. */
function Preview({ equipped }: { equipped: EquippedCosmetics }) {
  const name = useAccountStore((s) => s.me?.displayName ?? 'Tú');
  const title = titleName(equipped.title);
  return (
    <figure
      aria-label="Vista previa de tu mesa"
      className="felt flex flex-col items-center gap-4 rounded-2xl border border-ink-800 px-4 py-6 lg:sticky lg:top-20"
      data-testid="look-preview"
    >
      <div className="flex items-end" aria-hidden>
        <PlayingCard
          card={{ id: 'look-back', face: 'K', suit: 'H' }}
          faceDown
          className="-mr-6 -rotate-6"
        />
        <PlayingCard card={{ id: 'look-a', face: 'A', suit: 'S' }} className="rotate-3" />
      </div>
      <div className="flex -space-x-2" aria-hidden>
        {([10, 50, 100, 500] as const).map((v) => (
          <span key={v} className={`chip chip-sm chip-${v}`}>
            {v}
          </span>
        ))}
      </div>
      <figcaption className="flex flex-wrap items-center justify-center gap-2 text-sm">
        <span className="font-semibold">{name}</span>
        {title && (
          <span className="rounded-full border border-warn/50 bg-warn/10 px-2.5 py-0.5 text-xs font-semibold text-warn">
            {title}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
