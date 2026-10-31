import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: 'web',
  base: '/static/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: {
        renderer: resolve(import.meta.dirname, 'web/renderer.html'),
        studio: resolve(import.meta.dirname, 'web/src/studio.css'),
      },
    },
  },
});
