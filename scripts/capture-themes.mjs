import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';

/** Captura real do app: um print por design system e um por resposta (que traz o próprio sistema). */
const presets = ['Papel', 'Terminal', 'Brutal', 'Clínico', 'Noturno'];
const demos = ['Análise de receita', 'Calculadora', 'Cartão de perfil'];
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4174', '--strictPort'], { stdio: 'ignore', windowsHide: true });
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (server.exitCode !== null) throw new Error('O preview não iniciou. Rode npm run build antes.');
    try { ready = (await fetch('http://127.0.0.1:4174')).ok; } catch { /* aguarda o preview */ }
    if (ready) break;
    await delay(250);
  }
  assert.ok(ready, 'Preview não ficou disponível.');
  await mkdir('docs', { recursive: true });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1512, height: 1180 }, reducedMotion: 'reduce' });
  const problems = [];
  page.on('pageerror', error => problems.push(error.message));
  page.on('console', message => { if (message.type() === 'error') problems.push(message.text()); });
  await page.goto('http://127.0.0.1:4174');
  await page.getByText('Resposta pronta', { exact: true }).waitFor();

  for (const name of presets) {
    await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
    await delay(320);
    await page.screenshot({ path: `docs/screenshot-system-${name.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}.png`, fullPage: true });
  }
  // Uma resposta por demo: cada spec traz o design system que escolheu.
  const declared = [];
  for (const title of demos) {
    await page.getByRole('button', { name: new RegExp(`^${title}`) }).click();
    await page.getByText('Resposta pronta', { exact: true }).waitFor();
    await delay(260);
    const badge = await page.locator('.system-choice').first().innerText().catch(() => '');
    declared.push(`${title} -> ${badge || '(sem sistema declarado)'}`);
    await page.locator('.generated-surface').screenshot({ path: `docs/screenshot-surface-${title.split(' ')[0].toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}.png` });
  }
  assert.equal(problems.length, 0, `Console com erros: ${problems.join(' | ')}`);
  console.log('PASS: 5 sistemas capturados, 3 superfícies capturadas, console limpo.');
  console.log('Sistema declarado por resposta:'); declared.forEach(line => console.log('  ' + line));
} finally {
  await browser?.close();
  server.kill();
}
