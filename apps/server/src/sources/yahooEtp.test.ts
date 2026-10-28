import { describe, expect, it, vi } from 'vitest';
import { createYahooEtpSource } from './yahooEtp.ts';

// 2026-10-28 UCO 실제 응답 모양(봉 3개로 줄임)
const CHART_BODY = {
  chart: {
    result: [
      {
        meta: {
          symbol: 'UCO',
          instrumentType: 'ETF',
          // 2008-11-25 09:30 EST
          firstTradeDate: 1227623400,
          exchangeTimezoneName: 'America/New_York',
        },
        timestamp: [1792935000, 1793021400, 1793107800],
        indicators: { quote: [{ close: [64, null, 65], volume: [1000, 2000, 3000] }] },
      },
    ],
    error: null,
  },
};

describe('createYahooEtpSource', () => {
  it('상장일은 거래소 시간대 날짜, 거래대금은 종가 × 거래량(빠진 날 제외)', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(CHART_BODY));
    const source = createYahooEtpSource({ fetchFn });

    expect(await source.daily('UCO')).toEqual({
      listedDate: '2008-11-25',
      tradingValues: [64_000, 195_000],
    });
    expect(fetchFn.mock.calls[0][0]).toBe(
      'https://query1.finance.yahoo.com/v8/finance/chart/UCO?range=2mo&interval=1d',
    );
  });

  it('상장일이 없으면 null, 봉이 없으면 빈 배열', async () => {
    const result = CHART_BODY.chart.result[0];
    const body = {
      chart: {
        result: [
          {
            ...result,
            meta: { ...result.meta, firstTradeDate: null },
            timestamp: undefined,
            indicators: { quote: [{}] },
          },
        ],
      },
    };
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(body));

    expect(await createYahooEtpSource({ fetchFn }).daily('UCO')).toEqual({
      listedDate: null,
      tradingValues: [],
    });
  });

  it('HTTP 오류나 형식이 다르면 실패한다', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(
        Response.json({ chart: { result: null, error: { code: 'Not Found' } } }),
      );
    const source = createYahooEtpSource({ fetchFn });

    await expect(source.daily('ZZZZQ')).rejects.toThrow('Yahoo ZZZZQ: HTTP 404');
    await expect(source.daily('ZZZZQ')).rejects.toThrow();
  });
});
