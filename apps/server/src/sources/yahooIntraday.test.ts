import { describe, expect, it, vi } from 'vitest';
import { MIN_CALL_INTERVAL_MS, createYahooIntradaySource, toYahooSymbol } from './yahooIntraday.ts';

// 2026-10-27 17:00 CDT 세션 시작
const SESSION_OPEN = new Date('2026-10-27T22:00:00Z');
const T0 = SESSION_OPEN.getTime() / 1000;

const chart = (meta: Record<string, unknown>, timestamps: number[], opens: (number | null)[]) => ({
  chart: {
    result: [
      {
        meta: { symbol: 'CLZ26.NYM', currency: 'USD', ...meta },
        timestamp: timestamps,
        indicators: { quote: [{ open: opens, close: opens }] },
      },
    ],
    error: null,
  },
});

const NOT_FOUND = () => Response.json({ chart: { result: null, error: {} } }, { status: 404 });

// 경로별 응답. 시계는 sleep만큼 흐른다
function fakeApi(route: (url: URL) => Response) {
  let clock = 1_000_000;
  const urls: URL[] = [];
  const fetchFn = vi.fn((input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input);
    urls.push(url);
    return Promise.resolve(route(url));
  });
  const sleep = vi.fn((ms: number) => {
    clock += ms;
    return Promise.resolve();
  });
  const log = vi.fn();
  const source = createYahooIntradaySource({ fetchFn, sleep, now: () => clock, log });
  return { source, urls, sleep, log };
}

describe('toYahooSymbol', () => {
  it('에너지는 .NYM, 금속은 .CMX', () => {
    expect(toYahooSymbol('CLZ26')).toBe('CLZ26.NYM');
    expect(toYahooSymbol('NGF27')).toBe('NGF27.NYM');
    expect(toYahooSymbol('GCZ26')).toBe('GCZ26.CMX');
    expect(toYahooSymbol('SIH27')).toBe('SIH27.CMX');
  });
});

describe('fetchSessionQuotes', () => {
  it('meta 세션 누적 값과 세션 시작 뒤 첫 5분봉 시가를 쓴다', async () => {
    const { source, urls } = fakeApi(() =>
      Response.json(
        chart(
          {
            regularMarketPrice: 101.68,
            regularMarketTime: T0 + 3600,
            regularMarketDayHigh: 101.77,
            regularMarketDayLow: 99.75,
            regularMarketVolume: 27662,
            priceHint: 2,
          },
          // 세션 전 정비 시간 봉(null)과 세션 첫 봉 시가 null은 건너뛰고, float32 시가는 priceHint 자릿수로 반올림한다
          [T0 - 300, T0, T0 + 300],
          [null, null, 100.16999816894531],
        ),
      ),
    );
    expect(await source.fetchSessionQuotes(['CLZ26'], SESSION_OPEN)).toEqual([
      {
        contractSymbol: 'CLZ26',
        last: 101.68,
        dayOpen: 100.17,
        dayHigh: 101.77,
        dayLow: 99.75,
        volume: 27662,
        sourceTime: new Date((T0 + 3600) * 1000),
      },
    ]);
    expect(urls[0].pathname).toBe('/v8/finance/chart/CLZ26.NYM');
    expect(urls[0].searchParams.get('period1')).toBe(String(T0));
    expect(urls[0].searchParams.get('interval')).toBe('5m');
  });

  it('세션에 아직 체결이 없으면 현재가만 쓴다(meta 고가·저가는 지난 세션 값)', async () => {
    const { source } = fakeApi(() =>
      Response.json(
        chart(
          {
            regularMarketPrice: 90,
            regularMarketTime: T0 - 7200,
            regularMarketDayHigh: 95,
            regularMarketDayLow: 85,
            regularMarketVolume: 10,
          },
          [],
          [],
        ),
      ),
    );
    const [quote] = await source.fetchSessionQuotes(['CLF30'], SESSION_OPEN);
    expect(quote).toMatchObject({ last: 90, dayOpen: null, dayHigh: null, dayLow: null });
    expect(quote.volume).toBeNull();
  });

  it('404(만기) 월물은 빠지고, 호출 사이를 띄운다', async () => {
    const { source, sleep, log } = fakeApi((url) =>
      url.pathname.endsWith('CLX26.NYM')
        ? NOT_FOUND()
        : Response.json(chart({ regularMarketPrice: 1, regularMarketTime: T0 + 60 }, [], [])),
    );
    const quotes = await source.fetchSessionQuotes(['CLX26', 'CLZ26'], SESSION_OPEN);
    expect(quotes.map((q) => q.contractSymbol)).toEqual(['CLZ26']);
    expect(log).toHaveBeenCalledWith('[yahoo] no chart for CLX26');
    expect(sleep).toHaveBeenCalledWith(MIN_CALL_INTERVAL_MS);
  });

  it('응답 형식이 다르거나 HTTP 오류면 던진다', async () => {
    const bad = fakeApi(() => Response.json({ chart: { result: [{ meta: {} }] } }));
    await expect(bad.source.fetchSessionQuotes(['CLZ26'], SESSION_OPEN)).rejects.toThrow();
    const limited = fakeApi(() => new Response('Too Many Requests', { status: 429 }));
    await expect(limited.source.fetchSessionQuotes(['CLZ26'], SESSION_OPEN)).rejects.toThrow(
      'Yahoo /v8/finance/chart/CLZ26.NYM: HTTP 429',
    );
  });
});

describe('fetchLastPrices', () => {
  it('20개씩 나눠 받고, 마지막 null 아닌 종가를 쓰며, 없는 심볼·체결 없는 월물은 빠진다', async () => {
    const symbols = Array.from(
      { length: 21 },
      (_, i) => `NG${'FGHJKMNQUVXZ'[i % 12]}${27 + Math.floor(i / 12)}`,
    );
    const { source, urls, log } = fakeApi((url) => {
      const requested = url.searchParams.get('symbols')!.split(',');
      // 두 번째 묶음은 모두 없어 404
      if (requested.length === 1)
        return Response.json({ spark: { result: null } }, { status: 404 });
      return Response.json(
        Object.fromEntries(
          requested
            .filter((s) => s !== 'NGG27.NYM')
            .map((s) => [
              s,
              // 그날 체결이 없는 월물은 close가 null
              s === 'NGH27.NYM'
                ? { symbol: s, timestamp: [], close: null, previousClose: 3 }
                : { symbol: s, timestamp: [T0, T0 + 300, T0 + 600], close: [3, 3.1, null] },
            ]),
        ),
      );
    });
    const quotes = await source.fetchLastPrices(symbols);
    expect(urls.map((u) => u.searchParams.get('symbols')!.split(',').length)).toEqual([20, 1]);
    expect(quotes).toHaveLength(18);
    expect(quotes[0]).toEqual({
      contractSymbol: 'NGF27',
      last: 3.1,
      dayOpen: null,
      dayHigh: null,
      dayLow: null,
      volume: null,
      sourceTime: new Date((T0 + 300) * 1000),
    });
    expect(log).toHaveBeenCalledWith('[yahoo] no spark price for NGG27, NGH27, NGU28');
  });
});
