import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import react from '@vitejs/plugin-react';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Build de biblioteca: um único entry ESM (`dist/lib/index.js`) com React, ReactDOM e Zod como
 * peer dependencies — quem consome traz a própria versão. Os tipos saem do tsc (tsconfig.lib.json).
 */
export default {
  plugins: [react()],
  build: {
    outDir: 'dist/lib',
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: resolve(here, 'src/lib/index.ts'),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'zod'],
    },
  },
};
