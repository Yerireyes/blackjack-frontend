import type {
  AnalyzeDealerRequest,
  AnalyzeDealerResponse,
  AnalyzeHandRequest,
  AnalyzeHandResponse,
  AnalyzeRoundRequest,
  AnalyzeRoundResponse,
} from './contract';

/** Lo que expone el worker. Mismo contrato que el paquete WASM y la API HTTP. */
export interface EngineApi {
  analyzeHand(r: AnalyzeHandRequest): Promise<AnalyzeHandResponse>;
  analyzeDealer(r: AnalyzeDealerRequest): Promise<AnalyzeDealerResponse>;
  analyzeRound(r: AnalyzeRoundRequest): Promise<AnalyzeRoundResponse>;
}

export type EngineMethod = keyof EngineApi;
