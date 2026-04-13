import { defineConfig } from 'vite';

export default defineConfig({
  base: '/newick-viewer/',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: 'node',
    exclude: ['e2e/**', 'node_modules/**'],
  },
});
