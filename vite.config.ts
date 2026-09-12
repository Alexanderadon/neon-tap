import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { realpathSync } from 'node:fs';

/**
 * Root pinned to the on-disk (case-exact) path. On Windows the shell may report `E:\Projects`
 * while the volume spells it `E:\projects`; Vite keys the inline `<style>` of index.html by
 * `root` but resolves the import through realpath, and the mismatch breaks the build.
 */
const root = realpathSync.native(fileURLToPath(new URL('.', import.meta.url)));

export default defineConfig({
  root,
  plugins: [react()],
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
    include: ['src/**/*.test.ts', 'api/_lib/**/*.test.ts', 'scripts/lib/**/*.test.ts'],
  },
});
