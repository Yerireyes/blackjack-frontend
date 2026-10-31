// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { errorText } from '@/account/errors';
import { oauthErrorNotice } from '@/account/oauthReturn';
import { useAccountStore } from '@/account/accountStore';
import type { Me } from '@/account/types';
import { ApiRequestError } from '@/api/http';
import { json, stubFetch } from '@/tests/server';
import { useAdminStore } from './adminStore';
import { ReportButton, ReportDialog } from './Report';

const me: Me = {
  id: 'u1',
  email: 'ana@example.com',
  displayName: 'Ana',
  needsDisplayName: false,
  hasPassword: true,
  providers: [],
  createdAt: '2026-10-27T12:00:00Z',
  isAdmin: true,
};

beforeEach(() => {
  useAccountStore.setState({ status: 'signedIn', me, dialog: null });
  // jsdom no implementa <dialog>: lo justo para abrirlo.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.open = false;
  };
});
afterEach(() => vi.unstubAllGlobals());

describe('reportar', () => {
  it('no se ofrece para uno mismo', () => {
    render(<ReportButton name="Ana" />);
    expect(screen.queryByRole('button', { name: /Reportar/ })).toBeNull();
  });

  it('manda nombre, motivo y detalle; si ya lo reportó, lo dice', async () => {
    const calls = stubFetch({
      'POST /reports': [
        () => json(409, { code: 'report_exists', message: 'x' }),
        () => new Response(null, { status: 202 }),
      ],
    });
    render(
      <>
        <ReportButton name="Beto" />
        <ReportDialog />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reportar a Beto' }));
    fireEvent.click(screen.getByLabelText(/Nombre ofensivo/));
    fireEvent.change(screen.getByLabelText(/Detalle/), { target: { value: 'insulta' } });
    fireEvent.click(screen.getByTestId('report-submit'));
    expect(
      await screen.findByText('Ya lo reportaste; un administrador lo va a revisar.'),
    ).toBeTruthy();
    expect(calls[0]!.body).toEqual({ displayName: 'Beto', reason: 'name', details: 'insulta' });
  });
});

describe('cuenta suspendida', () => {
  it('al entrar (contraseña o Google) se dice que está suspendida', () => {
    expect(errorText(new ApiRequestError(403, 'account_banned', 'x'))).toBe(
      'Tu cuenta está suspendida.',
    );
    expect(oauthErrorNotice('account_banned').text).toBe('Tu cuenta está suspendida.');
  });
});

describe('administración', () => {
  it('suspender manda el motivo y recarga los reportes', async () => {
    const calls = stubFetch({
      'POST /admin/users/u9/ban': () => new Response(null, { status: 204 }),
      'GET /admin/reports?status=open': () => json(200, []),
    });
    expect(await useAdminStore.getState().ban('u9', 'insultos')).toBe(true);
    expect(calls[0]!.body).toEqual({ reason: 'insultos' });
    await vi.waitFor(() =>
      expect(calls.map((c) => c.key)).toContain('GET /admin/reports?status=open'),
    );
  });
});
