# Blackjack Guide — Frontend

SPA en React que muestra, para cada mano, el EV y las probabilidades exactas de cada acción
(pedir, plantarse, doblar, dividir, rendirse). Todos los números los calcula el motor de
`../Backend` compilado a WebAssembly y ejecutado en un Web Worker. Diseño completo en
[docs/Blackjack Guide — Arquitectura Frontend.md](docs/).

El modo **Práctica** funciona sin cuenta y sin servidor. Las **cuentas** (registro, login,
Google) y el modo **Casual** (partidas de 500 fichas contra el servidor, con ranking semanal)
usan la API del backend. Ranked está en desarrollo.

## Documentación compartida con el backend

La especificación de cuentas, Casual y Ranked, y lo que le toca hacer al front en cada fase,
viven **solo** en el backend. El front no guarda copias:

- [Especificación — Cuentas, Casual y Ranked](../Backend/docs/Especificación%20—%20Cuentas,%20Casual%20y%20Ranked.md)
- `../Backend/docs/Front — Fase N …`: qué implementar en el front en cada fase. Cada una empieza
  con su fecha y la lista de cambios respecto de la versión anterior.

## Regla de oro

El front **nunca** calcula ni escribe a mano una probabilidad o un EV. Toda carta visible se
descuenta del zapato antes de pedir un cálculo; la oculta del dealer solo al revelarse. Cada
cambio de cartas o reglas sube `shoeStore.version` y los resultados de versiones viejas se
descartan o se muestran atenuados, nunca como actuales.

## Requisitos

- **Node 22.18 o superior** (probado con 24) y npm. Vitest exige Node 22.12+, y
  `npm run e2e:fixtures` ejecuta TypeScript directamente con Node (22.18+).
