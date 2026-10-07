import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import * as ui from '../lib/index';
import { createUIRenderer, UIRenderer } from '../ui/renderer';

/**
 * A superfície pública é um contrato: se um nome sai daqui, projetos externos quebram.
 * Estes testes existem para que a abstração não se desfaça sem alguém perceber.
 */
describe('library surface', () => {
  it('exports the whole generative cycle from one entry point', () => {
    for (const name of [
      'GenerativeUIController', 'DemoProvider', 'RemoteProvider',
      'validateUISpec', 'catalog', 'catalogPrompt', 'StreamingSpecParser', 'prepareAction',
      'UIRenderer', 'createUIRenderer', 'defaultComponents', 'presets',
      'applyDesignSystem', 'designSystemVars', 'preset', 'resolveDesignSystem', 'DesignSystemSchema',
    ]) {
      expect(name in ui, `${name} deveria estar na superfície pública`).toBe(true);
    }
  });
  it('keeps React, zod and the DOM out of the core contract', () => {
    // O contrato de design system é serializável: nada de classes, refs ou objetos do React.
    const roundTrip = JSON.parse(JSON.stringify(ui.presets.terminal));
    expect(roundTrip).toEqual(ui.presets.terminal);
    expect(ui.designSystemVars(ui.presets.terminal)['--radius']).toBe('6px');
  });
  it('lets a consumer swap every component through the map', () => {
    const Renderer = createUIRenderer({
      Markdown: ({ content }: { content: string }) => <article data-own="true">{content.toUpperCase()}</article>,
      Button: ({ label }: { label: string }) => <button data-own="true" data-label={label} />,
    });
    const spec = { root: 'r', elements: {
      r: { type: 'Stack', props: { direction: 'vertical' }, children: ['txt', 'btn'] },
      txt: { type: 'Markdown', props: { content: 'olá' }, children: [] },
      btn: { type: 'Button', props: { label: 'Enviar', action: 'go' }, children: [] },
    } };
    const html = renderToStaticMarkup(<Renderer spec={spec} onAction={() => {}} />);
    expect(html).toContain('<article data-own="true">OLÁ</article>');
    expect(html).toContain('data-label="Enviar"');
    expect(html).toContain('ui-stack vertical');
  });
  it('never invents a component the consumer did not provide', () => {
    const html = renderToStaticMarkup(<UIRenderer components={{ Markdown: ({ content }: { content: string }) => <p>{content}</p> }}
      spec={{ root: 'r', elements: { r: { type: 'MetricCard', props: { label: 'x', value: '1' }, children: [] } } }} onAction={() => {}} />);
    expect(html).toBe('');
  });
  it('still refuses invented types and model HTML with a custom map', () => {
    const Renderer = createUIRenderer({ Markdown: ui.defaultComponents.Markdown });
    const spec = { root: 'r', elements: {
      r: { type: 'Stack', props: {}, children: ['html', 'invented'] },
      html: { type: 'Markdown', props: { content: '<img src=x onerror=alert(1)>' }, children: [] },
      invented: { type: 'Iframe', props: { src: 'https://example.com' }, children: [] },
    } };
    const out = renderToStaticMarkup(<Renderer spec={spec} onAction={() => {}} />);
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img');
    expect(out).not.toContain('iframe');
    expect(out).toContain('role="alert"');
  });
});
