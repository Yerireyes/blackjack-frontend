/// <reference types="vitest/config" />
import { realpathSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// En desarrollo y en vista previa la API va por el mismo origen que el front. En producción
// la propia API sirve dist/ (imagen Docker del backend en Render). `ws` deja pasar
// el WebSocket de las salas (/api/v1/rooms/{code}/ws).
const apiProxy = { '/api': { target: 'http://127.0.0.1:8080', ws: true } };
// Enlaces temporales de Cloudflare Tunnel (cloudflared tunnel --url …) para jugar con amigos.
const allowedHosts = ['.trycloudflare.com'];

// El motor WASM se enlaza con file: desde el backend, fuera de esta carpeta. Sin permitir su
// ruta real, el servidor de desarrollo responde 403 al .wasm y no hay análisis.
function enginePkg(): string[] {
  try {
    return [
      realpathSync(fileURLToPath(new URL('./node_modules/@bj/engine-wasm', import.meta.url))),
    ];
  } catch {
    return []; // sin npm install todavía: el error aparece al importar el motor
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  worker: { format: 'es' },
  // El paquete WASM se enlaza con file:, Vite no debe pre-empaquetarlo.
  optimizeDeps: { exclude: ['@bj/engine-wasm'] },
  server: {
    port: 5180,
    strictPort: true,
    // La API va por el mismo origen: la cookie de sesión (SameSite=Lax) y la
    // vuelta del login con Google funcionan sin CORS entre localhost y 127.0.0.1.
    proxy: apiProxy,
    allowedHosts,
    fs: { allow: ['.', ...enginePkg()] },
  },
  // `npm run preview` (y los E2E, en el 4173) también llegan a la API.
  preview: { proxy: apiProxy, allowedHosts },
  test: {
    // Lógica en node (rápido); los componentes declaran jsdom con @vitest-environment.
    environment: 'node',
    globals: true,
    testTimeout: 15_000,
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
