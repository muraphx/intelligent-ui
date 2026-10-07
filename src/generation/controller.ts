import type { UISpec, ValidationError, ValidationResult } from '../ui/catalog';
import type { DesignSystem } from '../design/system';
import type { LiveEvent } from '../ui/live';
import { StreamingSpecParser } from '../ui/streaming-parser';
import { prepareAction } from './actions';
import type { DemoId, GenerationRequest, UIAction, UIProvider } from './provider';

export type ControllerState = { spec: UISpec | null; errors: ValidationError[]; status: 'idle' | 'streaming' | 'ready' | 'error'; raw: string; chunks: number; revision: number; events: { name: string; detail: string }[]; designSystem: DesignSystem | null; livePulses: number };
export class GenerativeUIController {
  state: ControllerState = { spec: null, errors: [], status: 'idle', raw: '', chunks: 0, revision: 0, events: [], designSystem: null, livePulses: 0 };
  private listeners = new Set<() => void>();
  private abort?: AbortController;
  private demo: DemoId = 'analytics';
  private prompt?: string;
  private lastRequest?: GenerationRequest;
  constructor(private provider: UIProvider) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  private update(patch: Partial<ControllerState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(f => f()); }
  private log(name: string, detail: string) { this.update({ events: [...this.state.events, { name, detail }].slice(-12) }); }
  cancel() { this.abort?.abort(); this.abort = undefined; this.update({ status: this.state.spec ? 'ready' : 'idle' }); }
  /**
   * Evento em tempo real: a superfície reagiu sozinha (digitação, cálculo, prévia). Não passa pelo
   * provider — é registro e telemetria do que já aconteceu na tela.
   */
  live(event: LiveEvent) {
    const detail = Object.entries(event.payload).map(([key, value]) => `${key}: ${String(value).slice(0, 40)}`).join(' · ');
    this.update({ livePulses: this.state.livePulses + 1 });
    this.log(event.name, detail || 'interação local');
  }
  setProvider(provider: UIProvider) { this.cancel(); this.provider = provider; }
  async generate(demo: DemoId, prompt?: string) {
    this.demo = demo; this.prompt = prompt;
    await this.run({ demo, prompt }, true);
  }
  async dispatch(raw: UIAction) {
    if (this.state.status === 'streaming') return;
    try {
      if (!this.state.spec) throw new Error('Gere uma interface antes de interagir.');
      const action = prepareAction(raw, this.state.spec);
      this.log('Ação enviada', `${action.name} · ${JSON.stringify(action.payload)}`);
      await this.run({ demo: this.demo, prompt: this.prompt, spec: this.state.spec, action });
    } catch (error) { this.update({ status: 'error', errors: [{ message: error instanceof Error ? error.message : 'Ação inválida.' }] }); }
  }
  async retry() { if (this.lastRequest) await this.run(this.lastRequest); }
  private async run(request: GenerationRequest, reset = false) {
    this.abort?.abort();
    const abort = new AbortController(); this.abort = abort;
    this.lastRequest = request;
    this.update({ status: 'streaming', errors: [], raw: '', chunks: 0, ...(reset ? { spec: null, events: [] } : {}) });
    this.log(request.action ? 'Próxima resposta' : 'Pedido recebido', request.action ? 'Evento retornado ao provider como resultado de etapa.' : 'Compondo uma interface para o seu pedido.');
    const parser = new StreamingSpecParser();
    let accepted = false;
    const apply = (results: ValidationResult[]) => {
      for (const result of results) {
        // A spec pode trocar o design system da superfície; sem declaração, mantém o que estava.
        if (result.spec) { accepted = true; this.update({ spec: result.spec, revision: this.state.revision + 1, designSystem: result.designSystem ?? null }); }
        if (result.errors.length) this.update({ errors: [...this.state.errors, ...result.errors].slice(-30) });
      }
    };
    try {
      for await (const chunk of this.provider.stream(request, abort.signal)) {
        if (abort.signal.aborted || this.abort !== abort) return;
        this.update({ raw: (this.state.raw + chunk).slice(0, 512_000), chunks: this.state.chunks + 1 });
        apply(parser.push(chunk));
      }
      if (abort.signal.aborted || this.abort !== abort) return;
      apply(parser.finish());
      this.update({ status: accepted && !this.state.errors.length ? 'ready' : 'error' });
      this.log(accepted ? 'Interface atualizada' : 'Resposta rejeitada', accepted ? `${Object.keys(this.state.spec!.elements).length} componentes validados · revisão ${this.state.revision}` : 'Nenhuma spec válida recebida.');
    } catch (error) {
      if (abort.signal.aborted || this.abort !== abort) return;
      this.update({ status: 'error', errors: [...this.state.errors, { message: error instanceof Error ? error.message : 'Falha ao gerar a interface.' }] });
    }
  }
}
