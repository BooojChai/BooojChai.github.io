import { defineConfig } from 'vite';

export default defineConfig({
  base: '/', // user GitHub Pages root (username.github.io) so root slash is fine
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2019'
  }
});
