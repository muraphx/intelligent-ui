import { describe, expect, it } from 'vitest';
import { StreamingSpecParser } from './streaming-parser';
const spec = { root: 'r', elements: { r: { type: 'Markdown', props: { content: 'Uma "aspas", barra \\ e {chaves}. Olá!' }, children: [] } } };
describe('streaming parser', () => {
  it('accepts every one-character chunk including escaped quotes and braces', () => {
    const parser = new StreamingSpecParser();
    const results = [...('Aqui está sua interface:\n```json\n' + JSON.stringify(spec) + '\n```')].flatMap(c => parser.push(c));
    expect(results.at(-1)?.spec).toEqual(spec);
    expect(parser.finish()).toEqual([]);
  });
  it('does not render partial strings or objects', () => {
    const parser = new StreamingSpecParser();
    expect(parser.push(JSON.stringify(spec).slice(0, -3))).toEqual([]);
    expect(parser.finish()[0].errors[0].message).toMatch(/incomplet/i);
  });
  it('recovers from malformed candidates and prose braces', () => {
    const parser = new StreamingSpecParser();
    const results = parser.push('Texto {rascunho} ```json\n{"root": broken}\n' + JSON.stringify(spec));
    expect(results.at(-1)?.spec).toEqual(spec);
  });
  it('validates every snapshot and supports successive complete specs', () => {
    const parser = new StreamingSpecParser();
    const bad = { root: 'x', elements: { x: { type: 'Script', props: {}, children: [] } } };
    const results = parser.push(JSON.stringify(bad) + JSON.stringify(spec));
    expect(results[0].spec).toBeNull();
    expect(results[0].errors.length).toBeGreaterThan(0);
    expect(results[1].spec).toEqual(spec);
  });
  it('reports empty output and caps oversized streams', () => {
    expect(new StreamingSpecParser().finish()[0].errors.length).toBeGreaterThan(0);
    const parser = new StreamingSpecParser();
    expect(parser.push('x'.repeat(512_001))[0].errors[0].message).toMatch(/limite/i);
  });
});