- **Git.**
- **El motor compilado a WebAssembly.** `engine-wasm/pkg` no se sube a git (está en el
  `.gitignore` del backend), así que en cada computadora nueva hay que compilarlo. Para eso se
  necesita:
  - [Rust](https://rustup.rs) estable con el target WASM: `rustup target add wasm32-unknown-unknown`.
  - En Windows, un linker para el host: Visual Studio Build Tools (toolchain MSVC, la de
    `rustup` por defecto) o el toolchain `x86_64-pc-windows-gnu` con MinGW-w64 en el `PATH`.
    El segundo es el que se usó en la máquina original; el detalle está en el README del backend.
  - [wasm-pack](https://rustwasm.github.io/wasm-pack/): `cargo install wasm-pack`. En Windows
    necesita el Visual C++ Redistributable x64. La primera compilación descarga `wasm-opt`, así
    que hace falta internet.
- **Solo para las cuentas:** PostgreSQL y la API del backend corriendo (ver su README). Sin
  ellas la app funciona igual en modo Práctica, y el botón de cuenta muestra que el servidor no
  está disponible.

El front enlaza el motor como dependencia local
(`"@bj/engine-wasm": "file:../Backend/engine-wasm/pkg"`), y el script del contrato del backend
escribe en `../Frontend`. Por eso los dos repositorios deben estar **en la misma carpeta y con
estos nombres exactos**:

```text
Blackjack/
├── Backend/    ← https://github.com/Yerireyes/blackjack-backend
└── Frontend/   ← este repositorio
```

## Instalación en una computadora nueva

```sh
mkdir Blackjack && cd Blackjack
git clone https://github.com/Yerireyes/blackjack-backend.git Backend
git clone https://github.com/Yerireyes/blackjack-frontend.git Frontend

# 1. Compilar el motor (antes del npm install del front: sin esto, la instalación falla)
cd Backend
npm run build:wasm

# 2. Instalar y arrancar el front
cd ../Frontend
npm install
npm run dev                          # http://localhost:5180

# 3. Opcional, para las cuentas: base de datos y API (en otra terminal)
cd ../Backend
npm run db:start
npm run api                          # http://127.0.0.1:8080

# 4. Solo para los tests E2E: descargar el navegador de Playwright (una vez)
cd ../Frontend
npx playwright install chromium
npm run e2e
```

Si el puerto 5180 está ocupado, cámbialo en `vite.config.ts` (`server.port`). Los E2E usan su
propio servidor de vista previa, en el 4173.

### Cómo llega el front a la API

Siempre con URLs relativas (`/api/v1/...`) y `credentials: 'same-origin'`: front y API
comparten origen, y la sesión es una cookie httpOnly que el front nunca lee. En desarrollo y en
vista previa lo resuelve el proxy de `vite.config.ts` (`/api` → `127.0.0.1:8080`); en
producción, el reverse proxy que sirve `dist/` y reenvía `/api` (ejemplos en el README del
backend).

## Comandos

```sh
npm install
npm run dev            # http://localhost:5180
npm run build          # typecheck + build de producción en dist/
npm test               # Vitest (dominio, stores, pedidos al motor, cliente, componentes)
npm run e2e            # Playwright con el WASM real (escritorio + móvil)
npm run e2e:fixtures   # regenera e2e/fixtures/engine.json llamando al motor desde Node
npm run contract       # regenera src/engine/contract.ts desde los structs de Rust
npm run lint           # ESLint (prohíbe importar tablas de estrategia)
npm run format         # Prettier
```

Tras recompilar el motor: `npm run contract && npm run e2e:fixtures && npm install` (para
copiar el paquete nuevo) y luego los tests.

## Estructura

| Carpeta | Qué hay |
| --- | --- |
| `src/domain/` | Cartas, totales de mano, zapato, reglas y presets, barajado Fisher-Yates con `crypto`. Sin probabilidades. |
| `src/engine/` | `contract.ts` (generado), worker con Comlink, `client.ts` (debounce 50 ms, cola de un pedido, aviso a los 5 s, cancelar), `requests.ts` (mesa → pedido, funciones puras), `sync.ts` (stores → motor, bots y dealer automático). |
| `src/store/` | Zustand: `rules`, `shoe`, `table`, `analysis`, `ui`, `session`, `chips`; `actions.ts` coordina reinicios. |
| `src/features/` | `player-mode`, `dealer-mode`, `shoe-tracker`, `manual-entry`, `settings`, `table`, `analysis`, `chips`. |
| `src/api/` | Cliente HTTP de la API del backend (aparte de `src/engine/api.ts`, que es el motor WASM): URLs relativas, mismo origen, errores `{ code, message }`. |
| `src/account/` | Cuentas: store de sesión, diálogos de login, registro y perfil, vincular y desvincular Google, vuelta de Google. |
| `src/play/` | Lo común a Casual, Ranked y el reto diario: rutas `/play/*`, la ronda tal como la manda el servidor (`RoundView`), la revelación animada, las claves de idempotencia, la pila de la próxima apuesta, las piezas de la mesa y la revisión de decisiones. |
| `src/casual/` | Casual: la partida (crear, retirarse), la mesa con las ayudas del motor, el ranking semanal y los récords. |
| `src/ranked/` | Ranked: la cuenta de la temporada, la mesa sin ayudas, la revisión de cada decisión al terminar la mano, la recarga a 100, el ranking por temporada con medallas y tus temporadas. |
| `src/daily/` | Reto diario: el intento de hoy (un solo intento, 30 manos, el mismo zapato para todos), la mesa sin ayudas con el contador de manos y la revisión, el resultado al terminar y el ranking del día. |
| `src/progress/` | Logros y cosméticos: los avisos de logro nuevo al terminar cada ronda, la racha de decisiones óptimas junto a la revisión, la pantalla de logros y la apariencia de la mesa (paño, dorso, fichas y título), que se aplica en todos los modos. Los otorga y guarda el servidor. |
| `src/app/` | Raíz de la interfaz: pantalla de inicio (Casual, Ranked, Reto diario, Practicar, Logros, Ajustes), mesa con su cabecera, ajustes del navegador (sonido, volumen, animaciones) y la dirección de cada pantalla (`#/casual`, `#/ranked`, `#/reto`, `#/practicar`, `#/logros`). |
| `src/lib/sound.ts` | Efectos de sonido sintetizados con Web Audio (sin archivos). |
| `src/components/` | Carta, mano, barra de probabilidades, controles segmentados, diálogo. |
| `e2e/` | Specs de Playwright y fixtures generados por el motor. |

## Decisiones respecto del documento

- **Sin monorepo pnpm**: el front vive en la raíz de `Frontend/` como proyecto npm independiente,
  igual que el backend.
- **Formato numérico**: coma decimal y `%` con espacio fino ("+3,45 %"), como en los ejemplos
  del documento. El CLDR de `es-PE` usa punto decimal, así que se formatea con `es-ES`.
- **Modo dealer**: el backend se extendió con `analyzeDealer.drawn` y `pBustNext` para mostrar,
  con números del motor, la probabilidad de pasarse antes de cada carta del dealer y la
  distribución final cuando ya tiene 3 o más cartas.
- **Otras manos en simulación**: 0 a 6 asientos que juegan la acción de mayor EV del motor
  (no dividen, para simplificar la mesa).
- **Ventaja de la casa**: `analyzeRound` se pide mientras juegan los jugadores, con las manos
  vivas actuales.
- **Modo dealer en simulación**: la cámara pasa detrás del repartidor y tu asiento lo juega el
  motor (acción de mayor EV, con división). El usuario hace de dealer con el juego guiado.
- **Fichas (Práctica)**: dos bancas guardadas en el navegador, la tuya y la de la casa (modo
  dealer). Fichas de 10, 50, 100 y 500; hasta 10 fichas y 500 por apuesta; tope de 1.000.000
  por banca. Doblar y dividir solo si el saldo lo cubre. En Casual el saldo lo lleva el
  servidor y el front solo arma la pila con el tope que este indica.
- **Blackjack del dealer con peek**: la ronda no se liquida al repartir; la oculta se revela a
  la vista tras una pausa y un mensaje explica por qué no hubo decisión.
- **Casual**: el front no reparte, no liquida ni guarda el saldo. Cada respuesta del servidor
  (`RoundView`) reemplaza el estado; las ayudas del motor usan su `shoeCounts`. Una clave de
  idempotencia por intención, reutilizada solo para reintentar. Al entrar se retoma la ronda
  activa.
- Fuera de alcance por ahora: Ranked y seguro.

## Atajos de teclado

H pedir · S plantarse · D doblar · P dividir · R rendirse · Enter repartir.
En modo dealer con simulación, H/S/D/P/R no hacen nada: la mano del jugador la juega el motor.
En modo manual: A, 2–9, 0 (= 10), J, Q, K agregan la carta al destino elegido; Retroceso deshace.
