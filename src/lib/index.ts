/**
 * intelligent-ui · superfície pública
 *
 * Tudo que um projeto externo precisa para montar o ciclo de UI generativa:
 * o contrato do catálogo, a validação, o parser de streaming, o canal de ações,
 * os providers e o contrato de design system.
 *
 * Um consumidor típico usa `createUIRenderer` com os próprios componentes e
 * `applyDesignSystem` (ou `designSystemVars`) para vestir a superfície.
 */

// Núcleo: contrato, validação e streaming
export {
  catalog, catalogPrompt, ElementSchema, UISpecSchema, validateUISpec,
  type Props, type UIElement, type UISpec, type ValidationError, type ValidationResult,
} from '../ui/catalog';
export { StreamingSpecParser } from '../ui/streaming-parser';

// Reatividade: o que a interface resolve sozinha, sem ida ao provider
export {
  completion, computeResult, createLiveEmitter, formatResult, parseNumberField, validateLiveFields,
  type FieldState, type LiveEvent, type LiveHandler, type LivePayload, type Operation,
} from '../ui/live';

// Rendering: renderer padrão e renderer com componentes próprios
export { UIRenderer, createUIRenderer, type ActionHandler, type ComponentMap, type RendererProps } from '../ui/renderer';
export * as defaultComponents from '../ui/components';
export { prepareAction } from '../generation/actions';

// Ciclo de geração
export { GenerativeUIController, type ControllerState } from '../generation/controller';
export { DemoProvider } from '../generation/demo-provider';
export { RemoteProvider } from '../generation/remote-provider';
export type { DemoId, GenerationRequest, UIAction, UIProvider } from '../generation/provider';

// Design system como dado
export {
  applyDesignSystem, clearDesignSystem, designSystemIds, designSystemToJson, designSystemVars,
  DesignSystemSchema, isDesignSystemId, parseDesignSystemJson, preset, presets, resolveDesignSystem,
  type DesignSystem, type DesignSystemId,
} from '../design/system';
