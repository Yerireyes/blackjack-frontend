# Blackjack Guide — Arquitectura Frontend

Oct 14, 2026 · @Erik

## Contexto y regla de oro

El frontend es una SPA en React que muestra, para cada mano, el valor esperado (EV) y las probabilidades exactas de cada acción: pedir, plantarse, doblar, dividir y rendirse. Todos los números los calcula el motor descrito en el documento de backend, con la composición real de las cartas que quedan en el zapato.

La app tiene dos modos de uso que comparten la misma mesa: **Jugador** (recomienda la mejor jugada) y **Dealer** (analiza cómo terminará la mano del dealer y la ventaja de la casa). Además, las cartas pueden llegar de dos formas: **Simulación** (la app reparte de un zapato virtual) o **Análisis manual** (el usuario ingresa las cartas que ve en una mesa real).

### Regla de oro (no negociable)

1. El frontend **nunca calcula ni escribe a mano** una probabilidad o un EV. Toda cifra que se muestra viene del motor.
2. Toda carta visible se descuenta del zapato antes de pedir un cálculo: cartas del jugador, carta visible del dealer, cartas de otros jugadores en la mesa y todas las cartas de rondas anteriores del mismo zapato.
3. La carta oculta del dealer **no** se descuenta hasta que se revela. Sigue contando como "posible" dentro del zapato.
4. No existe ninguna tabla de estrategia básica en el código como fuente de decisiones. Si se muestra, es solo como comparación ("la estrategia básica diría X").
5. La acción recomendada es siempre la de **mayor EV**, no la de mayor % de ganar. Si un valor es aproximado (el EV de dividir), la interfaz lo marca como tal.
6. Cualquier cambio en cartas o reglas invalida los resultados anteriores. Nunca se muestra un resultado calculado con un estado que ya no es el actual.

## Stack tecnológico

React + TypeScript + Vite, con el motor de cálculo corriendo como WebAssembly dentro de un Web Worker. Usar la última versión estable de cada paquete al iniciar el proyecto.

| Capa | Elección | Por qué |
| --- | --- | --- |
| Lenguaje | TypeScript en modo `strict` | Los tipos del contrato con el motor deben coincidir exactamente |
| UI | React | Ecosistema maduro, componentes reutilizables entre los dos modos |
| Build | Vite | Soporte directo para Web Workers y WASM, arranque rápido |
| Estado | Zustand | Simple, sin boilerplate, fácil de leer fuera de React (desde el worker bridge) |
| Estilos | Tailwind CSS | Diseño consistente y rápido de iterar |
| Animación | Motion (ex Framer Motion) | Reparto y volteo de cartas |
| Worker | Comlink | Llamar al worker como si fuera una función `async` |
| Motor | `@bj/engine-wasm` (paquete local generado con wasm-pack) | Ver documento de backend |
| Tests unitarios | Vitest + Testing Library | Integrado con Vite |
| Tests E2E | Playwright | Validar flujos completos y que la UI muestre lo que dice el motor |
| Monorepo | pnpm workspaces | Un solo repo para `engine`, `engine-wasm`, `web` y `api` |
| Calidad | ESLint + Prettier | Estándar del equipo |

No se usa Next.js: la app no necesita renderizado en servidor y todo el cálculo ocurre en el navegador.

## Estructura de carpetas

El frontend vive en `web/` dentro del monorepo y se organiza por funcionalidad, no por tipo de archivo.

