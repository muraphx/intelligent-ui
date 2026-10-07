import { describe, expect, it } from 'vitest';
import { validateUISpec } from './catalog';

const text = { type: 'Markdown', props: { content: 'Olá' }, children: [] };
describe('strict catalog validation', () => {
  it('discards unknown components and unknown props without losing valid siblings', () => {
    const result = validateUISpec({ root: 'root', elements: {
      root: { type: 'Stack', props: {}, children: ['good', 'invented', 'unsafe'] },
      good: text,
      invented: { type: 'Iframe', props: { src: 'https://example.com' }, children: [] },
      unsafe: { ...text, props: { content: 'text', onClick: 'alert(1)' } },
    } });
    expect(Object.keys(result.spec!.elements)).toEqual(['root', 'good']);
    expect(result.spec!.elements.root.children).toEqual(['good']);
    expect(result.errors.some(e => e.elementId === 'invented')).toBe(true);
    expect(result.errors.some(e => e.elementId === 'unsafe')).toBe(true);
  });
  it('rejects invalid prop values and invalid roots', () => {
    expect(validateUISpec({ root: 'x', elements: { x: { type: 'Chart', props: { title: 3 }, children: [] } } }).spec).toBeNull();
    expect(validateUISpec({ root: 'missing', elements: { good: text } }).errors.length).toBeGreaterThan(0);
  });
  it('breaks cycles and drops missing children', () => {
    const result = validateUISpec({ root: 'r', elements: {
      r: { type: 'Stack', props: {}, children: ['r', 'missing', 'good'] }, good: text,
    } });
    expect(result.spec!.elements.r.children).toEqual(['good']);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
  it('rejects prototype keys and unbounded trees', () => {
    expect(validateUISpec(JSON.parse('{"root":"__proto__","elements":{"__proto__":{"type":"Stack","props":{},"children":[]}}}')).spec).toBeNull();
    const elements = Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`n${i}`, text]));
    expect(validateUISpec({ root: 'n0', elements }).spec).toBeNull();
  });
});
