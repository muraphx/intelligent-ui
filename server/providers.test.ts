import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { GenerationRequest } from '../src/generation/provider';
import { getProviderConfig, buildProviderRequest, streamProvider } from './providers';
import { createApiServer } from './index';

const openaiEnv = { UI_PROVIDER: 'openai', OPENAI_API_KEY: 'test-secret', OPENAI_MODEL: 'test-model' };
const anthropicEnv = { UI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'test-secret', ANTHROPIC_MODEL: 'test-model' };
const initialRequest: GenerationRequest = { demo: 'calculator', prompt: 'Uma calculadora' };
const actionRequest: GenerationRequest = {
  ...initialRequest,
  spec: { root: 'root', elements: { root: { type: 'Markdown', props: { content: '2 + 3' }, children: [] } } },
  action: { elementId: 'root', name: 'calculate', payload: { left: 2, right: 3, operation: 'add' } },
};

async function collect(iterator: AsyncIterable<string>) {
  const result: string[] = [];
  for await (const chunk of iterator) result.push(chunk);
  return result.join('');
}

function upstream(text: string) {
  return new Response(text, { headers: { 'Content-Type': 'text/event-stream' } });
}

describe('provider request mapping', () => {
  it('uses OpenAI-compatible chat completions and keeps the key only in request headers', () => {
    const request = buildProviderRequest(getProviderConfig({ ...openaiEnv, OPENAI_BASE_URL: 'https://example.test/v1/' }), initialRequest);
    const body = JSON.parse(String(request.init.body));
    expect(request.url).toBe('https://example.test/v1/chat/completions');
    expect(new Headers(request.init.headers).get('Authorization')).toBe('Bearer test-secret');
    expect(body).toMatchObject({ model: 'test-model', stream: true });
    expect(body.messages[0]).toMatchObject({ role: 'system' });
    expect(body.messages[0].content).toContain('elements');
    expect(body.messages.at(-1)).toMatchObject({ role: 'user', content: expect.stringContaining('Uma calculadora') });
    expect(request.init.body).not.toContain('test-secret');
  });

  it.each([openaiEnv, anthropicEnv])('returns the current UI and action result to $UI_PROVIDER as a conversation step', (env) => {
    const request = buildProviderRequest(getProviderConfig(env), actionRequest);
    const body = JSON.parse(String(request.init.body));
    expect(body.messages.at(-2)).toEqual({ role: 'assistant', content: JSON.stringify(actionRequest.spec) });
    expect(body.messages.at(-1).role).toBe('user');
    expect(JSON.parse(body.messages.at(-1).content)).toEqual({ type: 'ui_action_result', action: actionRequest.action });
  });

  it('uses the native Anthropic Messages API with a separate system prompt', () => {
    const request = buildProviderRequest(getProviderConfig(anthropicEnv), initialRequest);
    const body = JSON.parse(String(request.init.body));
    expect(request.url).toBe('https://api.anthropic.com/v1/messages');
    expect(new Headers(request.init.headers).get('x-api-key')).toBe('test-secret');
    expect(new Headers(request.init.headers).get('anthropic-version')).toBe('2023-06-01');
    expect(body).toMatchObject({ system: expect.stringContaining('elements'), max_tokens: 8192, stream: true });
    expect(body.messages[0].role).toBe('user');
  });

  it('reports missing server configuration before any upstream request', () => {
    expect(() => buildProviderRequest(getProviderConfig({}), initialRequest)).toThrow('OPENAI_API_KEY');
    expect(() => buildProviderRequest(getProviderConfig({ OPENAI_API_KEY: 'test-secret' }), initialRequest)).toThrow('OPENAI_MODEL');
    expect(() => getProviderConfig({ UI_PROVIDER: 'unknown' })).toThrow('UI_PROVIDER');
  });

  it('rejects non-HTTP endpoint configuration', () => {
    expect(() => getProviderConfig({ ...openaiEnv, OPENAI_BASE_URL: 'file:///tmp/key' })).toThrow('BASE_URL');
  });
});

