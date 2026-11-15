import { describe, expect, it, vi } from 'vitest';
import { fetchJson, fetchJsonOrNull } from './http.ts';

const respond = (status: number, body: string) =>
  vi.fn<typeof fetch>(() => Promise.resolve(new Response(body, { status })));

describe('fetchJson', () => {
  it('returns the JSON body and passes headers with a timeout signal', async () => {
    const fetchFn = respond(200, '{"a":1}');
    const body = await fetchJson(fetchFn, 'https://x.test/a', {
      label: 'X a',
      timeoutMs: 1000,
      headers: { k: 'v' },
    });
    expect(body).toEqual({ a: 1 });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://x.test/a');
    expect(init?.headers).toEqual({ k: 'v' });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('omits headers when none are given', async () => {
    const fetchFn = respond(200, '{}');
    await fetchJson(fetchFn, 'https://x.test/a', { label: 'X a', timeoutMs: 1000 });
    expect(Object.keys(fetchFn.mock.calls[0][1] ?? {})).toEqual(['signal']);
  });

  it('throws with the label and status, adding the body only when asked', async () => {
    await expect(
      fetchJson(respond(500, 'boom'), 'https://x.test', { label: 'X a', timeoutMs: 1000 }),
    ).rejects.toThrow(/^X a: HTTP 500$/);
    await expect(
      fetchJson(respond(500, 'boom'), 'https://x.test', {
        label: 'X a',
        timeoutMs: 1000,
        withBody: true,
      }),
    ).rejects.toThrow('X a: HTTP 500 boom');
  });
});

describe('fetchJsonOrNull', () => {
  it('returns null on 404 and still throws other failures', async () => {
    const options = { label: 'X a', timeoutMs: 1000 };
    expect(await fetchJsonOrNull(respond(404, ''), 'https://x.test', options)).toBeNull();
    await expect(fetchJsonOrNull(respond(503, ''), 'https://x.test', options)).rejects.toThrow(
      'X a: HTTP 503',
    );
  });
});
