import { defineConfig } from 'vite';

export default defineConfig({
  // Cirro tools are served from the app's base path within the Cirro iframe
  base: './',
  build: {
    outDir: 'dist-cirro',
    sourcemap: true,
    rollupOptions: {
      input: 'cirro.html',
    },
  },
});
