import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], { stdio: 'inherit', windowsHide: true });
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (server.exitCode !== null) throw new Error('O preview não iniciou. Execute npm run build e libere a porta 4173.');
    try { ready = (await fetch('http://127.0.0.1:4173')).ok; } catch { /* Wait for the child process. */ }
    if (ready) break;
    await delay(250);
  }
  assert.ok(ready, 'Preview não ficou disponível.');
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1512, height: 1180 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('http://127.0.0.1:4173');
  await page.getByText('Resposta pronta', { exact: true }).waitFor();
  await mkdir('docs', { recursive: true });
  await page.screenshot({ path: 'docs/screenshot-intelligent-ui.png', fullPage: true });
  await page.getByRole('button', { name: 'Testar meu entendimento' }).click();
  await page.getByRole('button', { name: 'Jun', exact: true }).click();
  await page.getByText('Acertou! Junho teve a maior receita: R$ 48.200.', { exact: true }).waitFor();
  await page.getByRole('button', { name: /Calculadora Uma resposta/ }).click();
  await page.getByLabel('Primeiro valor').fill('12');
  await page.getByLabel('Segundo valor').fill('8');
  await page.getByLabel('Operação').selectOption('multiply');
  await page.getByRole('button', { name: 'Calcular resultado' }).click();
  await page.getByText('96', { exact: true }).waitFor();
  await page.screenshot({ path: 'docs/screenshot-calculator.png', fullPage: true });
  await page.getByRole('button', { name: /Cartão de perfil Do formulário/ }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Ana Oliveira');
  await page.getByLabel('O que você faz?').fill('Product designer');
  await page.getByLabel('Uma breve descrição').fill('Crio experiências que aproximam pessoas e tecnologia.');
  await page.getByRole('button', { name: 'Criar meu cartão' }).click();
  await page.getByRole('heading', { name: 'Ana Oliveira' }).waitFor();
  await page.screenshot({ path: 'docs/screenshot-profile.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /Análise de receita/ }).click();
  await page.getByText('Resposta pronta', { exact: true }).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Overflow horizontal no mobile.');
  await page.screenshot({ path: 'docs/screenshot-mobile.png', fullPage: true });
  assert.deepEqual(errors, [], 'Erros no navegador.');
  console.log('PASS: 3 demos, calculator result 96, profile card, mini-game, mobile overflow, browser console.');
  console.log('Saved 4 real screenshots to docs/screenshot-*.png');
} finally {
  await browser?.close();
  server.kill();
}
