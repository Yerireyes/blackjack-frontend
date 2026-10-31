import { Ban, PenLine, Search, ShieldAlert, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useAccountStore } from '@/account/accountStore';
import { PageScreen } from '@/app/PageScreen';
import { Segmented } from '@/components/Segmented';
import type { AdminUser, Report, ReportReason } from './api';
import { useAdminStore } from './adminStore';

const REASON: Record<ReportReason, string> = {
  name: 'Nombre ofensivo',
  behavior: 'Comportamiento',
  cheating: 'Trampas',
  other: 'Otro',
};
const ACTION: Record<NonNullable<Report['action']>, string> = {
  dismiss: 'Descartado',
  rename: 'Nombre cambiado',
  ban: 'Suspendido',
};
const when = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

type Tab = 'reports' | 'users';

/** Administración (solo `me.isAdmin`): reportes y usuarios. */
export function AdminScreen() {
  const isAdmin = useAccountStore((s) => s.me?.isAdmin ?? false);
  const [tab, setTab] = useState<Tab>('reports');
  return (
    <PageScreen title="Administración">
      {!isAdmin ? (
        <p className="flex items-center gap-2 text-sm text-mute">
          <ShieldAlert className="size-4" aria-hidden /> Esta sección es solo para administradores.
        </p>
      ) : (
        <>
          <div className="max-w-xs">
            <Segmented<Tab>
              label="Sección"
              value={tab}
              options={[
                { value: 'reports', label: 'Reportes' },
                { value: 'users', label: 'Usuarios' },
              ]}
              onChange={setTab}
            />
          </div>
          {tab === 'reports' ? <Reports /> : <Users />}
        </>
      )}
    </PageScreen>
  );
}

