export type SSEEvent = { event: string; data: string };

const MAX_EVENT_LENGTH = 1_048_576;
const MAX_STREAM_BYTES = 4_194_304;

/** Decode SSE independently of transport chunk boundaries, including split UTF-8 and CRLF. */
export async function* readSSE(stream: ReadableStream<Uint8Array>): AsyncGenerator<SSEEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let line = '';
  let event = '';
  let data: string[] = [];
  let eventLength = 0;
  let totalBytes = 0;
  let skipLF = false;
  let completed = false;

  function finishLine(): SSEEvent | undefined {
    const current = line;
    line = '';
    if (!current) {
      const result = data.length ? { event: event || 'message', data: data.join('\n') } : undefined;
      event = '';
      data = [];
      eventLength = 0;
      return result;
    }
    eventLength += current.length;
    if (eventLength > MAX_EVENT_LENGTH) throw new Error('Limite de tamanho do evento SSE excedido.');
    if (current.startsWith(':')) return;
    const separator = current.indexOf(':');
    const field = separator === -1 ? current : current.slice(0, separator);
    const raw = separator === -1 ? '' : current.slice(separator + 1);
    const value = raw.startsWith(' ') ? raw.slice(1) : raw;
    if (field === 'event') event = value;
    if (field === 'data') data.push(value);
  }

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        decoder.decode(); // Reject incomplete UTF-8; SSE deliberately discards unfinished events at EOF.
        completed = true;
        return;
      }
      totalBytes += value.byteLength;
      if (totalBytes > MAX_STREAM_BYTES) throw new Error('Limite de tamanho do stream SSE excedido.');
      const text = decoder.decode(value, { stream: true });
      for (const character of text) {
        if (skipLF) {
          skipLF = false;
          if (character === '\n') continue;
        }
        if (character === '\r' || character === '\n') {
          skipLF = character === '\r';
          const nextEvent = finishLine();
          if (nextEvent) yield nextEvent;
        } else {
          line += character;
          if (line.length + eventLength > MAX_EVENT_LENGTH) throw new Error('Limite de tamanho do evento SSE excedido.');
        }
      }
    }
  } finally {
    if (!completed) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
