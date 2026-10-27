import { describe, expect, it, vi } from 'vitest';
import { createDatabentoClient, outrightRawSymbols } from './databento.ts';

describe('outrightRawSymbols', () => {
  it('월 코드 12개 × 연도 1자리 10개의 단일 월물이다', () => {
    const symbols = outrightRawSymbols('CL');
    expect(symbols).toHaveLength(120);
    expect(symbols).toContain('CLF0');
    expect(symbols).toContain('CLZ9');
    expect(symbols.every((s) => /^CL[FGHJKMNQUVXZ]\d$/.test(s))).toBe(true);
  });
});

describe('createDatabentoClient', () => {
  const request = {
    schema: 'statistics' as const,
    symbols: ['CLZ6', 'CLF7'],
    start: '2010-06-06',
    end: '2026-10-27T00:00:00Z',
  };

  it('견적은 Basic 인증(키:빈 비밀번호) POST form으로 보낸다', async () => {
    const fetchFn = vi.fn<typeof fetch>(() => Promise.resolve(new Response('6.79')));
    const client = createDatabentoClient('db-key', fetchFn);
    expect(await client.cost(request)).toBe(6.79);

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://hist.databento.com/v0/metadata.get_cost');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>).authorization).toBe(
      `Basic ${Buffer.from('db-key:').toString('base64')}`,
    );
    const form = init?.body as URLSearchParams;
    expect(Object.fromEntries(form)).toEqual({
      dataset: 'GLBX.MDP3',
      schema: 'statistics',
      symbols: 'CLZ6,CLF7',
      stype_in: 'raw_symbol',
      start: '2010-06-06',
      end: '2026-10-27T00:00:00Z',
    });
  });

  it('HTTP 오류는 상태와 본문을 담아 던진다', async () => {
    const fetchFn = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response('bad symbols', { status: 422 })),
    );
    const client = createDatabentoClient('db-key', fetchFn);
    await expect(client.cost(request)).rejects.toThrow(/HTTP 422 bad symbols/);
  });

  it('스키마별 범위 끝을 읽는다', async () => {
    const body = { schema: { statistics: { end: '2026-10-27T00:13:51Z' } } };
    const fetchFn = vi.fn<typeof fetch>(() => Promise.resolve(Response.json(body)));
    const client = createDatabentoClient('db-key', fetchFn);
    expect(await client.datasetRangeEnd('statistics')).toBe('2026-10-27T00:13:51Z');
    await expect(client.datasetRangeEnd('definition')).rejects.toThrow(/no range/);
  });
});
