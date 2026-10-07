import { useMemo, type ComponentType, type ReactNode } from 'react';
import { validateUISpec } from './catalog';
import * as Components from './components';
import type { LiveHandler } from './live';

export type ActionHandler = Components.ActionHandler;
/** Um mapa de componentes: o consumidor da biblioteca decide o que cada tipo renderiza. */
export type ComponentMap = Record<string, ComponentType<any>>;
export type RendererProps = { spec: unknown; onAction: ActionHandler; disabled?: boolean; components?: ComponentMap; onLive?: LiveHandler };

/** Componentes que acompanham a biblioteca. Servem de padrão e de referência de implementação. */
export const shippedComponents: ComponentMap = {
  Markdown: Components.Markdown,
  MetricCard: Components.MetricCard,
  Chart: Components.Chart,
  Calculator: Components.Calculator,
  Form: Components.Form,
  Button: Components.Button,
  MiniGame: Components.MiniGame,
  ProfileCard: Components.ProfileCard,
};

/** Stack é estrutural: sempre o renderer compõe a árvore, nunca o mapa. */
const interactive = new Set(['Calculator', 'Form', 'Button', 'MiniGame']);
/** Estes dois carregam estado interno, então a chave precisa mudar quando as props mudam. */
const stateful = new Set(['Calculator', 'Form']);

export function UIRenderer({ spec, onAction, disabled = false, components, onLive }: RendererProps) {
  // Defense at the React boundary, even when a caller bypasses the controller.
  const validated = useMemo(() => validateUISpec(spec), [spec]);
  const map = components ?? shippedComponents;
  function render(id: string): ReactNode {
    const node = validated.spec?.elements[id];
    if (!node) return null;
    if (node.type === 'Stack') return <div key={id} className={`ui-stack ${node.props.direction ?? 'vertical'}`}>{node.children.map(render)}</div>;
    const Component = map[node.type];
    // Tipo fora do mapa do consumidor: nada é inventado, nada quebra a árvore.
    if (!Component) return null;
    const key = stateful.has(node.type) ? `${id}:${JSON.stringify(node.props)}` : id;
    return <Component key={key} {...node.props} {...(interactive.has(node.type) ? { elementId: id, onAction, disabled, onLive } : {})} />;
  }
  return <>{validated.errors.length > 0 && <div role="alert" className="error-box">{validated.errors.map((e, i) => <p key={i}>{e.elementId}: {e.message}</p>)}</div>}{validated.spec && render(validated.spec.root)}</>;
}

/**
 * Versão ligada a um mapa de componentes — o caminho para um projeto externo usar
 * a biblioteca com a própria linguagem visual:
 *
 * ```tsx
 * const Renderer = createUIRenderer({ Markdown: MeuTexto, Button: MeuBotao });
 * <Renderer spec={spec} onAction={dispatch} />
 * ```
 */
export function createUIRenderer(components: ComponentMap) {
  return function BoundRenderer(props: Omit<RendererProps, 'components'>) {
    return <UIRenderer {...props} components={components} />;
  };
}
