# Blackjack Guide — Frontend

SPA en React que muestra, para cada mano, el EV y las probabilidades exactas de cada acción
(pedir, plantarse, doblar, dividir, rendirse). Todos los números los calcula el motor de
`../Backend` compilado a WebAssembly y ejecutado en un Web Worker. Diseño completo en
[docs/Blackjack Guide — Arquitectura Frontend.md](docs/).

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
- No hacen falta PostgreSQL, `sqlx-cli` ni la API: el front solo usa el motor WASM.

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

# 3. Solo para los tests E2E: descargar el navegador de Playwright (una vez)
npx playwright install chromium
npm run e2e
```

Si el puerto 5180 está ocupado, cámbialo en `vite.config.ts` (`server.port`). Los E2E usan su
propio servidor de vista previa, en el 4173.

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
| `src/store/` | Zustand: `rules`, `shoe`, `table`, `analysis`, `ui`, `session`; `actions.ts` coordina reinicios. |
| `src/features/` | `player-mode`, `dealer-mode`, `shoe-tracker`, `manual-entry`, `settings`, `table`, `analysis`. |
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
- Fuera de alcance: modo remoto contra la API, cuentas y sesiones guardadas, seguro.

## Atajos de teclado

H pedir · S plantarse · D doblar · P dividir · R rendirse · Enter repartir.
En modo manual: A, 2–9, 0 (= 10), J, Q, K agregan la carta al destino elegido; Retroceso deshace.
