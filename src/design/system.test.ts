import { describe, expect, it } from 'vitest';
import {
  DesignSystemSchema, designSystemIds, designSystemToJson, designSystemVars, parseDesignSystemJson,
  preset, resolveDesignSystem,
} from './system';

describe('design system contract', () => {
  it('every shipped preset satisfies the contract', () => {
    for (const id of designSystemIds) {
      const parsed = DesignSystemSchema.safeParse(preset(id));
      expect(parsed.success, `${id} deveria validar`).toBe(true);
    }
  });
  it('hands out copies, never the preset itself', () => {
    const first = preset('brutal');
    first.colors.accent = '#000000';
    expect(preset('brutal').colors.accent).toBe('#ffd400');
  });
  it('rejects unknown properties, bad hex and out-of-range radius', () => {
    const base = preset('clinico');
    expect(DesignSystemSchema.safeParse({ ...base, borderWidth: 3 }).success).toBe(false);
    expect(DesignSystemSchema.safeParse({ ...base, colors: { ...base.colors, accent: 'red' } }).success).toBe(false);
    expect(DesignSystemSchema.safeParse({ ...base, radius: 999 }).success).toBe(false);
    expect(DesignSystemSchema.safeParse({ ...base, mode: 'sepia' }).success).toBe(false);
  });
  it('accepts a short hex and resolves a custom system from a full object', () => {
    const custom = { ...preset('papel'), name: 'Meu sistema', colors: { ...preset('papel').colors, accent: '#0a0' } };
    const resolved = resolveDesignSystem(custom);
    expect(resolved.system?.name).toBe('Meu sistema');
    expect(resolved.error).toBeUndefined();
  });
  it('resolves a preset id, and names the alternatives when the preset does not exist', () => {
    expect(resolveDesignSystem('terminal').system?.name).toBe('Terminal');
    const missing = resolveDesignSystem('neon-1987');
    expect(missing.system).toBeNull();
    expect(missing.error).toContain('Preset desconhecido');
    expect(missing.error).toContain('brutal');
  });
  it('maps tokens to css variables, including depth and radius', () => {
    const hard = designSystemVars(preset('brutal'));
    expect(hard['--radius']).toBe('0px');
    expect(hard['--shadow']).toBe('4px 4px 0 #0f0f0f');
    expect(hard['--border-width']).toBe('2px');
    expect(designSystemVars(preset('terminal'))['--shadow']).toBe('none');
    expect(designSystemVars(preset('papel'))['--radius']).toBe('14px');
    const papel = designSystemVars(preset('papel'));
    expect(papel['--bg']).toBe('#faf7f1');
    expect(papel['--accent']).toBe('#b4522c');
    expect(papel['--selection']).toMatch(/^rgba\(180, 82, 44, 0\.24\)$/);
  });
  it('round-trips through JSON and reports broken input instead of guessing', () => {
    const back = parseDesignSystemJson(designSystemToJson(preset('noturno')));
    expect(back.system?.mode).toBe('dark');
    expect(back.error).toBeUndefined();
    expect(parseDesignSystemJson('{ nope }').error).toContain('JSON inválido');
    expect(parseDesignSystemJson('{"name":"x"}').error).toBeTruthy();
  });
});
