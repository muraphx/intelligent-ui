import { describe, expect, it, vi } from 'vitest';
import { readSSE } from './sse';
import { RemoteProvider } from './remote-provider';

function bytes(text: string, width = 1) {
  const encoded = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let index = 0; index < encoded.length; index += width) {
        controller.enqueue(encoded.slice(index, index + width));
      }
      controller.close();
    },
  });
}

async function collect<T>(iterator: AsyncIterable<T>) {
  const results: T[] = [];
  for await (const item of iterator) results.push(item);
  return results;
}

describe('SSE decoder', () => {
  it('decodes fragmented UTF-8, CRLF, comments, and multiline data', async () => {
    const stream = bytes(': keepalive\r\nevent: chunk\r\ndata: olá 👋\r\ndata: mundo\r\n\r\ndata: segundo\n\n');
    expect(await collect(readSSE(stream))).toEqual([
      { event: 'chunk', data: 'olá 👋\nmundo' },
      { event: 'message', data: 'segundo' },
    ]);
    expect(stream.locked).toBe(false);
  });

  it('handles bare CR delimiters and ignores unfinished events at EOF', async () => {
    expect(await collect(readSSE(bytes('data: ready\r\rdata: incomplete')))).toEqual([
      { event: 'message', data: 'ready' },
    ]);
  });

  it('cancels and unlocks the source when a consumer stops early', async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: one\n\ndata: two\n\n'));
      },
      cancel,
    });
    for await (const _event of readSSE(stream)) break;
    expect(cancel).toHaveBeenCalledOnce();
    expect(stream.locked).toBe(false);
  });

  it('bounds unfinished lines so a malformed upstream cannot grow memory forever', async () => {
    const stream = bytes(`data: ${'x'.repeat(1_048_577)}`, 65536);
    await expect(collect(readSSE(stream))).rejects.toThrow(/limite|limit/i);
    expect(stream.locked).toBe(false);
  });
});

describe('remote provider', () => {
  it('posts the request and forwards abort while decoding normalized chunks', async () => {
    const signal = new AbortController().signal;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(bytes(
      'event: chunk\ndata: {"text":"{\\"root\\":"}\n\nevent: chunk\ndata: {"text":"\\"main\\"}"}\n\nevent: done\ndata: {}\n\n',
    ), { headers: { 'Content-Type': 'text/event-stream' } }));
    const provider = new RemoteProvider('/api/generate', fetcher);
    const result = await collect(provider.stream({ demo: 'analytics', prompt: 'Receita' }, signal));
    expect(result.join('')).toBe('{"root":"main"}');
    expect(fetcher).toHaveBeenCalledWith('/api/generate', expect.objectContaining({
      method: 'POST', signal, body: JSON.stringify({ demo: 'analytics', prompt: 'Receita' }),
    }));
  });

  it('exposes a normalized provider error', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(bytes(
      'event: error\ndata: {"message":"Defina OPENAI_API_KEY no .env."}\n\n',
    ), { headers: { 'Content-Type': 'text/event-stream' } }));
    await expect(collect(new RemoteProvider('/api/generate', fetcher).stream({ demo: 'analytics' })))
      .rejects.toThrow('OPENAI_API_KEY');
  });

  it('rejects an interrupted stream instead of presenting partial data as complete', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(bytes(
      'event: chunk\ndata: {"text":"{}"}\n\n',
    ), { headers: { 'Content-Type': 'text/event-stream' } }));
    await expect(collect(new RemoteProvider('/api/generate', fetcher).stream({ demo: 'analytics' })))
      .rejects.toThrow(/interromp|complet/i);
  });

  it('reports HTTP failures without treating an HTML error page as generated UI', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>bad gateway</html>', { status: 502 }));
    await expect(collect(new RemoteProvider('/api/generate', fetcher).stream({ demo: 'analytics' })))
      .rejects.toThrow(/502/);
  });
});
