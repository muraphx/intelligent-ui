import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Build de biblioteca: um único entry ESM (`dist/lib/index.js`) com React, ReactDOM e Zod como
 * peer dependencies — quem consome traz a própria versão. Os tipos saem do tsc (tsconfig.lib.json).
 * O CSS de tokens (`styles.css`) é copiado à parte: quem consome compila as classes com o próprio
 * Tailwind, mas os nomes de token e o mapeamento do shadcn vêm do pacote.
 */
export default {
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': resolve(here, 'src') } },
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
      external: [
        'react', 'react-dom', 'react/jsx-runtime', 'zod',
        // A base de componentes sai como dependência declarada: quem consome instala junto do pacote.
        'radix-ui', 'lucide-react', 'class-variance-authority', 'clsx', 'tailwind-merge',
      ],
    },
  },
};
