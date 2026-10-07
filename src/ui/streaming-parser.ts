import { validateUISpec, type ValidationResult } from './catalog';

/** Stateful balanced-object scanner. No speculative repairs of partial JSON. */
export class StreamingSpecParser {
  private buffer = '';
  private depth = 0;
  private quoted = false;
  private escaped = false;
  private bytes = 0;
  private seenSpec = false;
  private stopped = false;

  push(chunk: string): ValidationResult[] {
    if (this.stopped) return [];
    this.bytes += chunk.length;
    if (this.bytes > 512_000) {
      this.stopped = true;
      this.buffer = '';
      return [this.error('O stream excedeu o limite de 512.000 caracteres.')];
    }
    const results: ValidationResult[] = [];
    for (const char of chunk) {
      if (!this.depth) {
        if (char !== '{') continue;
        this.buffer = '{'; this.depth = 1; this.quoted = false; this.escaped = false;
        continue;
      }
      this.buffer += char;
      if (this.quoted) {
        if (this.escaped) this.escaped = false;
        else if (char === '\\') this.escaped = true;
        else if (char === '"') this.quoted = false;
      } else if (char === '"') this.quoted = true;
      else if (char === '{') this.depth++;
      else if (char === '}' && --this.depth === 0) {
        try {
          const candidate: unknown = JSON.parse(this.buffer);
          if (candidate && typeof candidate === 'object' && ('root' in candidate || 'elements' in candidate)) {
            this.seenSpec = true;
            results.push(validateUISpec(candidate));
          }
        } catch {
          if (/"(?:root|elements)"\s*:/.test(this.buffer)) results.push(this.error('JSON inválido recebido; aguardando a próxima spec.'));
        }
        this.buffer = '';
      }
    }
    return results;
  }

  finish(): ValidationResult[] {
    if (this.stopped) return [];
    this.stopped = true;
    if (this.depth) return [this.error('Stream encerrado com JSON incompleto.')];
    return this.seenSpec ? [] : [this.error('O stream não retornou uma spec de UI.')];
  }
  private error(message: string): ValidationResult { return { spec: null, errors: [{ message }] }; }
}