describe('upstream streams', () => {
  it('decodes OpenAI deltas and a terminal marker', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(upstream([
      'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"{\\"root\\":"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"\\"main\\"}"},"finish_reason":"stop"}]}\n\n',
      'data: [DONE]\n\n',
    ].join('')));
    expect(await collect(streamProvider(getProviderConfig(openaiEnv), initialRequest, undefined, fetcher))).toBe('{"root":"main"}');
  });

  it('decodes Anthropic text deltas and message_stop', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(upstream([
      'event: ping\ndata: {"type":"ping"}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"{\\"root\\":\\"main\\"}"}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n',
    ].join('')));
    expect(await collect(streamProvider(getProviderConfig(anthropicEnv), initialRequest, undefined, fetcher))).toBe('{"root":"main"}');
  });

  it('reports upstream HTTP failures without exposing its raw body or the key', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('test-secret: internal response', { status: 401 }));
    const error = await collect(streamProvider(getProviderConfig(openaiEnv), initialRequest, undefined, fetcher)).catch((error: Error) => error);
    expect(String(error)).toContain('401');
    expect(String(error)).not.toContain('test-secret');
  });

  it('reports streaming errors and does not leak the upstream error text', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(upstream('event: error\ndata: {"type":"error","error":{"message":"test-secret"}}\n\n'));
    const error = await collect(streamProvider(getProviderConfig(anthropicEnv), initialRequest, undefined, fetcher)).catch((error: Error) => error);
    expect(error).toBeInstanceOf(Error);
    expect(String(error)).toMatch(/provedor/i);
    expect(String(error)).not.toContain('test-secret');
  });

  it('rejects truncated output reported by a provider', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(upstream('data: {"choices":[{"delta":{"content":"{}"},"finish_reason":"length"}]}\n\ndata: [DONE]\n\n'));
    await expect(collect(streamProvider(getProviderConfig(openaiEnv), initialRequest, undefined, fetcher))).rejects.toThrow(/limit|limite/i);
  });

  it('rejects unexpected EOF', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(upstream('data: {"choices":[{"delta":{"content":"{}"}}]}\n\n'));
    await expect(collect(streamProvider(getProviderConfig(openaiEnv), initialRequest, undefined, fetcher))).rejects.toThrow(/interromp/i);
  });

  it('forwards caller cancellation to upstream fetch', async () => {
    const controller = new AbortController();
    let upstreamSignal: AbortSignal | undefined;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      upstreamSignal = init?.signal ?? undefined;
      controller.abort();
      throw new DOMException('Aborted', 'AbortError');
    });
    await expect(collect(streamProvider(getProviderConfig(openaiEnv), initialRequest, controller.signal, fetcher)))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(upstreamSignal?.aborted).toBe(true);
  });
});

describe('local API', () => {
  const servers: Server[] = [];
  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
      server.closeAllConnections();
      server.close((error) => error ? reject(error) : resolve());
    })));
  });

  async function start(env: Record<string, string> = {}, fetcher?: typeof fetch) {
    const server = createApiServer({ env, fetcher });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  it('reports configuration status without returning a key', async () => {
    const url = await start(openaiEnv);
    const response = await fetch(`${url}/api/health`);
    expect(await response.json()).toEqual({ provider: 'openai', configured: true });
  });

  it('rejects an external origin and unknown input properties', async () => {
    const url = await start();
    const external = await fetch(`${url}/api/generate`, { method: 'POST', headers: { origin: 'https://example.com', 'content-type': 'application/json' }, body: JSON.stringify(initialRequest) });
    expect(external.status).toBe(403);
    const invalid = await fetch(`${url}/api/generate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...initialRequest, apiKey: 'forbidden' }) });
    expect(invalid.status).toBe(400);
  });

  it('rejects an oversized request', async () => {
    const url = await start();
    const response = await fetch(`${url}/api/generate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ demo: 'analytics', prompt: 'x'.repeat(270_000) }) });
    expect(response.status).toBe(413);
  });

  it('rejects a UI action without the previous spec', async () => {
    const url = await start();
    const response = await fetch(`${url}/api/generate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ demo: 'calculator', action: actionRequest.action }) });
    expect(response.status).toBe(400);
  });

  it('rejects cyclic previous specs before contacting the provider', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const url = await start(openaiEnv, fetcher);
    const spec = { root: 'root', elements: { root: { type: 'Stack', props: {}, children: ['root'] } } };
    const response = await fetch(`${url}/api/generate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ demo: 'calculator', spec }) });
    expect(response.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('returns a clear missing-key error with no network request', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const url = await start({}, fetcher);
    const response = await fetch(`${url}/api/generate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(initialRequest) });
    expect(response.status).toBe(503);
    expect(await response.text()).toContain('OPENAI_API_KEY');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('normalizes streamed provider output to chunk and done events', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(upstream('data: {"choices":[{"delta":{"content":"{}"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'));
    const url = await start(openaiEnv, fetcher);
    const response = await fetch(`${url}/api/generate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(initialRequest) });
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(await response.text()).toBe('event: chunk\ndata: {"text":"{}"}\n\nevent: done\ndata: {}\n\n');
  });

  it('aborts the upstream request when the browser disconnects', async () => {
    let markStarted!: () => void;
    let markAborted!: () => void;
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    const aborted = new Promise<void>((resolve) => { markAborted = resolve; });
    const fetcher = vi.fn<typeof fetch>().mockImplementation((_input, init) => new Promise<Response>((_resolve, reject) => {
      markStarted();
      init?.signal?.addEventListener('abort', () => {
        markAborted();
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    }));
    const url = await start(openaiEnv, fetcher);
    const controller = new AbortController();
    const response = await fetch(`${url}/api/generate`, { method: 'POST', signal: controller.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify(initialRequest) });
    await started;
    controller.abort();
    await aborted;
    await response.body?.cancel().catch(() => undefined);
  });
});
