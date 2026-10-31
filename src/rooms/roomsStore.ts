// Salas Casual multijugador. El lobby por HTTP; la mesa por WebSocket: el servidor manda el
// estado completo (`state`) en cada cambio y aquí se reemplaza entero, como con RoundView.
// Nunca se reparte, se liquida ni se calcula `allowed` en el navegador: solo se mandan
// intenciones (sentarse, apostar, decidir) y se dibuja lo que llega.
import { create } from 'zustand';
import { useAccountStore } from '@/account/accountStore';
import { errorText } from '@/account/errors';
import { ApiRequestError } from '@/api/http';
import type {
  Action,
  ClientMessage,
  CreateRoomRequest,
  Reaction,
  RoomInfo,
  RoomSeat,
  RoomState,
  ServerMessage,
} from '@/engine/contract';
import {
  canAddChip,
  MIN_BET,
  MAX_BET,
  newChip,
  stackTotal,
  type Chip,
  type ChipValue,
} from '@/store/chipsStore';
import { useShoeStore } from '@/store/shoeStore';
import { useTableStore } from '@/store/tableStore';
import { useUiStore } from '@/store/uiStore';
import { roomsApi, roomSocketUrl } from './api';
import { revealStepsOf } from './view';

/**
 * - `idle`: sin sala abierta (lobby u otra pantalla).
 * - `connecting`: abriendo el WebSocket por primera vez.
 * - `open`: conectado; llegan los `state`.
 * - `reconnecting`: se cortó sin `closed`; se reintenta con espera creciente.
 * - `failed`: no se pudo entrar (o reconectar); `failure` dice por qué.
 */
export type ConnStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'failed';

export interface ShownReaction {
  key: number;
  playerId: string;
  reaction: Reaction;
}

export interface RoomsState {
  lobby: RoomInfo[] | null;
  lobbyStatus: 'idle' | 'loading' | 'ready' | 'unavailable';
  creating: boolean;
  code: string | null;
  conn: ConnStatus;
  failure: string | null;
  /** «Yo» en la sala (`welcome`): mi asiento, si soy anfitrión, mi fila del ranking. */
  me: string | null;
  room: RoomState | null;
  /** Cuándo llegó el último `state` (performance.now): el temporizador cuenta desde ahí. */
  receivedAt: number;
  /** Número de ronda local: da ids estables a las cartas para animarlas. */
  roundNo: number;
  /** Pasos de la revelación del dealer ya mostrados en `results`. */
  shown: number;
  reactions: ShownReaction[];
  /** Reacción mandada hace menos de 2 s: el servidor no acepta otra todavía. */
  reactCooling: boolean;
  /** Pila de la próxima apuesta (solo interfaz; la pila real la dice el servidor). */
  stack: Chip[];
  loadLobby(): Promise<void>;
  /** Crea la sala y entra. Devuelve el mensaje de error, o null si salió bien. */
  create(req: CreateRoomRequest): Promise<string | null>;
  join(code: string): void;
  leave(): void;
  sit(seat: number): void;
  leaveSeat(): void;
  bet(): void;
  act(action: Action): void;
  /** Con As visible: todos deciden el seguro a la vez. */
  insure(take: boolean): void;
  rebuy(): void;
  react(reaction: Reaction): void;
  kick(playerId: string): void;
  addChip(value: ChipValue): number | null;
  removeChip(): void;
  clearStack(): void;
  dismissReaction(key: number): void;
}

export const REVEAL_STEP_MS = 600;
const REVEAL_FIRST_MS = 500;
const REACT_COOLDOWN_MS = 2000;
const MAX_RETRIES = 8;
const backoff = (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000);

/** Mi asiento (si estoy sentado). */
export const mySeatOf = (s: Pick<RoomsState, 'room' | 'me'>): RoomSeat | null =>
  (s.me && s.room?.seats.find((x) => x.player?.id === s.me)) || null;

