/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  worker: { format: 'es' },
  // El paquete WASM se enlaza con file:, Vite no debe pre-empaquetarlo.
  optimizeDeps: { exclude: ['@bj/engine-wasm'] },
  server: { port: 5180, strictPort: true },
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
