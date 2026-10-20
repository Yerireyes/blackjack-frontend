// Puente con el worker del motor: versionado, debounce, cola de un solo pedido,
// aviso a los 5 s y cancelación (reinicia el worker).
import * as Comlink from 'comlink';
import type { EngineApi, EngineMethod } from './api';

export class CancelledError extends Error {
  override name = 'CancelledError';
  constructor() {
    super('Cálculo cancelado');
  }
}

type Req<M extends EngineMethod> = Parameters<EngineApi[M]>[0];
type Res<M extends EngineMethod> = Awaited<ReturnType<EngineApi[M]>>;

export interface EngineTransport {
  call<M extends EngineMethod>(method: M, req: Req<M>): Promise<Res<M>>;
  /** Corta lo que esté en curso: las promesas pendientes se rechazan con CancelledError. */
  restart(): void;
}

/** Transporte real: un Web Worker con el WASM. */
export function createWorkerTransport(): EngineTransport {
  let worker: Worker | null = null;
  let remote: Comlink.Remote<EngineApi> | null = null;
  let abort: (() => void)[] = [];

  const ensure = () => {
    if (!remote) {
      worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
      remote = Comlink.wrap<EngineApi>(worker);
    }
    return remote;
  };

  return {
    call(method, req) {
      const api = ensure();
      return new Promise((resolve, reject) => {
        const cancel = () => reject(new CancelledError());
        abort.push(cancel);
        (api[method] as unknown as (r: Req<typeof method>) => Promise<Res<typeof method>>)(req)
          .then(resolve, reject)
          .finally(() => {
            abort = abort.filter((a) => a !== cancel);
          });
      });
    },
    restart() {
      worker?.terminate();
      worker = null;
      remote = null;
      const pending = abort;
      abort = [];
      pending.forEach((a) => a());
    },
  };
}

export interface ChannelOptions<M extends EngineMethod> {
  method: M;
  transport: () => EngineTransport;
  onResult(res: Res<M>): void;
  onError(version: number, error: Error): void;
  /** Se llama cuando un pedido supera `timeoutMs`; la UI ofrece cancelar. */
  onSlow(version: number): void;
  debounceMs?: number;
  timeoutMs?: number;
}

export interface Channel<M extends EngineMethod> {
  submit(req: Req<M>): void;
  /** Descarta el pedido pendiente (no el que está en curso). */
  drop(): void;
  /** ¿Hay algo en curso o en espera? */
  busy(): boolean;
  /** Llamar tras `transport.restart()`: olvida el pedido en curso. */
  reset(): void;
}

/**
 * Un canal por tipo de análisis. Agrupa cambios rápidos (debounce de 50 ms) y,
 * si llega un estado nuevo mientras el motor calcula, guarda solo el último.
 */
export function createChannel<M extends EngineMethod>(opts: ChannelOptions<M>): Channel<M> {
  const debounceMs = opts.debounceMs ?? 50;
  const timeoutMs = opts.timeoutMs ?? 5000;
  let pending: Req<M> | null = null;
  let inflight = false;
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    timer = null;
    if (inflight || !pending) return;
    const req = pending;
    pending = null;
    inflight = true;
    const gen = generation;
    const slow = setTimeout(() => opts.onSlow(req.version), timeoutMs);
    opts
      .transport()
      .call(opts.method, req)
      .then(
        (res) => gen === generation && opts.onResult(res),
        (err: unknown) => {
          if (gen !== generation) return;
          opts.onError(req.version, err instanceof Error ? err : new Error(String(err)));
        },
      )
      .finally(() => {
        clearTimeout(slow);
        if (gen !== generation) return;
        inflight = false;
        if (pending) flush();
      });
  };

  return {
    submit(req) {
      pending = req;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, debounceMs);
    },
    drop() {
      pending = null;
      if (timer) clearTimeout(timer);
      timer = null;
    },
    busy: () => inflight || pending !== null,
    reset() {
      generation++;
      inflight = false;
      pending = null;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
