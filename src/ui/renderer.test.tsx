import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UIRenderer } from './renderer';
describe('renderer safety boundary', () => {
  it('renders model HTML as text, never active elements', () => {
    const html = renderToStaticMarkup(<UIRenderer spec={{ root: 'r', elements: { r: { type: 'Markdown', props: { content: '<script>alert(1)</script><img src=x onerror=alert(1)>' }, children: [] } } }} onAction={() => {}} />);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
  });
  it('shows errors instead of rendering invented components', () => {
    const html = renderToStaticMarkup(<UIRenderer spec={{ root: 'r', elements: { r: { type: 'Iframe', props: {}, children: [] } } }} onAction={() => {}} />);
    expect(html).toContain('role="alert"');
    expect(html).not.toContain('<iframe');
  });
});
