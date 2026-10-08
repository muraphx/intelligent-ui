import { copyFileSync, mkdirSync } from 'node:fs';

/**
 * O pacote publica o CSS de tokens junto do JS: quem consome importa `intelligent-ui/styles.css`
 * e ganha os nomes de token + o mapeamento do shadcn, compilando as classes com o próprio Tailwind.
 */
mkdirSync('dist/lib', { recursive: true });
copyFileSync('src/styles/tailwind.css', 'dist/lib/styles.css');
console.log('dist/lib/styles.css copiado.');
