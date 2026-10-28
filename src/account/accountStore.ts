import { create } from 'zustand';
import { useTableStore } from '@/store/tableStore';
import { ApiRequestError } from '@/api/http';
import { accountApi, googleStartUrl } from './api';
import { oauthErrorNotice, readOAuthReturn, withoutOAuthParams } from './oauthReturn';
import type { Me, Providers, RegisterInput } from './types';

/**
 * - `loading`: todavía no se sabe si hay sesión.
 * - `anonymous`: sin sesión (lo normal sin login). Práctica funciona igual.
 * - `signedIn`: con sesión; `me` tiene el usuario.
 * - `unavailable`: la API no responde (backend apagado). Práctica funciona igual.
 */
export type AccountStatus = 'loading' | 'anonymous' | 'signedIn' | 'unavailable';
export type AccountDialog =
  | 'auth'
  | 'profile'
  | 'name'
  /** Pedir la contraseña antes de vincular Google. */
  | 'linkGoogle'
  /** Confirmar con la contraseña antes de desvincular Google. */
  | 'unlinkGoogle'
  | null;

export interface AccountState {
  status: AccountStatus;
  me: Me | null;
  providers: Providers;
  dialog: AccountDialog;
  /** "Más tarde" en el diálogo del nombre provisional: no se vuelve a abrir solo en esta visita. */
  nameDeferred: boolean;
  init(): Promise<void>;
  register(input: RegisterInput): Promise<void>;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  /** Cierra la sesión en todos los dispositivos, incluido este. */
  logoutAll(): Promise<void>;
  updateDisplayName(name: string): Promise<void>;
  /** Verifica la contraseña (link-intent) y navega a Google para vincular. */
  linkGoogle(password: string): Promise<void>;
  unlinkGoogle(password: string): Promise<void>;
  openDialog(dialog: AccountDialog): void;
  deferName(): void;
  /** Un 401 en una llamada con sesión (de cualquier módulo): pasa a anónimo y avisa. */
  sessionLost(): void;
}

const notify = (text: string, tone: 'info' | 'error' = 'info') =>
  useTableStore.getState().notify(text, tone);

export const useAccountStore = create<AccountState>()((set, get) => {
  /** Con sesión: guarda el usuario y, si el nombre es provisional, ofrece elegirlo. */
  const signIn = (me: Me) => {
    const askName = me.needsDisplayName && !get().nameDeferred;
    set({ status: 'signedIn', me, dialog: askName ? 'name' : null });
  };

  const signOut = () => set({ status: 'anonymous', me: null, dialog: null });

  const sessionLost = () => {
    signOut();
    notify('Tu sesión se cerró (venció o se cerró en otro dispositivo). Vuelve a entrar.', 'error');
  };

  /** Llamada con sesión: un 401 = la sesión venció (7 días) o se cerró en otro dispositivo. */
  const authed = async <T>(call: () => Promise<T>): Promise<T> => {
    try {
      return await call();
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 401) sessionLost();
      throw e;
    }
  };

  /** Cierra la sesión en el servidor. Un 401 = ya no había sesión, que es lo que se quería. */
  const endSession = async (call: () => Promise<void>) => {
    try {
      await call();
    } catch (e) {
      if (!(e instanceof ApiRequestError && e.status === 401)) throw e;
    }
    signOut();
  };

  /**
   * 409 de vincular o desvincular: el estado del front quedó viejo (ya vinculado, sin
   * contraseña, Google deshabilitado…). Se refresca, se vuelve al perfil y se avisa.
   */
  const resync = async (e: ApiRequestError) => {
    if (e.code === 'google_disabled') set({ providers: { google: false } });
    else {
      try {
        set({ me: await authed(accountApi.me) });
      } catch {
        // Si falla, el aviso de abajo igual explica qué pasó.
      }
    }
    if (get().status === 'signedIn') set({ dialog: 'profile' });
    notify(e.message, 'error');
  };

  /** Errores 409 se resuelven aquí; el resto (403 invalid_password, 429…) va al diálogo. */
  const withResync = async (call: () => Promise<void>) => {
    try {
      await call();
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 409) return resync(e);
      throw e;
    }
  };

  return {
    status: 'loading',
    me: null,
    providers: { google: false },
    dialog: null,
    nameDeferred: false,

    async init() {
      const back = typeof window === 'undefined' ? null : readOAuthReturn(window.location.search);
      if (back) window.history.replaceState(null, '', withoutOAuthParams(window.location.href));

      set({ status: 'loading' });
      const [providers, me] = await Promise.allSettled([accountApi.providers(), accountApi.me()]);
      set({ providers: providers.status === 'fulfilled' ? providers.value : { google: false } });

      if (me.status === 'fulfilled') signIn(me.value);
      else if (me.reason instanceof ApiRequestError && me.reason.status === 401) signOut();
      else set({ status: 'unavailable', me: null });

      if (!back) return;
      if (!back.ok) {
        const n = oauthErrorNotice(back.code);
        notify(n.text, n.tone);
        // La prueba de vinculación faltaba, venció o ya se gastó: se vuelve a pedir la contraseña.
        if (back.code === 'reauth_required' && get().me?.hasPassword) set({ dialog: 'linkGoogle' });
      } else if (me.status === 'fulfilled') {
        notify(
          back.kind === 'link'
            ? 'Google vinculado a tu cuenta.'
            : `Sesión iniciada como ${me.value.displayName}.`,
        );
      }
    },

    async register(input) {
      signIn(await accountApi.register(input));
    },

    async login(email, password) {
      signIn(await accountApi.login(email, password));
    },

    logout: () => endSession(accountApi.logout),
    logoutAll: () => endSession(accountApi.logoutAll),

    async updateDisplayName(name) {
      const me = await authed(() => accountApi.updateMe(name));
      set({ me, dialog: null });
    },

    linkGoogle: (password) =>
      withResync(async () => {
        await authed(() => accountApi.googleLinkIntent(password));
        // Navegación completa: la prueba es de un solo uso y la gasta esta navegación.
        window.location.assign(googleStartUrl(true));
      }),

    unlinkGoogle: (password) =>
      withResync(async () => {
        const me = await authed(() => accountApi.googleUnlink(password));
        set({ me, dialog: 'profile' });
        notify('Google desvinculado. Se cerró la sesión en tus otros dispositivos.');
      }),

    openDialog: (dialog) => set({ dialog }),
    deferName: () => set({ nameDeferred: true, dialog: null }),
    sessionLost,
  };
});
