import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { z } from 'zod';
import { UISpecSchema, validateUISpec } from '../src/ui/catalog';
import { buildProviderRequest, getProviderConfig, ProviderError, streamProvider } from './providers';

const MAX_BODY_BYTES = 262_144;
const localHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);
const frontendOrigins = new Set([
  'http://127.0.0.1:5173', 'http://localhost:5173',
  'http://127.0.0.1:4173', 'http://localhost:4173',
]);
const actionSchema = z.strictObject({
  elementId: z.string().regex(/^[a-zA-Z][\w-]{0,63}$/),
  name: z.string().regex(/^[a-z][a-z0-9_.-]{0,63}$/),
  payload: z.record(z.string().max(64), z.union([z.string().max(12000), z.number().finite(), z.boolean()]))
    .refine(value => Object.keys(value).length <= 30),
});
const requestSchema = z.strictObject({
  demo: z.enum(['analytics', 'calculator', 'profile']),
  prompt: z.string().max(12000).optional(),
  spec: UISpecSchema.optional(),
  action: actionSchema.optional(),
}).refine(value => !value.action || !!value.spec, 'Uma ação precisa da spec atual.');

class RequestError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

async function parseRequest(request: IncomingMessage) {
  if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
    throw new RequestError(415, 'Envie Content-Type: application/json.');
  }
  if (Number(request.headers['content-length']) > MAX_BODY_BYTES) throw new RequestError(413, 'Pedido excede 256 KiB.');
  const chunks: Buffer[] = [];
  let size = 0;
  // Do not use IncomingMessage's async iterator: an early throw would destroy the socket before the error response.
  await new Promise<void>((resolveBody, reject) => {
    const cleanup = () => {
      request.off('data', onData);
      request.off('end', onEnd);
      request.off('error', onError);
      request.off('aborted', onAborted);
    };
    const onData = (chunk: Buffer) => {
      size += chunk.byteLength;
      if (size > MAX_BODY_BYTES) {
        cleanup();
        request.resume();
        reject(new RequestError(413, 'Pedido excede 256 KiB.'));
      } else chunks.push(chunk);
    };
    const onEnd = () => { cleanup(); resolveBody(); };
    const onError = () => { cleanup(); reject(new RequestError(400, 'Falha ao ler o pedido.')); };
    const onAborted = () => { cleanup(); reject(new RequestError(400, 'Pedido cancelado.')); };
    request.on('data', onData).once('end', onEnd).once('error', onError).once('aborted', onAborted);
  });
  let value: unknown;
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new RequestError(400, 'JSON inválido.'); }
  const parsed = requestSchema.safeParse(value);
  if (!parsed.success) throw new RequestError(400, 'Pedido inválido. Confira demo, prompt, spec e action; propriedades extras não são aceitas.');
  if (parsed.data.spec) {
    const validated = validateUISpec(parsed.data.spec);
    if (!validated.spec || validated.errors.length) throw new RequestError(400, 'A spec atual contém referências inválidas.');
    parsed.data.spec = validated.spec;
  }
  if (parsed.data.action && !parsed.data.spec?.elements[parsed.data.action.elementId]) {
    throw new RequestError(400, 'O elemento da ação não existe na spec atual.');
  }
  return parsed.data;
}

async function writeEvent(response: ServerResponse, event: string, data: unknown, signal: AbortSignal) {
  signal.throwIfAborted();
  if (!response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)) {
    await once(response, 'drain', { signal });
  }
}

export function createApiServer(options: { env?: Record<string, string | undefined>; fetcher?: typeof fetch } = {}) {
  const env = options.env ?? process.env;
  const fetcher = options.fetcher ?? fetch;
  const server = createServer(async (request, response) => {
    const controller = new AbortController();
    response.on('close', () => { if (!response.writableEnded) controller.abort(); });
    request.on('aborted', () => controller.abort());
    try {
      let host: URL;
      try { host = new URL(`http://${request.headers.host || ''}`); } catch { throw new RequestError(403, 'Host local obrigatório.'); }
      if (!localHosts.has(host.hostname)) throw new RequestError(403, 'Host local obrigatório.');
      const origin = request.headers.origin;
      if (origin && !frontendOrigins.has(origin) && origin !== host.origin) throw new RequestError(403, 'Origem não autorizada.');
      if (origin) {
        response.setHeader('Access-Control-Allow-Origin', origin);
        response.setHeader('Vary', 'Origin');
      }
      response.setHeader('X-Content-Type-Options', 'nosniff');
      const path = request.url?.split('?')[0];
      if (request.method === 'OPTIONS' && (path === '/api/generate' || path === '/api/health')) {
        response.writeHead(204, {
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Accept',
        });
        response.end();
        return;
      }
      if (request.method === 'GET' && path === '/api/health') {
        try {
          const config = getProviderConfig(env);
          json(response, 200, { provider: config.provider, configured: !!config.apiKey && !!config.model });
        } catch (error) {
          json(response, 200, { provider: null, configured: false, error: error instanceof ProviderError ? error.message : 'Configuração inválida.' });
        }
        return;
      }
      if (path !== '/api/generate') throw new RequestError(404, 'Endpoint não encontrado.');
      if (request.method !== 'POST') throw new RequestError(405, 'Use POST /api/generate.');
      const input = await parseRequest(request);
      const config = getProviderConfig(env);
      buildProviderRequest(config, input); // Fail visibly before opening SSE if configuration is missing.
      response.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      response.flushHeaders();
      for await (const text of streamProvider(config, input, controller.signal, fetcher)) {
        await writeEvent(response, 'chunk', { text }, controller.signal);
      }
      await writeEvent(response, 'done', {}, controller.signal);
      response.end();
    } catch (error) {
      if (controller.signal.aborted || response.destroyed) return;
      const message = error instanceof RequestError || error instanceof ProviderError ? error.message : 'Não foi possível concluir a geração.';
      if (response.headersSent) {
        response.end(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
      } else {
        request.resume();
        json(response, error instanceof RequestError ? error.status : error instanceof ProviderError ? 503 : 500, { error: message });
      }
    }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  createApiServer().listen(3001, '127.0.0.1', () => {
    console.log('Intelligent UI proxy: http://127.0.0.1:3001 (chaves somente no servidor)');
  }).on('error', () => {
    console.error('Não foi possível iniciar o proxy local na porta 3001.');
    process.exitCode = 1;
  });
}
