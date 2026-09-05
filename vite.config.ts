import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { localTracksPlugin } from './scripts/vite-local-tracks';

export default defineConfig({
  // localTracksPlugin: dev-only `public/local` (npm run assets:local) — stripped from dist/, served in preview.
  plugins: [react(), localTracksPlugin()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: { react: ['react', 'react-dom'] },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'api/_lib/**/*.test.ts'],
  },
});
