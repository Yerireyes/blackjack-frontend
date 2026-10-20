/// <reference lib="webworker" />
// Carga el motor WASM y lo expone con Comlink. Todo el cálculo corre aquí,
// nunca en el hilo principal.
import init, { analyzeDealer, analyzeHand, analyzeRound } from '@bj/engine-wasm';
import wasmUrl from '@bj/engine-wasm/engine_wasm_bg.wasm?url';
import * as Comlink from 'comlink';
import type { EngineApi } from './api';

const ready = init({ module_or_path: wasmUrl });

/** El motor lanza JsError con mensaje en español; lo pasamos como Error plano. */
async function run<T>(fn: () => T): Promise<T> {
  await ready;
  try {
    return fn();
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : String(e), { cause: e });
  }
}

const api: EngineApi = {
  analyzeHand: (r) => run(() => analyzeHand(r)),
  analyzeDealer: (r) => run(() => analyzeDealer(r)),
  analyzeRound: (r) => run(() => analyzeRound(r)),
};

Comlink.expose(api);
