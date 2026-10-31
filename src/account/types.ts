// Tipos de la API de cuentas. No están en contract.ts (que solo genera los del motor):
// se declaran a mano según «../Backend/docs/Front — Fase 1 Cuentas.md».

/** Lo devuelven register, login, GET /auth/me y PATCH /me. Nunca incluye el hash. */
export interface Me {
  id: string;
  email: string;
  displayName: string;
  /** El nombre es provisional (cuenta creada con Google o anterior a los nombres). */
  needsDisplayName: boolean;
  /** false en cuentas creadas con Google. */
  hasPassword: boolean;
  /** Proveedores vinculados: [] o ["google"]. */
  providers: string[];
  /** RFC 3339. */
  createdAt: string;
  /** Administrador (moderación): ve el panel de reportes y usuarios. */
  isAdmin: boolean;
}

export interface Providers {
  google: boolean;
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
}