```text
blackjack-guide/
├── pnpm-workspace.yaml
├── engine/            # Rust (ver doc de backend)
├── engine-wasm/       # bindings wasm-bindgen → paquete @bj/engine-wasm
├── api/               # opcional (ver doc de backend)
└── web/
    ├── index.html
    ├── vite.config.ts
    └── src/
        ├── main.tsx
        ├── app/                 # App.tsx, rutas, layout
        ├── domain/              # tipos y lógica pura SIN probabilidades
        │   ├── cards.ts         # Card, Rank, valor de mano, soft/hard
        │   ├── shoe.ts          # crear zapato, descontar carta, toCounts()
        │   ├── rules.ts         # tipo Rules y presets (Las Vegas, Europa, 6:5)
        │   └── shuffle.ts       # Fisher-Yates con crypto.getRandomValues
        ├── engine/              # puente con el motor
        │   ├── contract.ts      # tipos de request/response (espejo del motor)
        │   ├── engine.worker.ts # carga el WASM y expone la API con Comlink
        │   └── client.ts        # wrapper: versionado, debounce, cancelación
        ├── store/               # Zustand
        │   ├── rulesStore.ts
        │   ├── shoeStore.ts
        │   ├── tableStore.ts
        │   ├── analysisStore.ts
        │   └── uiStore.ts
        ├── features/
        │   ├── player-mode/     # PlayerView, ActionPanel, HitBustMeter
        │   ├── dealer-mode/     # DealerView, DealerOutcomeChart, HouseEdgePanel
        │   ├── shoe-tracker/    # ShoeEditor, ShoeHud
        │   └── settings/        # RulesPanel, presets
        ├── components/          # Card, Hand, Table, Chip, ModeSwitch, ProbBar
        ├── lib/                 # formato de números (es-PE), utilidades
        └── tests/               # helpers y fixtures
    └── e2e/                     # Playwright
```

La carpeta `domain/` puede calcular el **total** de una mano (por ejemplo, 17 suave), pero nunca una probabilidad. Esa frontera debe respetarse en todo el código.

## Modelo de estado (Zustand)

El zapato es la fuente de verdad: cada carta que aparece en la mesa se registra ahí, y el motor recibe los conteos que quedan. Cada cambio sube un número de versión para descartar cálculos viejos.

### Tipos de dominio

```ts
// La UI distingue J, Q, K para mostrarlas; el motor solo ve 10 rangos.
export type Face = 'A'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K';
export type Suit = 'S'|'H'|'D'|'C';
export interface Card { id: string; face: Face; suit: Suit; }

// Índice del motor: 0 = As, 1 = 2, ..., 8 = 9, 9 = cualquier carta de valor 10
export type RankIndex = 0|1|2|3|4|5|6|7|8|9;
export const toRankIndex = (f: Face): RankIndex => /* A→0, 2→1 … 10/J/Q/K→9 */;

export interface Rules {
  decks: number;                 // 1, 2, 6, 8
  dealerHitsSoft17: boolean;     // H17 = true, S17 = false
  doubleAfterSplit: boolean;     // DAS
  doubleOn: 'any' | '9-11' | '10-11';
  maxSplitHands: number;         // 2 = no re-split, 4 = hasta 4 manos
  resplitAces: boolean;
  hitSplitAces: boolean;
  surrender: 'none' | 'late';
  dealerPeeks: boolean;          // EE.UU. = true; europeo sin hole card = false
  blackjackPays: 1.5 | 1.2;      // 3:2 o 6:5
  penetration: number;           // 0–1, cuándo se rebaraja
}
```

### Stores

| Store | Guarda | Acciones principales |
| --- | --- | --- |
| `rulesStore` | `Rules` activas y preset elegido | `setRule`, `applyPreset` (resetea el zapato) |
| `shoeStore` | Cartas que quedan (`Card[]`), cartas vistas, `version` | `newShoe`, `drawCard`, `markSeen(face)`, `undoSeen`, `toCounts(): number[10]` |
| `tableStore` | Manos del jugador (con splits), carta visible y oculta del dealer, otras manos en la mesa, fase de la ronda | `deal`, `hit`, `stand`, `double`, `split`, `surrender`, `revealHole`, `nextRound` |
| `analysisStore` | Último resultado del motor, `version` con la que se calculó, `status` (`idle`/`computing`/`error`) | `request()`, `receive(result)` |
| `uiStore` | Modo (`player`/`dealer`), fuente de cartas (`simulation`/`manual`), preferencias | `setMode`, `setSource` |

### Invariantes que deben tener tests

- `toCounts()` devuelve exactamente 10 números y su suma es el total de cartas que quedan, **incluyendo la carta oculta del dealer** mientras no se revele.
- Al repartir o marcar una carta visible, el conteo de su rango baja en 1. Nunca puede quedar negativo; en modo manual, ingresar una carta agotada muestra un error.
- `revealHole` descuenta la carta oculta del zapato en ese momento, no antes.
- Toda acción que cambia cartas o reglas incrementa `shoeStore.version`.
- `analysisStore.receive` ignora cualquier resultado cuya `version` no sea la actual.

