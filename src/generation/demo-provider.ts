import { createDemoSpec } from './demo-specs';
import type { GenerationRequest, UIProvider } from './provider';

export class DemoProvider implements UIProvider {
  constructor(private delay = 18) {}
  async *stream(request: GenerationRequest, signal?: AbortSignal): AsyncIterable<string> {
    const text = 'Aqui está sua interface:\n```json\n' + JSON.stringify(createDemoSpec(request)) + '\n```';
    for (let offset = 0; offset < text.length; offset += 72) {
      signal?.throwIfAborted();
      if (this.delay) await new Promise<void>((resolve, reject) => {
        const abort = () => { clearTimeout(timer); reject(signal?.reason); };
        const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, this.delay);
        signal?.addEventListener('abort', abort, { once: true });
      });
      signal?.throwIfAborted();
      yield text.slice(offset, offset + 72);
    }
  }
}
