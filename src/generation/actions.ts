import { z } from 'zod';
import type { UISpec } from '../ui/catalog';
import type { UIAction } from './provider';

export const UIActionSchema = z.strictObject({
  elementId: z.string().max(64), name: z.string().max(64),
  payload: z.record(z.string().max(64), z.union([z.string().max(2000), z.number().finite(), z.boolean()])),
});

/** Only application-owned code performs calculations; no model expressions are evaluated. */
export function prepareAction(raw: UIAction, spec: UISpec): UIAction {
  const action = UIActionSchema.parse(raw);
  const node = spec.elements[action.elementId];
  if (!node || !('action' in node.props) || node.props.action !== action.name) throw new Error('Ação não pertence à interface atual.');
  if (node.type === 'Calculator') {
    const p = z.strictObject({ a: z.number().finite().min(-1e12).max(1e12), b: z.number().finite().min(-1e12).max(1e12), operation: z.enum(['add', 'subtract', 'multiply', 'divide']) }).parse(action.payload);
    if (p.operation === 'divide' && p.b === 0) throw new Error('Não é possível dividir por zero. Altere o segundo valor.');
    const result = p.operation === 'add' ? p.a + p.b : p.operation === 'subtract' ? p.a - p.b : p.operation === 'multiply' ? p.a * p.b : p.a / p.b;
    if (!Number.isFinite(result)) throw new Error('O resultado não é um número finito.');
    return { ...action, payload: { ...p, result } };
  }
  if (node.type === 'Form') {
    const fields = node.props.fields;
    if (Object.keys(action.payload).some(key => !fields.some(field => field.name === key))) throw new Error('Campo desconhecido no formulário.');
    for (const field of fields) {
      const value = action.payload[field.name];
      if (typeof value !== 'string' || (field.required && !value.trim()) || value.length > 160) throw new Error(`Confira o campo ${field.label}.`);
    }
  } else if (node.type === 'MiniGame') {
    const p = z.strictObject({ choice: z.string() }).parse(action.payload);
    if (!node.props.options.includes(p.choice)) throw new Error('Escolha uma das opções disponíveis.');
  } else if (node.type === 'Button') z.strictObject({}).parse(action.payload);
  return action;
}
