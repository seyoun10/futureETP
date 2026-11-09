import { describe, expect, it, vi } from 'vitest';
import {
  BAR_CACHE_TTL_MS,
  MIN_CALL_INTERVAL_MS,
  RATE_LIMIT_WAIT_MS,
  createMassiveSettlementSource,
  parseMassiveTicker,
} from './massiveSettlement.ts';

const contract = (ticker: string, lastTradeDate: string, firstTradeDate = '2020-01-02') => ({
  active: true,
  ticker,
  type: 'single',
  first_trade_date: firstTradeDate,
  last_trade_date: lastTradeDate,
});

const bar = (sessionEndDate: string, settle: number | null, volume = 100) => ({
  ticker: 'x',
  session_end_date: sessionEndDate,
  open: 1,
  high: 2,
  low: 0.5,
  close: 1.5,
  volume,
  ...(settle === null ? {} : { settlement_price: settle }),
});

const CL_CONTRACTS = {
  status: 'OK',
  results: [
    contract('CLX6', '2026-10-20'),
    contract('CLZ6', '2026-11-20'),
    contract('CLF7', '2026-12-18'),
    contract('CLF30', '2029-12-19'),
    contract('CLG38', '2038-01-20', '2030-01-01'),
  ],
};

// 경로별 응답. 시계는 sleep만큼 흐른다
function fakeApi(routes: Record<string, () => Response>) {
  let clock = 0;
  const calls: { path: string; at: number; auth: string | null }[] = [];
  const fetchFn = vi.fn((input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    calls.push({
      path: `${url.pathname}${url.search}`,
      at: clock,
      auth: new Headers(init?.headers).get('authorization'),
    });
    const route = routes[url.pathname];
    return Promise.resolve(route ? route() : new Response('404 page not found', { status: 404 }));
  });
  const sleep = vi.fn((ms: number) => {
    clock += ms;
    return Promise.resolve();
  });
  const source = createMassiveSettlementSource({
    apiKey: 'test-key',
    fetchFn,
    sleep,
    now: () => clock,
    log: () => {},
  });
  return { source, calls, sleep, advance: (ms: number) => (clock += ms) };
}

const json = (body: unknown) => () => Response.json(body);

describe('parseMassiveTicker', () => {
  it('연도 1자리는 최종 거래일 근처의 해로 푼다', () => {
    expect(parseMassiveTicker('CL', 'CLZ6', '2026-11-20')).toBe('2026-12');
    expect(parseMassiveTicker('CL', 'CLF7', '2026-12-18')).toBe('2027-01');
    expect(parseMassiveTicker('GC', 'GCZ6', '2026-12-29')).toBe('2026-12');
  });

  it('연도 2자리(먼 월물·NG)는 그대로 쓴다', () => {
    expect(parseMassiveTicker('CL', 'CLF30', '2029-12-19')).toBe('2030-01');
    expect(parseMassiveTicker('NG', 'NGF27', '2026-12-29')).toBe('2027-01');
  });

  it('형식이 다르거나 최종 거래일과 맞지 않으면 실패한다', () => {
    expect(() => parseMassiveTicker('CL', 'CL:BF F0-G0-H0', '2019-12-19')).toThrow(/unexpected/);
    expect(() => parseMassiveTicker('CL', 'NGF27', '2026-12-29')).toThrow(/unexpected/);
    expect(() => parseMassiveTicker('CL', 'CLZ29', '2026-11-20')).toThrow(/does not match/);
  });
});

