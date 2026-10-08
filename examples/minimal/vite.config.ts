import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Um projeto externo consome a biblioteca pelo seu entry público.
 * Num repositório real isto seria `import ... from 'intelligent-ui'` vindo do npm.
 */
export default defineConfig({
  root: here,
  plugins: [react(), tailwindcss()],
  resolve: { alias: { 'intelligent-ui': resolve(here, '../../src/lib/index.ts'), '@': resolve(here, '../../src') } },
  server: { port: 4300, strictPort: true, host: '127.0.0.1' },
  build: { outDir: resolve(here, 'dist'), emptyOutDir: true },
});
