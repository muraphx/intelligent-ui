import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';

/** Prova visual de que um projeto externo consegue usar a biblioteca: print do exemplo real. */
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--config', 'examples/minimal/vite.config.ts'], { stdio: 'ignore', windowsHide: true });
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error('O dev server do exemplo não iniciou.');
    try { ready = (await fetch('http://127.0.0.1:4300')).ok; } catch { /* aguarda o servidor */ }
    if (ready) break;
    await delay(300);
  }
  assert.ok(ready, 'O exemplo não ficou disponível na porta 4300.');
  await mkdir('docs', { recursive: true });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1180, height: 900 }, reducedMotion: 'reduce' });
  const problems = [];
  page.on('pageerror', error => problems.push(error.message));
  page.on('console', message => { if (message.type() === 'error') problems.push(message.text()); });
  await page.goto('http://127.0.0.1:4300');
  await page.getByText('Componentes seus', { exact: true }).waitFor();
  await page.screenshot({ path: 'docs/screenshot-example.png', fullPage: true });
  await page.getByRole('button', { name: 'Gerar a próxima interface' }).click();
  await page.getByText('A ação voltou ao provider', { exact: false }).waitFor();
  await page.screenshot({ path: 'docs/screenshot-example-action.png', fullPage: true });
  assert.equal(problems.length, 0, `Console com erros: ${problems.join(' | ')}`);
  console.log('PASS: exemplo do consumidor renderizou, a ação trocou a interface e o console está limpo.');
} finally {
  await browser?.close();
  server.kill();
}