describe('Massive 정산 소스', () => {
  it('월물 정의는 그날 거래되는 월물을 표준 심볼로 준다', async () => {
    const { source, calls } = fakeApi({ '/futures/v1/contracts': json(CL_CONTRACTS) });
    const definitions = await source.listContracts('CL', '2026-10-27');

    expect(definitions).toEqual([
      {
        symbol: 'CLZ26',
        contractMonth: '2026-12',
        firstTradeDate: '2020-01-02',
        lastTradeDate: '2026-11-20',
      },
      {
        symbol: 'CLF27',
        contractMonth: '2027-01',
        firstTradeDate: '2020-01-02',
        lastTradeDate: '2026-12-18',
      },
      {
        symbol: 'CLF30',
        contractMonth: '2030-01',
        firstTradeDate: '2020-01-02',
        lastTradeDate: '2029-12-19',
      },
    ]);
    expect(calls[0].path).toBe(
      '/futures/v1/contracts?product_code=CL&date=2026-10-27&type=single&limit=1000',
    );
    expect(calls[0].auth).toBe('Bearer test-key');
  });

  it('그날 정산가가 있는 봉만 일봉으로 주고, 거래 없는 월물·반영 전 봉은 뺀다', async () => {
    const { source, calls } = fakeApi({
      '/futures/v1/contracts': json(CL_CONTRACTS),
      '/futures/v1/aggs/CLZ6': json({
        results: [
          bar('2026-10-28', null),
          bar('2026-10-27', 99.9, 195054),
          bar('2026-10-26', 101.76),
        ],
      }),
      // 10-27에 거래 없음
      '/futures/v1/aggs/CLF7': json({ results: [bar('2026-10-28', null), bar('2026-10-26', 100)] }),
      '/futures/v1/aggs/CLF30': json({ results: [], status: 'OK' }),
    });
    const bars = await source.fetchDailyBars('CL', ['CLZ26', 'CLF27', 'CLF30'], '2026-10-27');

    expect(bars).toEqual([
      { contractSymbol: 'CLZ26', open: 1, high: 2, low: 0.5, settle: 99.9, volume: 195054 },
    ]);
    // 티커 표가 없으면 월물 정의를 먼저 받는다
    expect(calls.map((c) => c.path.split('?')[0])).toEqual([
      '/futures/v1/contracts',
      '/futures/v1/aggs/CLZ6',
      '/futures/v1/aggs/CLF7',
      '/futures/v1/aggs/CLF30',
    ]);
    expect(calls[1].path).toBe('/futures/v1/aggs/CLZ6?resolution=1session&limit=10');
  });

  it('정산 전이면 빈 결과다', async () => {
    const { source } = fakeApi({
      '/futures/v1/contracts': json(CL_CONTRACTS),
      '/futures/v1/aggs/CLZ6': json({ results: [bar('2026-10-27', null)] }),
    });
    expect(await source.fetchDailyBars('CL', ['CLZ26'], '2026-10-27')).toEqual([]);
  });

  it('호출 사이를 최소 간격만큼 띄운다', async () => {
    const { source, calls } = fakeApi({
      '/futures/v1/contracts': json(CL_CONTRACTS),
      '/futures/v1/aggs/CLZ6': json({ results: [bar('2026-10-27', 99.9)] }),
      '/futures/v1/aggs/CLF7': json({ results: [bar('2026-10-27', 99.5)] }),
    });
    await source.fetchDailyBars('CL', ['CLZ26', 'CLF27'], '2026-10-27');
    const gaps = calls.slice(1).map((c, i) => c.at - calls[i].at);
    expect(gaps).toEqual([MIN_CALL_INTERVAL_MS, MIN_CALL_INTERVAL_MS]);
  });

  it('429면 기다렸다가 다시 부른다', async () => {
    let first = true;
    const { source, sleep } = fakeApi({
      '/futures/v1/contracts': () => {
        if (!first) return Response.json(CL_CONTRACTS);
        first = false;
        return new Response('too many', { status: 429 });
      },
    });
    expect(await source.listContracts('CL', '2026-10-27')).toHaveLength(3);
    expect(sleep).toHaveBeenCalledWith(RATE_LIMIT_WAIT_MS);
  });

  it('429가 계속되거나 다른 오류 상태면 실패한다', async () => {
    const limited = fakeApi({
      '/futures/v1/contracts': () => new Response('too many', { status: 429 }),
    });
    await expect(limited.source.listContracts('CL', '2026-10-27')).rejects.toThrow(/HTTP 429/);

    const forbidden = fakeApi({
      '/futures/v1/contracts': () => new Response('not entitled', { status: 403 }),
    });
    await expect(forbidden.source.listContracts('CL', '2026-10-27')).rejects.toThrow(
      /contracts: HTTP 403 not entitled/,
    );
  });

  it('응답 형식이 다르면 실패한다', async () => {
    const { source } = fakeApi({
      '/futures/v1/contracts': json(CL_CONTRACTS),
      '/futures/v1/aggs/CLZ6': json({
        results: [{ ...bar('2026-10-27', null), settlement_price: '99.9' }],
      }),
    });
    await expect(source.fetchDailyBars('CL', ['CLZ26'], '2026-10-27')).rejects.toThrow();
  });

  it('키가 없으면 부르지 않고 실패한다', async () => {
    const fetchFn = vi.fn<typeof fetch>();
    const source = createMassiveSettlementSource({ apiKey: undefined, fetchFn });
    await expect(source.listContracts('CL', '2026-10-27')).rejects.toThrow(/MASSIVE_API_KEY/);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('따라잡기·정정 확인은 받아 둔 봉을 다시 쓰고, 정산 전이었거나 오래됐으면 다시 받는다', async () => {
    let settled = false;
    const { source, calls, advance } = fakeApi({
      '/futures/v1/contracts': json(CL_CONTRACTS),
      '/futures/v1/aggs/CLZ6': () =>
        Response.json({
          results: [bar('2026-10-27', settled ? 99.9 : null), bar('2026-10-26', 101.76)],
        }),
    });
    const aggCalls = () => calls.filter((c) => c.path.startsWith('/futures/v1/aggs')).length;

    await source.fetchDailyBars('CL', ['CLZ26'], '2026-10-26');
    // 10-26은 이미 정산가가 있어 10-26 확인에는 다시 쓴다
    expect(await source.fetchDailyBars('CL', ['CLZ26'], '2026-10-26')).toHaveLength(1);
    expect(aggCalls()).toBe(1);
    // 10-27은 받은 봉에 정산가가 없어 다시 받는다
    expect(await source.fetchDailyBars('CL', ['CLZ26'], '2026-10-27')).toEqual([]);
    expect(aggCalls()).toBe(2);
    settled = true;
    expect(await source.fetchDailyBars('CL', ['CLZ26'], '2026-10-27')).toHaveLength(1);
    expect(aggCalls()).toBe(3);

    advance(BAR_CACHE_TTL_MS);
    await source.fetchDailyBars('CL', ['CLZ26'], '2026-10-26');
    expect(aggCalls()).toBe(4);
  });

  it('받아 둔 봉에 그날 봉이 없으면 더 뒤 정산가가 있어도 다시 받는다(정정 확인 재시도)', async () => {
    let reappeared = false;
    const { source, calls } = fakeApi({
      '/futures/v1/contracts': json(CL_CONTRACTS),
      '/futures/v1/aggs/CLZ6': () =>
        Response.json({
          results: [bar('2026-10-27', 99.9), ...(reappeared ? [bar('2026-10-26', 101.76)] : [])],
        }),
    });
    const aggCalls = () => calls.filter((c) => c.path.startsWith('/futures/v1/aggs')).length;

    await source.fetchDailyBars('CL', ['CLZ26'], '2026-10-27');
    expect(await source.fetchDailyBars('CL', ['CLZ26'], '2026-10-26')).toEqual([]);
    expect(aggCalls()).toBe(2);
    reappeared = true;
    expect(await source.fetchDailyBars('CL', ['CLZ26'], '2026-10-26')).toHaveLength(1);
    expect(aggCalls()).toBe(3);
    // 그날 봉이 있으면 다시 받지 않는다
    expect(await source.fetchDailyBars('CL', ['CLZ26'], '2026-10-26')).toHaveLength(1);
    expect(aggCalls()).toBe(3);
  });

  it('보충은 월물마다 한 번 받아 시작일 이후 정산가가 있는 봉을 날짜와 함께 준다', async () => {
    const { source, calls } = fakeApi({
      '/futures/v1/contracts': json(CL_CONTRACTS),
      '/futures/v1/aggs/CLZ6': json({
        results: [bar('2026-10-30', null), bar('2026-10-28', 99.9, 7), bar('2026-10-16', 98)],
      }),
      // 드문 월물: 받아 둔 봉에 시작일 이후 정산가가 없어도 다시 받지 않는다
      '/futures/v1/aggs/CLF30': json({ results: [bar('2026-10-23', 70, 1)] }),
    });
    const bars = await source.fetchRecentBars('CL', ['CLZ26', 'CLF30', 'CLH27'], '2026-10-19');

    expect(bars).toEqual([
      {
        contractSymbol: 'CLZ26',
        tradeDate: '2026-10-28',
        open: 1,
        high: 2,
        low: 0.5,
        settle: 99.9,
        volume: 7,
      },
      {
        contractSymbol: 'CLF30',
        tradeDate: '2026-10-23',
        open: 1,
        high: 2,
        low: 0.5,
        settle: 70,
        volume: 1,
      },
    ]);
    expect(calls.map((c) => c.path.split('?')[0])).toEqual([
      '/futures/v1/contracts',
      '/futures/v1/aggs/CLZ6',
      '/futures/v1/aggs/CLF30',
    ]);
  });

  it('월물 정의에 없는 심볼은 봉이 없는 것처럼 빠진다', async () => {
    const { source } = fakeApi({
      '/futures/v1/contracts': json(CL_CONTRACTS),
      '/futures/v1/aggs/CLZ6': json({ results: [bar('2026-10-27', 99.9)] }),
    });
    const bars = await source.fetchDailyBars('CL', ['CLH27', 'CLZ26'], '2026-10-27');
    expect(bars.map((b) => b.contractSymbol)).toEqual(['CLZ26']);
  });

  it('형식이 다른 티커는 건너뛰고 나머지 월물 정의는 준다', async () => {
    const { source } = fakeApi({
      '/futures/v1/contracts': json({
        results: [
          ...CL_CONTRACTS.results,
          contract('CLZ29', '2026-11-20'),
          contract('CL-X', '2026-11-20'),
        ],
      }),
    });
    expect(await source.listContracts('CL', '2026-10-27')).toHaveLength(3);
  });

  it('다음 페이지 주소가 다른 호스트면 실패한다', async () => {
    const { source } = fakeApi({
      '/futures/v1/contracts': json({
        ...CL_CONTRACTS,
        next_url: 'https://api.polygon.io/futures/v1/contracts?cursor=abc',
      }),
    });
    await expect(source.listContracts('CL', '2026-10-27')).rejects.toThrow(/api\.polygon\.io/);
  });

  it('다음 페이지가 있으면 이어 받는다', async () => {
    let page = 0;
    const { source } = fakeApi({
      '/futures/v1/contracts': () =>
        Response.json(
          page++ === 0
            ? {
                results: [contract('CLZ6', '2026-11-20')],
                next_url: 'https://api.massive.com/futures/v1/contracts?cursor=abc',
              }
            : { results: [contract('CLF7', '2026-12-18')] },
        ),
    });
    expect((await source.listContracts('CL', '2026-10-27')).map((c) => c.symbol)).toEqual([
      'CLZ26',
      'CLF27',
    ]);
  });

  it('거래량이 비어 있으면 0이다', async () => {
    const { source } = fakeApi({
      '/futures/v1/contracts': json(CL_CONTRACTS),
      '/futures/v1/aggs/CLZ6': json({
        results: [{ ...bar('2026-10-27', 99.9), volume: null }],
      }),
    });
    const [only] = await source.fetchDailyBars('CL', ['CLZ26'], '2026-10-27');
    expect(only.volume).toBe(0);
  });

  it('월물 정의는 따라잡기 날짜마다 다시 받지 않고, 오래되면 다시 받는다', async () => {
    const { source, calls, advance } = fakeApi({ '/futures/v1/contracts': json(CL_CONTRACTS) });
    const contractCalls = () =>
      calls.filter((c) => c.path.startsWith('/futures/v1/contracts')).length;

    await source.listContracts('CL', '2026-10-26');
    expect(await source.listContracts('CL', '2026-10-27')).toHaveLength(3);
    expect(contractCalls()).toBe(1);
    advance(BAR_CACHE_TTL_MS);
    await source.listContracts('CL', '2026-10-28');
    expect(contractCalls()).toBe(2);
  });

  it('요청마다 시간 제한을 건다', async () => {
    const fetchFn = vi.fn<typeof fetch>(() => Promise.resolve(Response.json(CL_CONTRACTS)));
    const source = createMassiveSettlementSource({
      apiKey: 'k',
      fetchFn,
      sleep: () => Promise.resolve(),
    });
    await source.listContracts('CL', '2026-10-27');
    expect(fetchFn.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });
});