function Reports() {
  const status = useAdminStore((s) => s.reportStatus);
  const reports = useAdminStore((s) => s.reports);
  const error = useAdminStore((s) => s.error);
  const load = useAdminStore((s) => s.loadReports);
  useEffect(() => void load(), [load]);

  return (
    <section aria-labelledby="reports-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="reports-title" className="section-title">
          Reportes
        </h2>
        <div className="w-56">
          <Segmented<'open' | 'resolved'>
            label="Estado"
            value={status}
            options={[
              { value: 'open', label: 'Abiertos' },
              { value: 'resolved', label: 'Resueltos' },
            ]}
            onChange={(v) => void load(v)}
          />
        </div>
      </div>
      {error && !reports ? (
        <p className="text-sm text-mute">{error}</p>
      ) : !reports ? (
        <p className="text-sm text-mute">Cargando…</p>
      ) : reports.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-700 px-4 py-6 text-center text-sm text-mute">
          {status === 'open' ? 'No hay reportes abiertos.' : 'Todavía no hay reportes resueltos.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="admin-reports">
          {reports.map((r) => (
            <ReportCard key={r.id} r={r} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ReportCard({ r }: { r: Report }) {
  const dismiss = useAdminStore((s) => s.dismiss);
  const busy = useAdminStore((s) => s.busy.includes(r.id) || s.busy.includes(r.target.id));
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-ink-800 bg-ink-950/60 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm">
          <span className="font-semibold">{r.target.displayName}</span>{' '}
          <span className="text-mute">reportado por {r.reporter.displayName}</span>
        </p>
        <span className="text-xs text-faint">{when.format(new Date(r.createdAt))}</span>
      </div>
      <p className="text-sm">
        <span className="rounded-full border border-ink-700 px-2 py-0.5 text-xs">
          {REASON[r.reason]}
        </span>
        {r.details && <span className="ml-2 text-mute">«{r.details}»</span>}
      </p>
      {r.resolvedAt ? (
        <p className="text-xs text-faint">
          {r.action ? ACTION[r.action] : 'Resuelto'} · {when.format(new Date(r.resolvedAt))}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn h-9 min-h-0"
            onClick={() => void dismiss(r.id)}
            disabled={busy}
          >
            <X className="size-4" aria-hidden /> Descartar
          </button>
          <UserActions userId={r.target.id} name={r.target.displayName} banned={false} />
        </div>
      )}
    </li>
  );
}

/** Cambiar nombre, suspender (con motivo y confirmación) o levantar la suspensión. */
function UserActions({ userId, name, banned }: { userId: string; name: string; banned: boolean }) {
  const rename = useAdminStore((s) => s.rename);
  const ban = useAdminStore((s) => s.ban);
  const unban = useAdminStore((s) => s.unban);
  const busy = useAdminStore((s) => s.busy.includes(userId));
  const [confirmRename, setConfirmRename] = useState(false);
  const [banning, setBanning] = useState(false);
  const [reason, setReason] = useState('');

  if (banned) {
    return (
      <button
        type="button"
        className="btn h-9 min-h-0"
        onClick={() => void unban(userId)}
        disabled={busy}
      >
        Levantar suspensión
      </button>
    );
  }
  if (banning) {
    const submit = async (e: FormEvent) => {
      e.preventDefault();
      if (await ban(userId, reason.trim())) setBanning(false);
    };
    return (
      <form
        className="flex w-full flex-col gap-2 rounded-xl border border-neg/40 bg-neg/10 p-3"
        onSubmit={(e) => void submit(e)}
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Motivo de la suspensión de {name}
          <input
            className="input text-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 300))}
            maxLength={300}
            required
            autoFocus
          />
        </label>
        <p className="text-xs text-mute">
          No podrá entrar y desaparece de los rankings. Cierra los reportes abiertos sobre esta
          persona.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn h-9 min-h-0" onClick={() => setBanning(false)}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn h-9 min-h-0 border-neg/60 text-neg"
            disabled={busy || reason.trim().length === 0}
          >
            Suspender
          </button>
        </div>
      </form>
    );
  }
  return (
    <>
      {confirmRename ? (
        <span className="flex items-center gap-1.5 text-sm">
          ¿Cambiar el nombre de {name}?
          <button type="button" className="btn h-9 min-h-0" onClick={() => setConfirmRename(false)}>
            No
          </button>
          <button
            type="button"
            className="btn btn-paper h-9 min-h-0"
            onClick={() => {
              setConfirmRename(false);
              void rename(userId);
            }}
            disabled={busy}
          >
            Sí, cambiar
          </button>
        </span>
      ) : (
        <button
          type="button"
          className="btn h-9 min-h-0"
          onClick={() => setConfirmRename(true)}
          disabled={busy}
        >
          <PenLine className="size-4" aria-hidden /> Cambiar nombre
        </button>
      )}
      <button
        type="button"
        className="btn h-9 min-h-0 text-neg"
        onClick={() => setBanning(true)}
        disabled={busy}
      >
        <Ban className="size-4" aria-hidden /> Suspender
      </button>
    </>
  );
}

function Users() {
  const query = useAdminStore((s) => s.query);
  const users = useAdminStore((s) => s.users);
  const search = useAdminStore((s) => s.search);
  const [text, setText] = useState(query);
  return (
    <section aria-labelledby="users-title" className="flex flex-col gap-4">
      <h2 id="users-title" className="section-title">
        Usuarios
      </h2>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void search(text);
        }}
      >
        <input
          className="input min-w-0 flex-1"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Comienzo del nombre"
          aria-label="Buscar por nombre"
        />
        <button type="submit" className="btn h-11" disabled={!text.trim()}>
          <Search className="size-4" aria-hidden /> Buscar
        </button>
      </form>
      {users &&
        (users.length === 0 ? (
          <p className="text-sm text-mute">No hay usuarios con ese nombre.</p>
        ) : (
          <ul className="flex flex-col gap-3" data-testid="admin-users">
            {users.map((u) => (
              <UserCard key={u.id} u={u} />
            ))}
          </ul>
        ))}
    </section>
  );
}

function UserCard({ u }: { u: AdminUser }) {
  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-ink-800 bg-ink-950/60 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm">
          <span className="font-semibold">{u.displayName}</span>{' '}
          <span className="text-mute">{u.email}</span>
        </p>
        <span className="text-xs text-faint">
          desde {when.format(new Date(u.createdAt))}
          {u.openReports > 0 && (
            <span className="ml-2 text-warn">
              {u.openReports} {u.openReports === 1 ? 'reporte abierto' : 'reportes abiertos'}
            </span>
          )}
        </span>
      </div>
      {u.bannedAt && (
        <p className="text-xs text-neg">
          Suspendida el {when.format(new Date(u.bannedAt))}
          {u.banReason && `: ${u.banReason}`}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <UserActions userId={u.id} name={u.displayName} banned={!!u.bannedAt} />
      </div>
    </li>
  );
}
