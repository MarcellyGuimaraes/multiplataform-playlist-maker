import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { devApi } from './scripts/vite-dev-api.ts';

export default defineConfig({
  plugins: [react(), devApi()],
  test: {
    environment: 'node',
    // Inicializar o PGlite (Postgres em WASM) pode passar de 10 s com a suíte rodando em paralelo.
    hookTimeout: 30_000,
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.vercel', '.dev-db'],
  },
});
