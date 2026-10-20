// Genera los fixtures de los E2E llamando al motor WASM real desde Node.
// Los E2E comparan lo que muestra la UI con lo que devuelve el motor para el mismo estado.
//
//   npm run e2e:fixtures
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initSync, analyzeHand } from '@bj/engine-wasm';
// Node 24 ejecuta TypeScript sin tipos: usamos los presets reales de la app.
import { presetRules } from '../src/domain/rules.ts';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wasm = readFileSync(require.resolve('@bj/engine-wasm/engine_wasm_bg.wasm'));
initSync({ module: wasm });

const rules = { ...presetRules('vegas'), decks: 1 };
const fullDeck = () => [4, 4, 4, 4, 4, 4, 4, 4, 4, 16];
const minus = (...ranks) => {
  const s = fullDeck();
  for (const r of ranks) s[r]--;
  return s;
};

const fixtures = {
  rules,
  // Manual, 1 mazo: jugador 10 y 6, dealer K (rango 9).
  hard16vs10: analyzeHand({
    version: 1,
    rules,
    shoe: minus(9, 5, 9),
    hand: [9, 5],
    dealerUp: 9,
    splitHandsSoFar: 0,
    isSplitAces: false,
    allowed: { double: true, split: false, surrender: true },
  }),
  // 8,8 vs 6 dividido: mano 1 = 8,3 y mano 2 = 8,2 (las cartas de la otra mano ya salieron).
  split1: analyzeHand({
    version: 1,
    rules,
    shoe: minus(7, 7, 5, 2),
    hand: [7, 2],
    dealerUp: 5,
    splitHandsSoFar: 1,
    isSplitAces: false,
    allowed: { double: true, split: false, surrender: false },
  }),
  split2: analyzeHand({
    version: 1,
    rules,
    shoe: minus(7, 7, 5, 2, 1),
    hand: [7, 1],
    dealerUp: 5,
    splitHandsSoFar: 1,
    isSplitAces: false,
    allowed: { double: true, split: false, surrender: false },
  }),
};

const out = join(root, 'e2e', 'fixtures', 'engine.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(fixtures, null, 2) + '\n');
console.log(`Fixtures del motor escritos en ${out}`);
