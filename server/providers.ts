import type { GenerationRequest } from '../src/generation/provider';
import { catalogPrompt } from '../src/ui/catalog';
import { readSSE } from '../src/generation/sse';

export type ProviderConfig = {
  provider: 'openai' | 'anthropic';
  apiKey: string;
  model: string;
  baseUrl: string;
};

/** Only deliberate, sanitized errors from this module may be returned to a browser. */
export class ProviderError extends Error {}

export function getProviderConfig(env: Record<string, string | undefined>): ProviderConfig {
  const provider = env.UI_PROVIDER?.trim() || 'openai';
  if (provider !== 'openai' && provider !== 'anthropic') {
    throw new ProviderError('UI_PROVIDER deve ser openai ou anthropic no .env.');
  }
  const prefix = provider.toUpperCase();
  const baseUrl = env[`${prefix}_BASE_URL`]?.trim() || (provider === 'openai' ? 'https://api.openai.com/v1' : 'https://api.anthropic.com');
  let url: URL;
  try { url = new URL(baseUrl); } catch { throw new ProviderError(`${prefix}_BASE_URL inválida no .env.`); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) || url.username || url.password || url.search || url.hash) {
    throw new ProviderError(`${prefix}_BASE_URL deve usar HTTPS (ou HTTP em localhost), sem credenciais, query ou fragmento.`);
  }
  return {
    provider,
    apiKey: env[`${prefix}_API_KEY`]?.trim() || '',
    model: env[`${prefix}_MODEL`]?.trim() || '',
    baseUrl: url.toString().replace(/\/+$/, ''),
  };
}

export function buildProviderRequest(config: ProviderConfig, request: GenerationRequest): { url: string; init: RequestInit } {
  const prefix = config.provider.toUpperCase();
  if (!config.apiKey) throw new ProviderError(`Defina ${prefix}_API_KEY no .env e reinicie npm run proxy.`);
  if (!config.model) throw new ProviderError(`Defina ${prefix}_MODEL no .env e reinicie npm run proxy.`);

  const messages: { role: 'user' | 'assistant' | 'system'; content: string }[] = [{
    role: 'user',
    content: JSON.stringify({ type: 'ui_request', demo: request.demo, prompt: request.prompt || `Crie a interface da demonstração ${request.demo}.` }),
  }];
  if (request.spec) messages.push({ role: 'assistant', content: JSON.stringify(request.spec) });
  // This is an application-level step result, not a fabricated native tool-call ID.
  if (request.action) messages.push({ role: 'user', content: JSON.stringify({ type: 'ui_action_result', action: request.action }) });

  const openai = config.provider === 'openai';
  const body = openai
    ? { model: config.model, stream: true, messages: [{ role: 'system', content: catalogPrompt }, ...messages] }
    : { model: config.model, stream: true, max_tokens: 8192, system: catalogPrompt, messages };
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'text/event-stream' };
  if (openai) headers.Authorization = `Bearer ${config.apiKey}`;
  else {
    headers['x-api-key'] = config.apiKey;
    headers['anthropic-version'] = '2023-06-01';
  }
  return {
    url: `${config.baseUrl}${openai ? '/chat/completions' : '/v1/messages'}`,
    init: { method: 'POST', headers, body: JSON.stringify(body), redirect: 'error' },
  };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}

export async function* streamProvider(config: ProviderConfig, request: GenerationRequest, signal?: AbortSignal, fetcher: typeof fetch = fetch): AsyncIterable<string> {
  const upstream = buildProviderRequest(config, request);
  const deadline = AbortSignal.timeout(120_000);
  const combinedSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
  let hasContent = false;
  try {
    const response = await fetcher(upstream.url, { ...upstream.init, signal: combinedSignal });
    if (!response.ok) {
      await response.body?.cancel();
      throw new ProviderError(`O provedor ${config.provider} respondeu HTTP ${response.status}. Confira chave, modelo, endpoint e cota no .env.`);
    }
    if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
      await response.body?.cancel();
      throw new ProviderError('O provedor não retornou um stream SSE válido. Confira o endpoint.');
    }
    for await (const event of readSSE(response.body)) {
      if (config.provider === 'openai' && event.data === '[DONE]') {
        if (!hasContent) throw new ProviderError('O provedor terminou sem gerar conteúdo de UI.');
        return;
      }
      let packet: Record<string, unknown> | undefined;
      try { packet = record(JSON.parse(event.data)); } catch { throw new ProviderError('O provedor enviou JSON inválido no stream.'); }
      if (!packet) throw new ProviderError('O provedor enviou um evento inválido.');
      if (event.event === 'error' || packet.type === 'error' || packet.error !== undefined) {
        throw new ProviderError('O provedor interrompeu a geração com um erro. Confira a cota ou tente novamente.');
      }
      let text: unknown;
      if (config.provider === 'openai') {
        const choice = Array.isArray(packet.choices) ? record(packet.choices[0]) : undefined;
        const finishReason = choice?.finish_reason;
        if (finishReason === 'length') throw new ProviderError('A geração atingiu o limite de tokens do provedor. Peça uma interface menor.');
        if (finishReason && finishReason !== 'stop') throw new ProviderError('O provedor encerrou a resposta sem uma spec de UI completa.');
        const delta = record(choice?.delta);
        if (delta?.refusal) throw new ProviderError('O provedor recusou a solicitação. Tente outro pedido.');
        text = delta?.content;
      } else {
        if (packet.type === 'message_stop') {
          if (!hasContent) throw new ProviderError('O provedor terminou sem gerar conteúdo de UI.');
          return;
        }
        const delta = record(packet.delta);
        if (packet.type === 'message_delta' && delta?.stop_reason === 'max_tokens') {
          throw new ProviderError('A geração atingiu o limite de tokens do provedor. Peça uma interface menor.');
        }
        if (packet.type === 'content_block_delta' && delta?.type === 'text_delta') text = delta.text;
      }
      if (typeof text === 'string' && text) {
        hasContent = true;
        yield text;
      }
    }
    throw new ProviderError('O streaming do provedor foi interrompido antes da conclusão.');
  } catch (error) {
    if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new DOMException('Geração cancelada.', 'AbortError');
    if (deadline.aborted) throw new ProviderError('O provedor excedeu o prazo de 120 segundos. Tente novamente.');
    if (error instanceof ProviderError) throw error;
    throw new ProviderError('Não foi possível ler a resposta do provedor. Confira o endpoint e a conexão.');
  }
}
