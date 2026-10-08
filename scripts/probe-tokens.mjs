import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

/** Diagnóstico: onde cada token resolve (raiz da aplicação x container da superfície). */
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4177', '--strictPort'], { stdio: 'ignore', windowsHide: true });
let browser;
try {
  for (let attempt = 0; attempt < 40; attempt++) {
    try { if ((await fetch('http://127.0.0.1:4177')).ok) break; } catch { /* aguarda */ }
    await delay(250);
  }
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1512, height: 1180 } });
  await page.goto('http://127.0.0.1:4177');
  await page.getByText('Resposta pronta', { exact: true }).waitFor();
  // App no preset Terminal (escuro). A resposta declara Papel — devem ser escopos distintos.
  await page.locator('.ds-preset').nth(1).click();
  await delay(400);
  const data = await page.evaluate(() => {
    const probe = (node) => {
      if (!node) return null;
      const style = getComputedStyle(node);
      return {
        classe: (node.getAttribute('class') ?? '').slice(0, 60),
        color: style.color,
        background: style.backgroundColor,
        '--surface': style.getPropertyValue('--surface').trim(),
        '--text': style.getPropertyValue('--text').trim(),
        '--color-card': style.getPropertyValue('--color-card').trim(),
        '--color-foreground': style.getPropertyValue('--color-foreground').trim(),
        '--accent-on': style.getPropertyValue('--accent-on').trim(),
        '--color-primary-foreground': style.getPropertyValue('--color-primary-foreground').trim(),
        '--radius': style.getPropertyValue('--radius').trim(),
      };
    };
    const surface = document.querySelector('.generated-surface');
    const heading = surface.querySelector('h2');
    return {
      raiz: probe(document.documentElement),
      container: probe(surface),
      cartao: probe(heading.closest('[data-slot="card"]') ?? heading.parentElement),
      titulo: probe(heading),
      selo: probe(surface.querySelector('[data-slot="badge"]') ?? surface.querySelector('span.inline-flex')),
    };
  });
  console.log(JSON.stringify(data, null, 1));
} finally {
  await browser?.close();
  server.kill();
}
