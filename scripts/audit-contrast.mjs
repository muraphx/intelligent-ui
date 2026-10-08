import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';

/**
 * Auditoria de contraste medida no navegador real, em cada um dos 5 design systems.
 *
 * Para todo elemento com texto dentro da superfície gerada, calcula a razão WCAG entre a cor do
 * texto e o primeiro fundo opaco acima dele na árvore. O mínimo é 4.5:1 (3:1 para texto grande).
 * Serve para provar por número o que o craft floor exige — e para não depender de "parece legível".
 */
function luminance([r, g, b]) {
  const channel = (value) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function contrast(a, b) {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4176', '--strictPort'], { stdio: 'ignore', windowsHide: true });
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (server.exitCode !== null) throw new Error('O preview não iniciou. Rode npm run build antes.');
    try { ready = (await fetch('http://127.0.0.1:4176')).ok; } catch { /* aguarda */ }
    if (ready) break;
    await delay(250);
  }
  assert.ok(ready, 'Preview indisponível.');
  await mkdir('docs', { recursive: true });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1512, height: 1180 } });
  await page.goto('http://127.0.0.1:4176');
  await page.getByText('Resposta pronta', { exact: true }).waitFor();

  const probe = () => {
    const parse = (value) => {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match) return null;
      const parts = match[1].split(',').map(part => Number.parseFloat(part));
      return { rgb: parts.slice(0, 3), alpha: parts.length > 3 ? parts[3] : 1 };
    };
    const backdrop = (element) => {
      let node = element;
      while (node && node !== document.documentElement) {
        const background = parse(getComputedStyle(node).backgroundColor);
        if (background && background.alpha > 0.5) return background.rgb;
        node = node.parentElement;
      }
      return [255, 255, 255];
    };
    const out = [];
    const root = document.querySelector('.generated-surface');
    for (const element of root.querySelectorAll('*')) {
      const text = Array.from(element.childNodes).filter(node => node.nodeType === 3).map(node => node.textContent.trim()).join(' ').trim();
      if (!text) continue;
      const style = getComputedStyle(element);
      if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) < 0.6) continue;
      const box = element.getBoundingClientRect();
      if (box.width < 4 || box.height < 4) continue;
      const foreground = parse(style.color);
      if (!foreground) continue;
      const size = Number.parseFloat(style.fontSize);
      const weight = Number(style.fontWeight) || 400;
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      out.push({
        tag: element.tagName.toLowerCase(),
        classes: (element.getAttribute('class') ?? '').slice(0, 70),
        text: text.slice(0, 42),
        fg: foreground.rgb,
        bg: backdrop(element),
        size: Math.round(size),
        large,
      });
    }
    return out;
  };

  const systems = ['papel', 'terminal', 'brutal', 'clinico', 'noturno'];
  const report = { generatedAt: new Date().toISOString(), minimum: 4.5, systems: {} };
  for (const id of systems) {
    await page.locator('.ds-preset', { hasText: '' }).nth(systems.indexOf(id)).click();
    await delay(320);
    const samples = await page.evaluate(probe);
    const failures = [];
    let worst = { ratio: 21, label: '' };
    for (const sample of samples) {
      const ratio = contrast(sample.fg, sample.bg);
      const required = sample.large ? 3 : 4.5;
      if (ratio < worst.ratio) worst = { ratio: Number(ratio.toFixed(2)), label: `${sample.tag}.${sample.classes.split(' ')[0]} "${sample.text}"` };
      if (ratio + 0.01 < required) failures.push({ ratio: Number(ratio.toFixed(2)), required, ...sample });
    }
    report.systems[id] = { checked: samples.length, failures, worst: worst.ratio === 21 ? null : worst };
  }
  await writeFile('docs/contrast-report.json', JSON.stringify(report, null, 2));
  const lines = [];
  let total = 0;
  for (const [id, result] of Object.entries(report.systems)) {
    total += result.failures.length;
    lines.push(`  ${id.padEnd(9)} ${String(result.checked).padStart(3)} elementos · falhas ${result.failures.length}${result.worst ? ` · pior ${result.worst.ratio}:1 (${result.worst.label})` : ''}`);
    for (const failure of result.failures.slice(0, 4)) lines.push(`      ${failure.ratio}:1 (min ${failure.required}) ${failure.tag} "${failure.text}" [${failure.classes.split(' ')[0]}]`);
  }
  console.log(`Elementos de texto medidos por sistema:\n${lines.join('\n')}`);
  console.log(total === 0
    ? 'PASS: nenhum texto abaixo do mínimo WCAG nos 5 sistemas.'
    : `FALHA: ${total} texto(s) abaixo do mínimo. Detalhe em docs/contrast-report.json.`);
  if (total > 0) process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill();
}