/** Tope de mi próxima apuesta: 500 y nunca más que mi pila. */
export const maxBetOf = (s: Pick<RoomsState, 'room' | 'me'>) =>
  Math.min(MAX_BET, mySeatOf(s)?.stack ?? 0);

/** Es mi turno: el servidor dice que decide mi asiento. */
export const myTurnOf = (s: Pick<RoomsState, 'room' | 'me'>) => {
  const seat = mySeatOf(s);
  return !!seat && s.room?.phase === 'playing' && s.room.round?.turn === seat.seat;
};

/**
 * Mi seguro en la ronda: `none` si no se ofrece o no juego, `pending` si falta decidirlo,
 * `taken`/`declined` una vez decidido.
 */
export const myInsuranceOf = (s: Pick<RoomsState, 'room' | 'me'>) => {
  const seat = mySeatOf(s);
  const r = s.room?.round;
  const mine = seat && r ? r.seats.find((x) => x.seat === seat.seat) : undefined;
  if (!mine || !r) return 'none';
  if (mine.insured === undefined) return r.phase === 'insurance' ? 'pending' : 'none';
  return mine.insured ? 'taken' : 'declined';
};

const notify = (text: string, tone: 'info' | 'error' = 'info') =>
  useTableStore.getState().notify(text, tone);

/** Mensajes de `error` dentro de la sala (sección 6 de la guía). */
const ERROR_TEXT: Record<string, string | null> = {
  seat_taken: 'Ese asiento ya está ocupado.',
  already_seated: 'Ya estás sentado.',
  not_seated: 'Siéntate para jugar.',
  betting_closed: 'Las apuestas están cerradas.',
  bet_out_of_range: 'La apuesta es de 10 a 500, en múltiplos de 10.',
  insufficient_funds: 'No te alcanza la pila.',
  round_in_progress: 'Espera a que termine la ronda.',
  round_voided: 'Se acabó el zapato: la ronda se anuló y nadie perdió nada.',
  // El estado que llega después ya es el correcto: no hace falta avisar.
  not_your_turn: null,
  action_not_allowed: null,
  rebuy_not_needed: null,
  not_in_round: null,
  rate_limited: null,
  not_host: null,
};

const CLOSED_TEXT: Record<string, string> = {
  kicked: 'El anfitrión te sacó de la sala.',
  banned: 'No puedes volver a entrar a esta sala.',
  closed: 'La sala cerró.',
  full: 'La sala está llena.',
};