## Integración con el motor

El motor (paquete `@bj/engine-wasm`) corre dentro de un Web Worker para que la interfaz nunca se congele. El front solo envía el estado y muestra lo que vuelve.

&#91;embedded content: flujo de datos · de la acción al panel\]

Cada pedido lleva la `version` del estado; si el usuario cambió algo mientras se calculaba, el resultado viejo se descarta.

### Contrato (`src/engine/contract.ts`)

Estos tipos deben ser **idénticos** a los que exporta el motor. Lo ideal es generarlos desde Rust (con `tsify` o `ts-rs`) en lugar de escribirlos a mano.

```ts
export type Action = 'stand' | 'hit' | 'double' | 'split' | 'surrender';

export interface AnalyzeHandRequest {
  version: number;
  rules: Rules;
  shoe: number[];          // 10 conteos [A,2..9,T]; INCLUYE la carta oculta del dealer
  hand: RankIndex[];       // cartas de la mano que se está jugando
  dealerUp: RankIndex;
  splitHandsSoFar: number; // 1 si no se dividió
  isSplitAces: boolean;
  allowed: { double: boolean; split: boolean; surrender: boolean };
}

export interface ActionResult {
  action: Action;
  ev: number;      // en unidades de la apuesta inicial (-1 a +2; split puede ser más)
  pWin: number;    // 0..1
  pPush: number;
  pLose: number;
  exact: boolean;  // false = aproximado (dividir)
}

export interface DealerDistribution {
  p17: number; p18: number; p19: number; p20: number; p21: number;
  pBlackjack: number; pBust: number;   // suman 1
}

export interface AnalyzeHandResponse {
  version: number;
  actions: ActionResult[];   // solo las acciones permitidas
  best: Action;              // mayor EV
  pBustOnHit: number;        // prob. de pasarse con UNA carta más
  dealer: DealerDistribution;// condicionada al peek cuando aplica
  computeMs: number;
}

export interface AnalyzeDealerRequest {
  version: number; rules: Rules; shoe: number[];
  up: RankIndex;
  hole?: RankIndex;          // solo si el usuario (como dealer) la conoce
}

export interface AnalyzeRoundRequest {
  version: number; rules: Rules; shoe: number[];
  up: RankIndex;
  hands: RankIndex[][];      // todas las manos de jugadores en la mesa
}

export interface EngineApi {
  analyzeHand(r: AnalyzeHandRequest): Promise<AnalyzeHandResponse>;
  analyzeDealer(r: AnalyzeDealerRequest): Promise<{ version: number; dealer: DealerDistribution; computeMs: number }>;
  analyzeRound(r: AnalyzeRoundRequest): Promise<{ version: number; hands: AnalyzeHandResponse[]; houseEdgeRound: number }>;
}
```

Para **dividir**, `ev` es el total de las dos manos y `pWin`/`pPush`/`pLose` se reportan por mano. Las cartas de la otra mano dividida ya están fuera de `shoe`.

### Comportamiento de `client.ts`

- **Debounce** de 50 ms para agrupar cambios rápidos (por ejemplo, repartir dos cartas).
- **Cola de un solo pedido**: si llega un estado nuevo mientras el worker calcula, se guarda solo el último y se envía al terminar el actual.
- **Timeout** de 5 s: la UI muestra "Calculando…" con opción de cancelar, que reinicia el worker.
- **Modo remoto opcional**: con `VITE_ENGINE_MODE=api` el cliente usa `fetch` contra la API (`POST /api/v1/analyze/hand`, mismo contrato). Por defecto es `wasm`.

## Modo jugador y modo dealer

Los dos modos usan la misma mesa, el mismo zapato y el mismo motor; solo cambia qué se le pregunta al motor y qué panel se muestra. El cambio se hace con un `ModeSwitch` siempre visible y no reinicia el zapato.

### Modo jugador

Objetivo: decirle al usuario qué hacer con su mano y por qué.

