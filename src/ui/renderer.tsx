import { useMemo, type ReactNode } from 'react';
import { validateUISpec } from './catalog';
import * as Components from './components';

export function UIRenderer({ spec, onAction, disabled = false }: { spec: unknown; onAction: Components.ActionHandler; disabled?: boolean }) {
  // Defense at the React boundary, even when a caller bypasses the controller.
  const validated = useMemo(() => validateUISpec(spec), [spec]);
  function render(id: string): ReactNode {
    const node = validated.spec?.elements[id];
    if (!node) return null;
    const interaction = { elementId: id, onAction, disabled };
    switch (node.type) {
      case 'Stack': return <div key={id} className={`ui-stack ${node.props.direction ?? 'vertical'}`}>{node.children.map(render)}</div>;
      case 'Markdown': return <Components.Markdown key={id} {...node.props} />;
      case 'MetricCard': return <Components.MetricCard key={id} {...node.props} />;
      case 'Chart': return <Components.Chart key={id} {...node.props} />;
      case 'Calculator': return <Components.Calculator key={`${id}:${JSON.stringify(node.props)}`} {...node.props} {...interaction} />;
      case 'Form': return <Components.Form key={`${id}:${JSON.stringify(node.props)}`} {...node.props} {...interaction} />;
      case 'Button': return <Components.Button key={id} {...node.props} {...interaction} />;
      case 'MiniGame': return <Components.MiniGame key={id} {...node.props} {...interaction} />;
      case 'ProfileCard': return <Components.ProfileCard key={id} {...node.props} />;
    }
  }
  return <>{validated.errors.length > 0 && <div role="alert" className="error-box">{validated.errors.map((e, i) => <p key={i}>{e.elementId}: {e.message}</p>)}</div>}{validated.spec && render(validated.spec.root)}</>;
}
