import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base path ensures seamless hosting on GitHub Pages (project subpaths) and locally
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