- Llama a `analyzeHand` cada vez que cambia la mano activa, la carta visible del dealer o el zapato.
- **Panel de acciones**: una fila por acción permitida con EV (en % de la apuesta, con signo), % ganar, % empatar y % perder. La de mayor EV queda resaltada con la etiqueta "Recomendada".
- Si dividir viene con `exact: false`, la fila muestra la marca "≈ aproximado" con un tooltip que explica por qué.
- **Medidor de riesgo**: probabilidad de pasarse si pide una carta (`pBustOnHit`).
- **Panel del dealer**: distribución de su total final según su carta visible, ya condicionada al peek.
- Con varias manos tras dividir, el análisis siempre corresponde a la mano activa, que se marca visualmente.
- Botones Pedir, Plantarse, Doblar, Dividir y Rendirse. En simulación ejecutan la acción; el usuario puede ignorar la recomendación.
- Opcional: comparación "tu decisión vs. la óptima" con el EV perdido acumulado de la sesión.

### Modo dealer

Objetivo: entender cómo terminará la mano del dealer y cuánto gana la casa en esa ronda. El dealer no decide: sigue reglas fijas.

- Llama a `analyzeDealer` (y a `analyzeRound` cuando hay manos de jugadores en la mesa).
- **Distribución final**: barras para 17, 18, 19, 20, 21, blackjack y pasarse, con su %.
- **Carta oculta**: interruptor "Conozco mi carta oculta". Encendido, el análisis se condiciona a ambas cartas; apagado, solo a la visible.
- **Juego guiado**: el botón "Siguiente carta del dealer" solo hace lo que las reglas obligan (pedir con 16 o menos, plantarse según S17/H17). Antes de cada carta se muestra la probabilidad de pasarse con ella.
- **Ventaja de la casa en la ronda**: `houseEdgeRound` de `analyzeRound`, asumiendo que cada jugador juega de forma óptima.

### Fuente de cartas

| Fuente | Cómo llegan las cartas | Uso típico |
| --- | --- | --- |
| Simulación | La app reparte de un zapato barajado con Fisher-Yates y `crypto.getRandomValues`; rebaraja al llegar a la penetración configurada | Practicar y aprender |
| Análisis manual | El usuario toca las cartas en un selector de 13 rangos y elige a quién van (jugador, dealer, otra mano o "descartada") | Analizar una mesa real o un caso puntual |

En ambos casos, el `ShoeEditor` permite revisar y corregir los conteos que quedan. Toda corrección sube la `version` y dispara un nuevo cálculo.

## Componentes y diseño

La pantalla se divide en tres zonas: la mesa al centro, el panel de análisis a la derecha (abajo en móvil) y una barra superior con modo, reglas y estado del zapato.

| Componente | Responsabilidad |
| --- | --- |
| `Table` | Fieltro, posiciones del dealer y de hasta 7 manos |
| `Card` | Muestra una carta; volteo animado para la carta oculta |
| `Hand` | Cartas + total ("17 suave", "Blackjack", "Se pasó"); marca la mano activa |
| `ActionPanel` | Tabla de acciones con EV y probabilidades; resalta la mejor |
| `ProbBar` | Barra apilada ganar / empatar / perder con valores en texto |
| `HitBustMeter` | Probabilidad de pasarse con la siguiente carta |
| `DealerOutcomeChart` | Barras de 17 a 21, blackjack y pasarse |
| `HouseEdgePanel` | Ventaja de la casa en la ronda (modo dealer) |
| `ShoeEditor` | Grilla de 13 rangos con conteos que quedan; editable en modo manual |
| `ShoeHud` | Cartas y mazos restantes, penetración, botón de rebarajar |
| `RulesPanel` | Reglas y presets; un cambio pide confirmación porque reinicia el zapato |
| `ModeSwitch` | Jugador / Dealer y Simulación / Manual |

### Pautas visuales

- Tema oscuro con fieltro verde; los paneles usan fondo neutro para que los números se lean bien.
- EV positivo en verde y negativo en rojo, **siempre acompañado del signo y el número**: el color nunca es la única señal.
- Formato `es-PE`: EV como "+3,45 %" de la apuesta, probabilidades con dos decimales ("42,17 %"). Nunca redondear a enteros: diferencias de 0,1 % cambian decisiones.
- Mientras el motor calcula, los números anteriores se atenúan y aparece un indicador; nunca se muestran como si fueran del estado actual.
- Responsive desde 360 px de ancho; atajos de teclado en escritorio (H pedir, S plantarse, D doblar, P dividir, R rendirse).
- Accesible: contraste AA, botones con `aria-label` y anuncios del resultado con una región `aria-live`.