export const useRoomsStore = create<RoomsState>()((set, get) => {
  let ws: WebSocket | null = null;
  /** Conexión que se cerró a propósito (salir, `closed`): no se reconecta. */
  let intentional = false;
  let everOpened = false;
  let attempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let revealTimer: ReturnType<typeof setTimeout> | null = null;
  let coolTimer: ReturnType<typeof setTimeout> | null = null;
  let reactionKey = 0;

  const stopTimers = () => {
    if (retryTimer) clearTimeout(retryTimer);
    if (revealTimer) clearTimeout(revealTimer);
    retryTimer = revealTimer = null;
  };

  const send = (msg: ClientMessage) => {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  };

  /** Volver al lobby con un aviso (la sala cerró, me echaron…). */
  const backToLobby = (text: string) => {
    get().leave();
    notify(text, 'error');
    if (useUiStore.getState().screen === 'rooms') useUiStore.getState().openRoom(null);
  };

  /** Anima la revelación del dealer al pasar a `results`: la oculta y cada carta pedida. */
  const startReveal = (steps: number) => {
    if (revealTimer) clearTimeout(revealTimer);
    set({ shown: 0 });
    if (steps === 0) return;
    const step = () => {
      const shown = get().shown + 1;
      set({ shown });
      revealTimer = shown < steps ? setTimeout(step, REVEAL_STEP_MS) : null;
    };
    revealTimer = setTimeout(step, REVEAL_FIRST_MS);
  };

  const applyState = (room: RoomState) => {
    const prev = get().room;
    // Ronda nueva: hay ronda y antes no la había (o se estaba apostando).
    const newRound =
      !!room.round && (!prev?.round || prev.phase === 'betting' || prev.phase === 'waiting');
    set({
      room,
      receivedAt: performance.now(),
      roundNo: get().roundNo + (newRound ? 1 : 0),
    });
    if (room.phase === 'results' && room.round) {
      const steps = revealStepsOf(room.round);
      // Al entrar con la ronda ya liquidada no hay nada que animar.
      if (!prev) set({ shown: steps });
      else if (prev.phase !== 'results') startReveal(steps);
    } else if (revealTimer) {
      clearTimeout(revealTimer);
      revealTimer = null;
    }
    // Las fichas de la próxima apuesta nunca pasan de lo que permite la pila (solo sentado:
    // mirando no hay pila). Al sentarse, si no hay fichas puestas, empieza con una de 10.
    const seat = mySeatOf(get());
    if (seat) {
      const max = maxBetOf(get());
      const stack = get().stack.slice();
      const justSat = !prev || !mySeatOf({ room: prev, me: get().me });
      if (justSat && stack.length === 0 && max >= MIN_BET) stack.push(newChip(10));
      while (stack.length > 0 && stackTotal(stack) > max) stack.pop();
      if (stack.length !== get().stack.length || justSat) set({ stack });
    }
    // Cambió la mesa: el análisis (con ayudas) se recalcula.
    useShoeStore.getState().bump();
  };

  const onMessage = (msg: ServerMessage) => {
    switch (msg.type) {
      case 'welcome':
        set({ me: msg.playerId });
        return;
      case 'state':
        applyState(msg.room);
        return;
      case 'reaction':
        set({
          reactions: [
            ...get().reactions.filter((r) => r.playerId !== msg.playerId),
            { key: ++reactionKey, playerId: msg.playerId, reaction: msg.reaction },
          ],
        });
        return;
      case 'error': {
        const text = msg.code in ERROR_TEXT ? ERROR_TEXT[msg.code] : msg.message;
        if (text) notify(text, msg.code === 'round_voided' ? 'info' : 'error');
        return;
      }
      case 'closed':
        intentional = true;
        backToLobby(CLOSED_TEXT[msg.reason] ?? 'Saliste de la sala.');
        return;
    }
  };

  /** ¿Sigue existiendo la sala? (un WebSocket que falla no dice por qué). */
  const explainFailure = async (code: string) => {
    try {
      await roomsApi.get(code);
      return useAccountStore.getState().me?.needsDisplayName
        ? 'Elige tu nombre antes de entrar a una sala.'
        : 'No se pudo entrar a la sala. Puede estar llena o el anfitrión te sacó.';
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 404) return null;
      return 'No se pudo entrar a la sala. Revisa tu conexión.';
    }
  };

  const connect = (code: string) => {
    const socket = new WebSocket(roomSocketUrl(code));
    ws = socket;
    socket.onopen = () => {
      if (ws !== socket) return;
      everOpened = true;
      attempt = 0;
      set({ conn: 'open', failure: null });
    };
    socket.onmessage = (e) => {
      if (ws !== socket) return;
      try {
        onMessage(JSON.parse(String(e.data)) as ServerMessage);
      } catch {
        // Un mensaje que no se entiende se ignora: el siguiente `state` trae todo.
      }
    };
    socket.onclose = () => {
      if (ws !== socket || intentional) return;
      ws = null;
      void retry(code);
    };
  };

  const retry = async (code: string) => {
    // Primer intento fallido o varios seguidos: preguntar si la sala existe.
    if (!everOpened || attempt >= 2) {
      const why = await explainFailure(code);
      if (get().code !== code || intentional) return;
      if (why === null) {
        backToLobby(everOpened ? 'La sala cerró.' : 'Esa sala no existe o ya cerró.');
        return;
      }
      if (!everOpened || attempt >= MAX_RETRIES) {
        set({ conn: 'failed', failure: why });
        return;
      }
    }
    set({ conn: 'reconnecting' });
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (get().code === code && !intentional) connect(code);
    }, backoff(attempt++));
  };

  return {
    lobby: null,
    lobbyStatus: 'idle',
    creating: false,
    code: null,
    conn: 'idle',
    failure: null,
    me: null,
    room: null,
    receivedAt: 0,
    roundNo: 0,
    shown: 0,
    reactions: [],
    reactCooling: false,
    stack: [newChip(10)],

    async loadLobby() {
      if (get().lobbyStatus === 'idle') set({ lobbyStatus: 'loading' });
      try {
        set({ lobby: await roomsApi.list(), lobbyStatus: 'ready' });
      } catch {
        set({ lobbyStatus: 'unavailable' });
      }
    },

    async create(req) {
      if (get().creating) return null;
      set({ creating: true });
      try {
        const info = await roomsApi.create(req);
        useUiStore.getState().openRoom(info.code);
        return null;
      } catch (e) {
        if (e instanceof ApiRequestError) {
          if (e.status === 401) {
            useAccountStore.getState().sessionLost();
            return 'Tu sesión se cerró. Vuelve a entrar.';
          }
          if (e.code === 'display_name_required') {
            useAccountStore.getState().openDialog('name');
            return 'Elige tu nombre antes de crear una sala.';
          }
          if (e.code === 'room_hosting') {
            return 'Ya tienes una sala abierta. Ciérrala (sal de ella) antes de crear otra.';
          }
          if (e.code === 'rooms_full') return 'Hay demasiadas salas abiertas. Prueba en un rato.';
        }
        return errorText(e);
      } finally {
        set({ creating: false });
      }
    },

    join(code) {
      if (get().code === code && get().conn !== 'failed' && get().conn !== 'idle') return;
      get().leave();
      intentional = false;
      everOpened = false;
      attempt = 0;
      set({ code, conn: 'connecting', failure: null });
      connect(code);
    },

    leave() {
      intentional = true;
      stopTimers();
      const socket = ws;
      ws = null;
      socket?.close();
      set({
        code: null,
        conn: 'idle',
        me: null,
        room: null,
        shown: 0,
        reactions: [],
        roundNo: 0,
      });
    },

    sit: (seat) => send({ type: 'sit', seat }),
    leaveSeat: () => send({ type: 'leaveSeat' }),

    bet() {
      const amount = stackTotal(get().stack);
      if (amount < MIN_BET) {
        notify('Pon fichas para apostar (mínimo 10).', 'error');
        return;
      }
      send({ type: 'bet', amount });
    },

    act(action) {
      const s = get();
      if (!myTurnOf(s) || !s.room?.round?.allowed[action]) return;
      send({ type: 'action', action });
    },

    insure(take) {
      if (myInsuranceOf(get()) !== 'pending') return;
      send({ type: 'insurance', take });
    },

    rebuy: () => send({ type: 'rebuy' }),

    react(reaction) {
      if (get().reactCooling) return;
      send({ type: 'react', reaction });
      set({ reactCooling: true });
      if (coolTimer) clearTimeout(coolTimer);
      coolTimer = setTimeout(() => set({ reactCooling: false }), REACT_COOLDOWN_MS);
    },

    kick: (playerId) => send({ type: 'kick', playerId }),

    addChip(value) {
      const s = get();
      if (!canAddChip(s.stack, value, maxBetOf(s))) return null;
      const chip = newChip(value);
      set({ stack: [...s.stack, chip] });
      return chip.id;
    },
    removeChip() {
      const s = get();
      if (s.stack.length > 0) set({ stack: s.stack.slice(0, -1) });
    },
    clearStack: () => set({ stack: [] }),

    dismissReaction(key) {
      set({ reactions: get().reactions.filter((r) => r.key !== key) });
    },
  };
});
