// Mantiene el análisis al día: cada cambio de versión arma los pedidos que
// correspondan al modo actual y los manda al motor. También mueve a los bots
// (que juegan la acción de mayor EV del motor) y el autojuego del dealer.
import { useCasualStore } from '@/casual/casualStore';
import { mySeatOf, useRoomsStore } from '@/rooms/roomsStore';
import { myDecisionAsRound } from '@/rooms/view';
import { useAnalysisStore, type AnalysisKind } from '@/store/analysisStore';
import { useRulesStore } from '@/store/rulesStore';
import { useShoeStore } from '@/store/shoeStore';
import {
  activeHand,
  peekedBlackjack,
  playerActions,
  playerSpare,
  useTableStore,
} from '@/store/tableStore';
import { autoPlaysPlayer, useUiStore } from '@/store/uiStore';
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
  buildCasualHandRequest,
  buildDealerRequest,
  buildHandRequest,
  buildRoundRequest,
  type Built,
} from './requests';

const BOT_DELAY_MS = 520;
const DEALER_DELAY_MS = 640;
const PEEK_DELAY_MS = 1600;

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
  // Inicio y logros: nada que analizar. Ranked y el reto: sin ayudas, nunca se le pide nada al
  // motor.
  if (
    ui.screen === 'home' ||
    ui.screen === 'progress' ||
    ui.screen === 'ranked' ||
    ui.screen === 'daily'
  )
    return { hand: null, dealer: null, round: null };
  if (ui.screen === 'rooms') {
    // Salas: solo si el anfitrión activó las ayudas (el estado trae `shoeCounts`) y en mi turno.
    const s = useRoomsStore.getState();
    if (!s.room?.info.aids) return { hand: null, dealer: null, round: null };
    const seat = mySeatOf(s);
    const turn = seat ? myDecisionAsRound(s.room, seat.seat) : null;
    return {
      hand: turn
        ? buildCasualHandRequest(version, s.room.info.rules, turn)
        : {
            ok: false,
            reason: seat
              ? 'El EV de cada acción aparece cuando te toca decidir.'
              : 'Siéntate para ver el EV de tus decisiones.',
          },
      dealer: null,
      round: null,
    };
  }
  if (ui.screen === 'casual') {
    // Casual: la mano y el zapato salen de la última respuesta del servidor.
    const c = useCasualStore.getState();
    return {
      hand:
        c.run && c.round && !c.revealing
          ? buildCasualHandRequest(version, c.run.rules, c.round)
          : { ok: false, reason: 'Reparte una mano para ver el EV de cada acción.' },
      dealer: null,
      round: null,
    };
  }
  if (ui.mode === 'player') {
    return {
      hand: buildHandRequest({
        version,
        rules,
        counts,
        player: t.player,
        dealer: t.dealer,
        phase: t.phase,
        spare: playerSpare(t.player),
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

/** Los bots, el jugador automático y el dealer automático son solo de Práctica. */
const inPractice = () => useUiStore.getState().screen === 'practice';

function driveBots() {
  if (!inPractice()) return;
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

let autoTimer: ReturnType<typeof setTimeout> | null = null;
let autoBusy = false;

function driveAutoPlayer() {
  if (!inPractice()) return;
  const t = useTableStore.getState();
  if (!autoPlaysPlayer() || t.phase !== 'player' || autoBusy || autoTimer) return;
  const shoe = useShoeStore.getState();
  const rules = useRulesStore.getState().rules;
  const built = buildHandRequest({
    version: shoe.version,
    rules,
    counts: shoe.toCounts(),
    player: t.player,
    dealer: t.dealer,
    phase: t.phase,
    spare: playerSpare(t.player),
  });
  if (!built.ok) return;
  autoBusy = true;
  const handId = activeHand(t.player)?.id;
  const version = shoe.version;
  getTransport()
    .call('analyzeHand', built.req)
    .then(
      (res) => res.best,
      () => 'stand' as const,
    )
    .then((best) => {
      autoTimer = setTimeout(() => {
        autoTimer = null;
        autoBusy = false;
        const now = useTableStore.getState();
        const same =
          activeHand(now.player)?.id === handId && useShoeStore.getState().version === version;
        if (autoPlaysPlayer() && now.phase === 'player' && same) {
          // El motor solo elige entre las acciones permitidas; plantarse es la red de seguridad.
          now.act(playerActions(now.player, rules)[best] ? best : 'stand');
        }
        driveAutoPlayer();
      }, BOT_DELAY_MS);
    });
}

let dealerTimer: ReturnType<typeof setTimeout> | null = null;

function driveDealer() {
  if (!inPractice()) return;
  const t = useTableStore.getState();
  const ui = useUiStore.getState();
  // En modo dealer el juego es guiado: el usuario pide cada carta.
  if (t.phase !== 'dealer' || ui.source !== 'simulation' || ui.mode !== 'player' || dealerTimer) {
    return;
  }
  // Blackjack del dealer por peek: pausa más larga para que se vean las cartas repartidas.
  const peek = !t.dealer.holeRevealed && peekedBlackjack(t.dealer, useRulesStore.getState().rules);
  dealerTimer = setTimeout(
    () => {
      dealerTimer = null;
      const step = useTableStore.getState().dealerStep();
      if (step !== 'settle' && step !== 'none') driveDealer();
    },
    peek ? PEEK_DELAY_MS : DEALER_DELAY_MS,
  );
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
      driveAutoPlayer();
      driveDealer();
    });
  };

  useShoeStore.subscribe((s, prev) => s.version !== prev.version && schedule());
  useUiStore.subscribe(
    (s, prev) =>
      (s.screen !== prev.screen ||
        s.mode !== prev.mode ||
        s.knowHole !== prev.knowHole ||
        s.source !== prev.source) &&
      schedule(),
  );
  useRulesStore.subscribe((s, prev) => s.rules !== prev.rules && schedule());
  useTableStore.subscribe((s, prev) => s.phase !== prev.phase && schedule());
  // Al terminar la animación de liquidación cambia lo que se puede pedir.
  useCasualStore.subscribe((s, prev) => s.revealing !== prev.revealing && schedule());
  schedule();
}
