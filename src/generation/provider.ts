import type { UISpec } from '../ui/catalog';
export type DemoId = 'analytics' | 'calculator' | 'profile';
export type UIAction = { elementId: string; name: string; payload: Record<string, string | number | boolean> };
export type GenerationRequest = { demo: DemoId; prompt?: string; spec?: UISpec; action?: UIAction };
export interface UIProvider { stream(request: GenerationRequest, signal?: AbortSignal): AsyncIterable<string> }