## Testing y criterios de aceptación

Los tests del front verifican dos cosas: que el estado que se envía al motor es exactamente el de la mesa, y que la UI muestra exactamente lo que el motor devuelve. La exactitud matemática se prueba en el motor (ver doc de backend).

### Tests unitarios (Vitest)

- `domain/`: totales de mano (duros, suaves, blackjack natural vs. 21 tras dividir), conversión de caras a `RankIndex`, barajado sin sesgo (prueba estadística sobre muchas barajadas).
- `shoeStore`: descuentos, conteos que nunca quedan negativos, carta oculta incluida en `toCounts()` hasta revelarse, `version` que sube en cada cambio.
- `analysisStore`: un resultado con `version` vieja se ignora.
- Componentes: `ActionPanel` resalta la acción con mayor EV, muestra "≈ aproximado" cuando `exact` es `false` y formatea en `es-PE`.

### Tests E2E (Playwright, con el WASM real)

- Modo manual, 1 mazo: ingresar 10 y 6 para el jugador y 10 para el dealer. La UI debe mostrar los mismos números que devuelve el motor para ese estado (comparar contra un fixture generado por el motor).
- Quitar todas las cartas de valor 10 del zapato y verificar que el panel se recalcula y cambia.
- Cambiar de modo jugador a dealer y volver sin perder cartas ni el zapato.
- Dividir un par y comprobar que el análisis sigue a la mano activa.

### Criterios de aceptación

- [ ] No hay ninguna probabilidad, EV ni tabla de estrategia escrita a mano en `web/src` (revisión de código + regla de ESLint que prohíba importar tablas de estrategia).
- [ ] Toda carta visible se descuenta del zapato antes del cálculo; la carta oculta solo al revelarse.
- [ ] Nunca se muestra un resultado de una `version` anterior como actual.
- [ ] La recomendación es siempre la acción de mayor EV que devuelve el motor.
- [ ] Los valores aproximados están marcados en la UI.
- [ ] El cambio jugador ↔ dealer conserva mesa y zapato.
- [ ] La UI sigue respondiendo mientras el motor calcula (el cálculo nunca corre en el hilo principal).

## Plan de implementación para Claude Code

Construir en este orden; cada fase termina con sus tests en verde antes de pasar a la siguiente. Las fases 1 y 2 pueden avanzar en paralelo con el motor usando un **mock** del contrato, pero ese mock debe devolver valores obviamente falsos (por ejemplo, todo en 0) para que nunca se confunda con datos reales.

1. **Base del proyecto**: monorepo con pnpm, `web/` con Vite + React + TypeScript strict, Tailwind, ESLint, Prettier, Vitest y Playwright configurados.
2. **Dominio y estado**: `domain/` (cartas, totales, zapato, reglas, barajado) y los cinco stores con sus invariantes testeadas.
3. **Mesa jugable sin análisis**: `Table`, `Card`, `Hand`, reparto en modo simulación, acciones del jugador y juego automático del dealer según reglas.
4. **Conexión con el motor**: `contract.ts` generado desde Rust, `engine.worker.ts` con Comlink, `client.ts` con versión, debounce, cola y timeout. Requiere que el motor exponga `analyzeHand` (doc de backend, fase del binding WASM).
5. **Modo jugador**: `ActionPanel`, `ProbBar`, `HitBustMeter`, panel del dealer y manejo de manos divididas.
6. **Modo manual y ShoeEditor**: selector de 13 rangos, asignar cartas a jugador / dealer / otras manos / descarte, corrección de conteos.
7. **Modo dealer**: `DealerOutcomeChart`, interruptor de carta oculta, juego guiado del dealer y `HouseEdgePanel` con `analyzeRound`.
8. **Reglas y presets**: `RulesPanel` con confirmación de reinicio del zapato.
9. **Pulido**: animaciones, responsive, atajos de teclado, accesibilidad y tests E2E completos.
10. **Opcional**: modo remoto contra la API y EV perdido acumulado por sesión.

Al pasarle este documento a Claude Code, pídele trabajar fase por fase y entregar al final de cada una los tests que la validan.
