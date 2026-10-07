import { describe, expect, it, vi } from 'vitest';
import { completion, computeResult, createLiveEmitter, formatResult, parseNumberField, validateLiveFields } from './live';

describe('camada reativa', () => {
  it('calcula como o canal de ação calcula', () => {
    expect(computeResult(12, 8, 'multiply').value).toBe(96);
    expect(computeResult(120, 8, 'divide').value).toBe(15);
    expect(computeResult(-5, 2.5, 'add').value).toBe(-2.5);
    expect(computeResult(1, 0, 'divide').error).toContain('dividir por zero');
    expect(computeResult(NaN, 1, 'add').error).toContain('dois números');
    expect(computeResult(1e308, 1e308, 'multiply').error).toContain('finito');
  });
  it('rejeita campo vazio, texto e valor fora do limite', () => {
    expect(parseNumberField('').error).toContain('vazio');
    expect(parseNumberField('abc').error).toContain('número');
    expect(parseNumberField('1e13').error).toContain('limite');
    expect(parseNumberField(' 42,5 ').value).toBeNaN(); // vírgula não é número em pt-BR de propósito
    expect(parseNumberField(' 42.5 ').value).toBe(42.5);
  });
  it('formata o resultado no padrão pt-BR', () => {
    expect(formatResult(96400)).toBe('96.400');
    expect(formatResult(0.30000000000000004)).toBe('0,3');
  });
  it('valida a cada tecla e mede o preenchimento', () => {
    const fields = [{ name: 'name', label: 'Nome', required: true }, { name: 'bio', label: 'Bio' }];
    const states = validateLiveFields(fields, { name: '', bio: 'oi' });
    expect(states[0].error).toContain('ainda está vazio');
    expect(states[1].error).toBeNull();
    expect(completion(states)).toBe(50);
    expect(completion(validateLiveFields(fields, { name: 'Ana', bio: 'oi' }))).toBe(100);
  });
  it('entrega o primeiro evento na hora e o último sempre', () => {
    vi.useFakeTimers();
    const seen: string[] = [];
    const emit = createLiveEmitter(event => seen.push(String(event.payload.value)), 180);
    emit({ elementId: 'c', name: 'live', payload: { value: 'a' } });
    expect(seen).toEqual(['a']); // leading
    emit({ elementId: 'c', name: 'live', payload: { value: 'b' } });
    emit({ elementId: 'c', name: 'live', payload: { value: 'c' } });
    expect(seen).toEqual(['a']); // dentro da janela: nada sai ainda
    vi.advanceTimersByTime(200);
    expect(seen).toEqual(['a', 'c']); // trailing com o último valor
    vi.useRealTimers();
  });
  it('não faz nada sem handler', () => {
    const emit = createLiveEmitter(undefined);
    expect(() => emit({ elementId: 'x', name: 'live', payload: {} })).not.toThrow();
  });
});
