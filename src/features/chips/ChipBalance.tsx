import { Coins, Landmark } from 'lucide-react';
import { formatChips } from '@/lib/format';
import { useCasualStore } from '@/casual/casualStore';
import { fullyShown } from '@/casual/view';
import { useChipsStore, type Bank } from '@/store/chipsStore';
import { useUiStore } from '@/store/uiStore';

/** Saldo de la banca del modo actual y el resultado de su última ronda. */
export function ChipBalance() {
  const casual = useUiStore((s) => s.screen === 'casual');
  return casual ? <CasualBalance /> : <PracticeBalance />;
}

/** Casual: el saldo es de la partida y lo trae cada respuesta del servidor. */
function CasualBalance() {
  const balance = useCasualStore((s) => s.round?.wallet.balance ?? s.run?.balance ?? null);
  const last = useCasualStore((s) =>
    s.round?.result && fullyShown(s.round, s.shown) ? s.round.result.net : null,
  );
  if (balance === null) return null;
  return <BalanceChip icon={Coins} name="Saldo de la partida" balance={balance} last={last} />;
}

function PracticeBalance() {
  const source = useUiStore((s) => s.source);
  const mode = useUiStore((s) => s.mode);
  const bank: Bank = mode === 'dealer' ? 'house' : 'player';
  const balance = useChipsStore((s) => s[bank]);
  const last = useChipsStore((s) => (s.last?.bank === bank ? s.last.amount : null));
  if (source !== 'simulation') return null;

  return (
    <BalanceChip
      icon={bank === 'player' ? Coins : Landmark}
      name={bank === 'player' ? 'Tus fichas' : 'Banca de la casa'}
      balance={balance}
      last={last}
    />
  );
}

function BalanceChip({
  icon: Icon,
  name,
  balance,
  last,
}: {
  icon: typeof Coins;
  name: string;
  balance: number;
  last: number | null;
}) {
  return (
    <div
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-950 px-2.5 text-sm"
      data-testid="chip-balance"
      title={name}
    >
      <Icon className="size-4 text-warn" aria-hidden />
      <span className="sr-only">{name}:</span>
      <span className="font-semibold tabular-nums">{formatChips(balance)}</span>
      {last !== null && last !== 0 && (
        <span className={`text-xs tabular-nums ${last > 0 ? 'text-pos' : 'text-neg'}`}>
          <span className="sr-only">, última ronda </span>
          {formatChips(last, true)}
        </span>
      )}
    </div>
  );
}
