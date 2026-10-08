import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';

/**
 * Prova da reatividade em tempo real: ninguém clica em "enviar". O teste só DIGITA e exige que a
 * superfície já mostre o resultado — calculadora recalculando a cada tecla e formulário compondo a
 * prévia ao vivo, além do contador de eventos em tempo real no painel de bastidores.
 */
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4175', '--strictPort'], { stdio: 'ignore', windowsHide: true });
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (server.exitCode !== null) throw new Error('O preview não iniciou. Rode npm run build antes.');
    try { ready = (await fetch('http://127.0.0.1:4175')).ok; } catch { /* aguarda */ }
    if (ready) break;
    await delay(250);
  }
  assert.ok(ready, 'Preview indisponível.');
  await mkdir('docs', { recursive: true });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1512, height: 1180 }, reducedMotion: 'reduce' });
  const problems = [];
  page.on('pageerror', error => problems.push(error.message));
  page.on('console', message => { if (message.type() === 'error') problems.push(message.text()); });
  await page.goto('http://127.0.0.1:4175');
  await page.getByText('Resposta pronta', { exact: true }).waitFor();

  // 1 · Calculadora: digita e exige o resultado na hora, sem enviar nada ao provider.
  await page.getByRole('button', { name: /^Calculadora/ }).click();
  await page.getByText('Resposta pronta', { exact: true }).waitFor();
  await page.getByLabel('Primeiro valor').fill('250');
  await page.getByLabel('Segundo valor').fill('4');
  await page.getByLabel('Operação').click();
  await page.getByRole('option', { name: '× Multiplicar' }).click();
  await page.waitForFunction(() => document.querySelector('.live-readout strong')?.textContent === '1.000');
  const liveResult = await page.locator('.live-readout strong').innerText();
  assert.equal(liveResult, '1.000', 'a calculadora deveria mostrar 1.000 sem envio');
  // Divergência em tempo real: divide por zero e a interface explica sem quebrar.
  await page.getByLabel('Operação').click();
  await page.getByRole('option', { name: '÷ Dividir' }).click();
  await page.getByLabel('Segundo valor').fill('0');
  await page.waitForFunction(() => (document.querySelector('.live-readout small')?.textContent ?? '').includes('dividir por zero'));
  await page.getByLabel('Segundo valor').fill('4');
  await page.getByLabel('Operação').click();
  await page.getByRole('option', { name: '× Multiplicar' }).click();
  await page.waitForFunction(() => document.querySelector('.live-readout strong')?.textContent === '1.000');
  await page.locator('.generated-surface').screenshot({ path: 'docs/screenshot-live-calculator.png' });

  // 2 · Formulário: cada tecla atualiza validação, medidor de preenchimento e prévia.
  await page.getByRole('button', { name: /^Cartão de perfil/ }).click();
  await page.getByText('Resposta pronta', { exact: true }).waitFor();
  const meterBefore = await page.locator('.live-meter b').innerText();
  await page.getByLabel('Nome').fill('Ana Oliveira');
  await page.getByLabel('O que você faz?').fill('Product designer');
  await page.getByLabel('Uma breve descrição').fill('Desenho interfaces que se explicam sozinhas.');
  await page.waitForFunction(() => document.querySelector('.live-meter b')?.textContent === '100%');
  const preview = await page.locator('.live-preview').innerText();
  assert.ok(preview.includes('Ana Oliveira'), 'a prévia ao vivo deveria conter o nome digitado');
  assert.ok(preview.includes('Product designer'), 'a prévia deveria conter a função digitada');
  await page.locator('.generated-surface').screenshot({ path: 'docs/screenshot-live-form.png' });

  // 3 · O painel de bastidores conta os eventos em tempo real.
  const stats = await page.locator('.stream-stats').innerText();
  const pulses = Number(stats.match(/Eventos em tempo real\s*(\d+)/)?.[1] ?? 0);
  assert.ok(pulses >= 6, `esperava vários eventos em tempo real, veio ${pulses}`);
  assert.equal(problems.length, 0, `Console com erros: ${problems.join(' | ')}`);
  console.log(`PASS: reativo sem envio. Calculadora: 250 × 4 = ${liveResult} (a cada tecla). Formulário: medidor ${meterBefore} -> 100% com prévia ao vivo. Eventos em tempo real: ${pulses}. Console limpo.`);
} finally {
  await browser?.close();
  server.kill();
}
