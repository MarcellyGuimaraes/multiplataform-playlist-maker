import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { devApi } from './scripts/vite-dev-api.ts';

export default defineConfig({
  plugins: [react(), devApi()],
  test: {
    environment: 'node',
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.vercel', '.dev-db'],
  },
});
