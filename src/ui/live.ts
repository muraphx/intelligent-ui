/**
 * Camada reativa: o que a interface calcula sozinha, sem ida ao provider.
 *
 * A regra do projeto é que a superfície responde na hora ao que a pessoa digita; o provider só
 * entra quando a pessoa *pede* algo novo (o canal de ação). Por isso a matemática e a validação
 * vivem aqui, em funções puras: o componente só as chama a cada tecla.
 */

export type LivePayload = Record<string, string | number | boolean>;
export type LiveEvent = { elementId: string; name: string; payload: LivePayload };
export type LiveHandler = (event: LiveEvent) => void;

export type Operation = 'add' | 'subtract' | 'multiply' | 'divide';

/** Mesma aritmética do canal de ação (`prepareAction`), exposta para uso em tempo real. */
export function computeResult(a: number, b: number, operation: Operation): { value: number | null; error?: string } {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { value: null, error: 'Informe dois números.' };
  if (operation === 'divide' && b === 0) return { value: null, error: 'Não é possível dividir por zero.' };
  const value = operation === 'add' ? a + b : operation === 'subtract' ? a - b : operation === 'multiply' ? a * b : a / b;
  if (!Number.isFinite(value)) return { value: null, error: 'O resultado não é um número finito.' };
  return { value };
}

export function parseNumberField(raw: string): { value: number; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { value: NaN, error: 'Campo vazio.' };
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return { value: NaN, error: 'Use um número.' };
  if (Math.abs(value) > 1e12) return { value: NaN, error: 'Fora do limite permitido.' };
  return { value };
}

export function formatResult(value: number): string {
  const rounded = Number(value.toFixed(10));
  return rounded.toLocaleString('pt-BR', { maximumFractionDigits: 10 });
}

export type FieldState = { name: string; label: string; value: string; error: string | null; filled: boolean };

/** Validação a cada tecla, espelhando as regras que o servidor aplica no envio. */
export function validateLiveFields(
  fields: { name: string; label: string; required?: boolean }[],
  values: Record<string, string>,
): FieldState[] {
  return fields.map(field => {
    const value = values[field.name] ?? '';
    const error = field.required && !value.trim() ? `${field.label} ainda está vazio.`
      : value.length > 160 ? `${field.label} passou de 160 caracteres.`
      : null;
    return { name: field.name, label: field.label, value, error, filled: Boolean(value.trim()) };
  });
}

/** Progresso do preenchimento — o tipo de retorno que a interface mostra em tempo real. */
export function completion(fields: FieldState[]): number {
  if (!fields.length) return 0;
  return Math.round(fields.filter(field => field.filled).length / fields.length * 100);
}

/**
 * Emissor com throttle (leading + trailing). A interface nunca inunda quem escuta: o primeiro
 * evento sai na hora, os seguintes esperam a janela — e o último valor sempre é entregue.
 */
export function createLiveEmitter(onLive: LiveHandler | undefined, intervalMs = 180) {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: LiveEvent | undefined;
  const flush = () => {
    timer = undefined;
    if (!pending || !onLive) return;
    last = Date.now();
    const event = pending;
    pending = undefined;
    onLive(event);
  };
  const emit = (event: LiveEvent) => {
    if (!onLive) return;
    const elapsed = Date.now() - last;
    if (elapsed >= intervalMs) { last = Date.now(); onLive(event); return; }
    pending = event;
    if (!timer) timer = setTimeout(flush, intervalMs - elapsed);
  };
  emit.cancel = () => { if (timer) clearTimeout(timer); timer = undefined; pending = undefined; };
  return emit;
}
