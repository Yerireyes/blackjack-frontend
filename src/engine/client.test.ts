import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createChannel, type EngineTransport } from './client';

function fakeTransport() {
  const calls: { req: { version: number }; resolve: (v: unknown) => void }[] = [];
  const transport: EngineTransport = {
    call: (_m, req) =>
      new Promise((resolve) => calls.push({ req, resolve: resolve as (v: unknown) => void })),
    restart: () => {},
  };
  return { transport, calls };
}

const channel = (
  transport: EngineTransport,
  over: Partial<Parameters<typeof createChannel>[0]> = {},
) =>
  createChannel({
    method: 'analyzeHand',
    transport: () => transport,
    onResult: () => {},
    onError: () => {},
    onSlow: () => {},
    ...over,
  });

describe('createChannel', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('agrupa cambios rápidos con debounce de 50 ms', async () => {
    const { transport, calls } = fakeTransport();
    const ch = channel(transport);
    ch.submit({ version: 1 } as never);
    ch.submit({ version: 2 } as never);
    await vi.advanceTimersByTimeAsync(49);
    expect(calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls.map((c) => c.req.version)).toEqual([2]);
  });

  it('mientras calcula guarda solo el último pedido', async () => {
    const { transport, calls } = fakeTransport();
    const results: number[] = [];
    const ch = channel(transport, { onResult: (r) => results.push(r.version) });
    ch.submit({ version: 1 } as never);
    await vi.advanceTimersByTimeAsync(50);
    ch.submit({ version: 2 } as never);
    ch.submit({ version: 3 } as never);
    await vi.advanceTimersByTimeAsync(100);
    expect(calls).toHaveLength(1);
    calls[0]!.resolve({ version: 1 });
    await vi.advanceTimersByTimeAsync(0);
    expect(calls.map((c) => c.req.version)).toEqual([1, 3]);
    expect(results).toEqual([1]);
  });

  it('avisa a los 5 s', async () => {
    const { transport } = fakeTransport();
    const slow = vi.fn();
    const ch = channel(transport, { onSlow: slow });
    ch.submit({ version: 7 } as never);
    await vi.advanceTimersByTimeAsync(50 + 4999);
    expect(slow).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(slow).toHaveBeenCalledWith(7);
  });

  it('tras reset ignora la respuesta del pedido viejo', async () => {
    const { transport, calls } = fakeTransport();
    const onResult = vi.fn();
    const ch = channel(transport, { onResult });
    ch.submit({ version: 1 } as never);
    await vi.advanceTimersByTimeAsync(50);
    ch.reset();
    calls[0]!.resolve({ version: 1 });
    await vi.advanceTimersByTimeAsync(0);
    expect(onResult).not.toHaveBeenCalled();
  });
});
