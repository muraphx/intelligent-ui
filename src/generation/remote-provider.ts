import type { GenerationRequest, UIProvider } from './provider';
import { readSSE } from './sse';

export class RemoteProvider implements UIProvider {
  constructor(private readonly url = '/api/generate', private readonly fetcher: typeof fetch = fetch) {}

  async *stream(request: GenerationRequest, signal?: AbortSignal): AsyncIterable<string> {
    let response: Response;
    try {
      response = await this.fetcher(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify(request),
        signal,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new Error('Proxy indisponível. Inicie npm run proxy e confira a configuração do .env.');
    }
    if (!response.ok) {
      let message = `Proxy respondeu HTTP ${response.status}. Confira o terminal do proxy e o .env.`;
      if (response.headers.get('content-type')?.includes('application/json')) {
        const body: unknown = await response.json().catch(() => null);
        if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') message = body.error;
      } else await response.body?.cancel();
      throw new Error(message);
    }
    if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
      await response.body?.cancel();
      throw new Error('Resposta inválida do proxy: esperava um stream SSE.');
    }
    for await (const event of readSSE(response.body)) {
      let value: unknown;
      try { value = JSON.parse(event.data); } catch { throw new Error('Evento SSE inválido recebido do proxy.'); }
      if (event.event === 'done') return;
      if (event.event === 'error') {
        throw new Error(value && typeof value === 'object' && 'message' in value && typeof value.message === 'string'
          ? value.message : 'O provedor interrompeu a geração.');
      }
      if (event.event === 'chunk') {
        if (!value || typeof value !== 'object' || !('text' in value) || typeof value.text !== 'string') {
          throw new Error('Chunk SSE inválido recebido do proxy.');
        }
        yield value.text;
      }
    }
    throw new Error('Streaming interrompido antes da conclusão. Tente gerar novamente.');
  }
}
