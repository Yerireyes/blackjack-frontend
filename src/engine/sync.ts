// Mantiene el análisis al día: cada cambio de versión arma los pedidos que
// correspondan al modo actual y los manda al motor. También mueve a los bots
// (que juegan la acción de mayor EV del motor) y el autojuego del dealer.
import { useAnalysisStore, type AnalysisKind } from '@/store/analysisStore';
import { useRulesStore } from '@/store/rulesStore';
import { useShoeStore } from '@/store/shoeStore';
import { activeHand, useTableStore } from '@/store/tableStore';
import { useUiStore } from '@/store/uiStore';
import type { EngineMethod } from './api';
import {
  CancelledError,
  createChannel,
  createWorkerTransport,
  type Channel,
  type EngineTransport,
} from './client';
import {
  buildBotRequest,
  buildDealerRequest,
  buildHandRequest,
  buildRoundRequest,
  type Built,
} from './requests';

const BOT_DELAY_MS = 520;
const DEALER_DELAY_MS = 640;

let transport: EngineTransport | null = null;
const getTransport = () => (transport ??= createWorkerTransport());

const METHOD: Record<AnalysisKind, EngineMethod> = {
  hand: 'analyzeHand',
  dealer: 'analyzeDealer',
  round: 'analyzeRound',
};

const channels = {} as Record<AnalysisKind, Channel<EngineMethod>>;
const lastKey: Partial<Record<AnalysisKind, string>> = {};

function makeChannel(kind: AnalysisKind) {
  return createChannel({
    method: METHOD[kind],
    transport: getTransport,
    onResult: (res) => {
      useAnalysisStore.getState().receive(kind, res as never);
    },
    onError: (version, err) => {
      if (err instanceof CancelledError) return;
      delete lastKey[kind];
      useAnalysisStore.getState().fail(kind, version, err.message);
    },
    onSlow: (version) => useAnalysisStore.getState().markSlow(kind, version),
  });
}

function wanted(): Record<AnalysisKind, Built<{ version: number }> | null> {
  const { version } = useShoeStore.getState();
  const counts = useShoeStore.getState().toCounts();
  const { rules } = useRulesStore.getState();
  const t = useTableStore.getState();
  const ui = useUiStore.getState();
  if (ui.mode === 'player') {
    return {
      hand: buildHandRequest({
        version,
        rules,
        counts,
        player: t.player,
        dealer: t.dealer,
        phase: t.phase,
      }),
      dealer: null,
      round: null,
    };
  }
  return {
    hand: null,
    dealer: buildDealerRequest({ version, rules, counts, dealer: t.dealer, knowHole: ui.knowHole }),
    round:
      t.phase === 'player' || t.phase === 'bots' || ui.source === 'manual'
        ? buildRoundRequest({
            version,
            rules,
            counts,
            player: t.player,
            others: t.others,
            dealer: t.dealer,
          })
        : { ok: false, reason: 'La ventaja de la ronda se calcula mientras juegan los jugadores.' },
  };
}

const keyOf = (req: { version: number }) => JSON.stringify(req);

function refresh() {
  const analysis = useAnalysisStore.getState();
  const want = wanted();
  for (const kind of Object.keys(METHOD) as AnalysisKind[]) {
    const built = want[kind];
    const ch = channels[kind];
    if (!built) {
      ch.drop();
      delete lastKey[kind];
      continue;
    }
    if (!built.ok) {
      ch.drop();
      delete lastKey[kind];
      analysis.clear(kind, built.reason);
      continue;
    }
    // Mismo pedido y misma versión: ya está pedido o calculado.
    const key = keyOf(built.req);
    if (key === lastKey[kind]) continue;
    lastKey[kind] = key;
    analysis.request(kind, built.req.version);
    ch.submit(built.req as never);
  }
}

/** Cancelar un cálculo largo: reinicia el worker y vuelve a pedir el estado actual. */
export function cancelAnalysis() {
  getTransport().restart();
  for (const kind of Object.keys(METHOD) as AnalysisKind[]) {
    channels[kind].reset();
    delete lastKey[kind];
    const slot = useAnalysisStore.getState()[kind];
    if (slot.status === 'computing') {
      useAnalysisStore.getState().fail(kind, slot.requested ?? -1, 'Cálculo cancelado.');
    }
  }
}

/** Reintenta tras un error o una cancelación. */
export function retryAnalysis() {
  for (const kind of Object.keys(METHOD) as AnalysisKind[]) delete lastKey[kind];
  refresh();
}

// ---- Bots y dealer automático ----

let botTimer: ReturnType<typeof setTimeout> | null = null;
let botBusy = false;

function driveBots() {
  const t = useTableStore.getState();
  if (t.phase !== 'bots' || botBusy || botTimer) return;
  const seatIndex = t.others.findIndex((s) => s.hands.some((h) => !h.done));
  const seat = t.others[seatIndex];
  if (!seat) return;
  const shoe = useShoeStore.getState();
  const req = buildBotRequest(
    shoe.version,
    useRulesStore.getState().rules,
    shoe.toCounts(),
    seat,
    t.dealer,
  );
  if (!req) return;
  botBusy = true;
  const handId = activeHand(seat)?.id;
  getTransport()
    .call('analyzeHand', req)
    .then(
      (res) => res.best,
      () => 'stand' as const,
    )
    .then((best) => {
      botTimer = setTimeout(() => {
        botTimer = null;
        botBusy = false;
        const now = useTableStore.getState();
        const same = activeHand(now.others[seatIndex]!)?.id === handId;
        if (now.phase === 'bots' && same) {
          now.botAct(seatIndex, best === 'split' ? 'stand' : best);
        }
        driveBots();
      }, BOT_DELAY_MS);
    });
}

let dealerTimer: ReturnType<typeof setTimeout> | null = null;

function driveDealer() {
  const t = useTableStore.getState();
  const ui = useUiStore.getState();
  // En modo dealer el juego es guiado: el usuario pide cada carta.
  if (t.phase !== 'dealer' || ui.source !== 'simulation' || ui.mode !== 'player' || dealerTimer) {
    return;
  }
  dealerTimer = setTimeout(() => {
    dealerTimer = null;
    const step = useTableStore.getState().dealerStep();
    if (step !== 'settle' && step !== 'none') driveDealer();
  }, DEALER_DELAY_MS);
}

let started = false;

export function startEngineSync() {
  if (started) return;
  started = true;
  for (const kind of Object.keys(METHOD) as AnalysisKind[]) channels[kind] = makeChannel(kind);

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      refresh();
      driveBots();
      driveDealer();
    });
  };

  useShoeStore.subscribe((s, prev) => s.version !== prev.version && schedule());
  useUiStore.subscribe(
    (s, prev) => (s.mode !== prev.mode || s.knowHole !== prev.knowHole) && schedule(),
  );
  useRulesStore.subscribe((s, prev) => s.rules !== prev.rules && schedule());
  useTableStore.subscribe((s, prev) => s.phase !== prev.phase && schedule());
  schedule();
}
