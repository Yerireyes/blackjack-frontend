import { create } from 'zustand';
import { useTableStore } from '@/store/tableStore';
import { accountApi, ApiRequestError } from './api';
import { oauthErrorNotice, readOAuthReturn, withoutOAuthParams } from './oauthReturn';
import type { Me, Providers, RegisterInput } from './types';

/**
 * - `loading`: todavía no se sabe si hay sesión.
 * - `anonymous`: sin sesión (lo normal sin login). Práctica funciona igual.
 * - `signedIn`: con sesión; `me` tiene el usuario.
 * - `unavailable`: la API no responde (backend apagado). Práctica funciona igual.
 */
export type AccountStatus = 'loading' | 'anonymous' | 'signedIn' | 'unavailable';
export type AccountDialog = 'auth' | 'profile' | 'name' | null;

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
  openDialog(dialog: AccountDialog): void;
  deferName(): void;
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

  /** Llamada con sesión: un 401 = la sesión venció (7 días) o se cerró en otro dispositivo. */
  const authed = async <T>(call: () => Promise<T>): Promise<T> => {
    try {
      return await call();
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 401) {
        signOut();
        notify(
          'Tu sesión se cerró (venció o se cerró en otro dispositivo). Vuelve a entrar.',
          'error',
        );
      }
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

    openDialog: (dialog) => set({ dialog }),
    deferName: () => set({ nameDeferred: true, dialog: null }),
  };
});
