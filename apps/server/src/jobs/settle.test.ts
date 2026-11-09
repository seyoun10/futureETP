import { readFileSync } from 'node:fs';
import { COMMODITY_CODES, type CommodityCode } from '@futureetp/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  CME_TIME_ZONE,
  buildTradingDays,
  zonedTimeToUtc,
  type CalendarInput,
} from '../calc/tradingCalendar.ts';
import { toContractSymbol } from '../calc/contractSymbol.ts';
import type { JobName } from '../constants.ts';
import type {
  ContractDefinition,
  DatedSourceBar,
  SettlementSource,
  SourceBar,
} from '../sources/settlement.ts';
import type { JobContext } from './runner.ts';
import {
  BACKFILL_DAYS,
  createSettleHandlers,
  MAX_SETTLE_CONTRACTS,
  SKIP_LOOKBACK_DAYS,
  type DailyBarRow,
  type NewContract,
  type SettleStore,
} from './settle.ts';

const DAYS = buildTradingDays(
  JSON.parse(
    readFileSync(new URL('../../../../scripts/calendar/2026.json', import.meta.url), 'utf8'),
  ) as CalendarInput,
);

const ct = (date: string, time: string) => zonedTimeToUtc(date, time, CME_TIME_ZONE);
const NOW = ct('2026-10-27', '18:30');

function memoryStore(lastSuccess: Partial<Record<JobName, string>> = {}) {
  const contracts: NewContract[] = [];
  const bars = new Map<string, DailyBarRow>();
  // `원자재|거래일` → 지수에 쓴 월물
  const indexSymbols = new Map<string, string[]>();
  const store: SettleStore = {
    tradingDays: (from, to) =>
      Promise.resolve(DAYS.filter((d) => d.tradeDate >= from && d.tradeDate <= to)),
    lastSuccessTradeDate: (job) => Promise.resolve(lastSuccess[job] ?? null),
    lastDailyBarDate: () =>
      Promise.resolve(
        [...bars.values()]
          .map((b) => b.tradeDate)
          .reduce<string | null>((a, d) => (a === null || d > a ? d : a), null),
      ),
    activeMonthRules: (code) =>
      Promise.resolve(
        code === 'GC'
          ? [{ validFrom: '2010-01-01', validTo: null, months: [2, 4, 6, 8, 10, 12] }]
          : [],
      ),
    contracts: (code) => Promise.resolve(contracts.filter((c) => c.commodityCode === code)),
    insertContracts(rows) {
      for (const row of rows) {
        if (!contracts.some((c) => c.symbol === row.symbol)) contracts.push(row);
      }
      return Promise.resolve();
    },
    dailyBars: (code, tradeDate) =>
      Promise.resolve(
        [...bars.values()].filter(
          (b) => b.tradeDate === tradeDate && b.contractSymbol.startsWith(code),
        ),
      ),
    sourceBarDates: (code, source, from, to) =>
      Promise.resolve(
        [...bars.values()].filter(
          (b) =>
            b.contractSymbol.startsWith(code) &&
            b.source === source &&
            b.tradeDate >= from &&
            b.tradeDate <= to,
        ),
      ),
    indexSymbols: (code, tradeDate) =>
      Promise.resolve(indexSymbols.get(`${code}|${tradeDate}`) ?? []),
    upsertDailyBars(rows) {
      for (const row of rows) bars.set(`${row.contractSymbol}|${row.tradeDate}`, row);
      return Promise.resolve();
    },
  };
  return { store, contracts, bars, indexSymbols };
}

// 원자재마다 두 월물: 12월물(최종 거래일 11-20), 1월물(12-18). 값은 settle 함수로 바꿀 수 있다
function testSource(settle: (symbol: string, tradeDate: string) => number | null = () => 100) {
  const definitions = (code: CommodityCode): ContractDefinition[] => [
    {
      symbol: `${code}Z26`,
      contractMonth: '2026-12',
      firstTradeDate: null,
      lastTradeDate: '2026-11-20',
    },
    {
      symbol: `${code}F27`,
      contractMonth: '2027-01',
      firstTradeDate: '2026-10-27',
      lastTradeDate: '2026-12-18',
    },
  ];
  const listContracts = vi.fn((code: CommodityCode) => Promise.resolve(definitions(code)));
  const fetchDailyBars = vi.fn(
    (_code: CommodityCode, symbols: readonly string[], tradeDate: string) =>
      Promise.resolve(
        symbols.flatMap((contractSymbol): SourceBar[] => {
          const value = settle(contractSymbol, tradeDate);
          return value === null
            ? []
            : [{ contractSymbol, open: null, high: null, low: null, settle: value, volume: 10 }];
        }),
      ),
  );
  // 테스트 기간(2026-11-06)까지의 거래일 봉
  const fetchRecentBars = vi.fn((_code: CommodityCode, symbols: readonly string[], from: string) =>
    Promise.resolve(
      DAYS.filter((d) => d.tradeDate >= from && d.tradeDate <= '2026-11-06').flatMap((d) =>
        symbols.flatMap((contractSymbol): DatedSourceBar[] => {
          const value = settle(contractSymbol, d.tradeDate);
          return value === null
            ? []
            : [
                {
                  contractSymbol,
                  tradeDate: d.tradeDate,
                  open: null,
                  high: null,
                  low: null,
                  settle: value,
                  volume: 10,
                },
              ];
        }),
      ),
    ),
  );
  const source: SettlementSource = { name: 'FAKE', listContracts, fetchDailyBars, fetchRecentBars };
  return { source, listContracts, fetchDailyBars, fetchRecentBars };
}

const ctx = (now = NOW): JobContext => ({ now });

// 원자재마다 2026-11월물부터 30개 월물(최종 거래일은 그달 1일). 먼 쪽부터 준다
const MONTHS = Array.from({ length: 30 }, (_, i) => {
  const total = 2026 * 12 + 10 + i;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
});

function manyContractsSource() {
  const many = testSource();
  many.listContracts.mockImplementation((code: CommodityCode) =>
    Promise.resolve(
      MONTHS.toReversed().map((contractMonth) => ({
        symbol: toContractSymbol(code, contractMonth),
        contractMonth,
        firstTradeDate: null,
        lastTradeDate: `${contractMonth}-01`,
      })),
    ),
  );
  return many;
}

function setup(lastSuccess: Partial<Record<JobName, string>>, source = testSource()) {
  const memory = memoryStore(lastSuccess);
  const recompute = vi.fn<(code: CommodityCode, now: Date) => Promise<void>>(() =>
    Promise.resolve(),
  );
  const handlers = createSettleHandlers({
    store: memory.store,
    source: source.source,
    recompute,
    log: () => {},
  });
  return { ...memory, source, recompute, handlers };
}

describe('DAILY_SETTLE', () => {
  it('월물을 상장하고 그날 일봉을 저장한 뒤 원자재마다 재계산한다', async () => {
    const { handlers, contracts, bars, recompute } = setup({ DAILY_SETTLE: '2026-10-26' });
    const c = ctx();
    await handlers.DAILY_SETTLE(c);

    expect(c.tradeDate).toBe('2026-10-27');
    // 금은 활성 월물(짝수 달)만 대상
    expect(contracts.find((x) => x.symbol === 'GCF27')?.isTarget).toBe(false);
    expect(contracts.find((x) => x.symbol === 'CLF27')?.isTarget).toBe(true);
    expect(bars.get('CLZ26|2026-10-27')).toMatchObject({
      settle: 100,
      source: 'FAKE',
      collectedAt: NOW,
      revisedAt: null,
    });
    expect(bars.size).toBe(8);
    expect(recompute.mock.calls.map(([code]) => code)).toEqual(['GC', 'SI', 'CL', 'NG']);
  });

  it('최종 거래일이 지났거나 아직 첫 거래일 전인 월물은 받지 않는다', async () => {
    const { handlers, source } = setup({ DAILY_SETTLE: '2026-11-20' });
    // 11-23(월): CLZ26 최종 거래일(11-20) 지남
    await handlers.DAILY_SETTLE(ctx(ct('2026-11-23', '18:30')));
    expect(source.fetchDailyBars.mock.calls[0][1]).toEqual(['GCF27']);
  });

  it('밀린 거래일을 모두 받고 재계산은 원자재마다 한 번이다', async () => {
    const { handlers, bars, recompute } = setup({ DAILY_SETTLE: '2026-10-22' });
    await handlers.DAILY_SETTLE(ctx());
    const dates = new Set([...bars.values()].map((b) => b.tradeDate));
    expect([...dates]).toEqual(['2026-10-23', '2026-10-26', '2026-10-27']);
    expect(recompute).toHaveBeenCalledTimes(4);
  });

  it('이미 정산한 거래일이면 소스를 부르지 않는다', async () => {
    const { handlers, source, recompute } = setup({ DAILY_SETTLE: '2026-10-27' });
    const c = ctx();
    await handlers.DAILY_SETTLE(c);
    expect(c.tradeDate).toBe('2026-10-27');
    expect(source.listContracts).not.toHaveBeenCalled();
    expect(recompute).not.toHaveBeenCalled();
  });

  it('소스에 아직 일봉이 없는 원자재가 있으면 나머지를 끝내고 실패한다', async () => {
    const source = testSource((symbol) => (symbol.startsWith('SI') ? null : 100));
    const { handlers, recompute } = setup({ DAILY_SETTLE: '2026-10-26' }, source);
    await expect(handlers.DAILY_SETTLE(ctx())).rejects.toThrow(/SI: 2026-10-27: no bars/);
    expect(recompute.mock.calls.map(([code]) => code)).toEqual(['GC', 'CL', 'NG']);
  });

  it('재계산이 실패해도 실패로 끝난다', async () => {
    const { handlers, recompute } = setup({ DAILY_SETTLE: '2026-10-26' });
    recompute.mockRejectedValueOnce(new Error('boom'));
    await expect(handlers.DAILY_SETTLE(ctx())).rejects.toThrow(/Settle failed: GC: boom/);
  });

  it('재시도 때 이미 받은 원자재는 소스를 다시 부르지 않고 재계산만 한다', async () => {
    const source = testSource((symbol) => (symbol.startsWith('SI') ? null : 100));
    const { handlers, recompute } = setup({ DAILY_SETTLE: '2026-10-26' }, source);
    await expect(handlers.DAILY_SETTLE(ctx())).rejects.toThrow(/SI/);
    source.fetchDailyBars.mockClear();
    recompute.mockClear();

    await expect(handlers.DAILY_SETTLE(ctx())).rejects.toThrow(/SI/);
    expect(source.fetchDailyBars.mock.calls.map(([code]) => code)).toEqual(['SI']);
    expect(recompute.mock.calls.map(([code]) => code)).toEqual(['GC', 'CL', 'NG']);
  });

  it('최종 거래일이 가까운 월물 26개만 받는다', async () => {
    // 먼 쪽부터 받아도 만기순으로 고른다
    const { handlers, source } = setup({ DAILY_SETTLE: '2026-10-26' }, manyContractsSource());
    await handlers.DAILY_SETTLE(ctx());

    const symbols = source.fetchDailyBars.mock.calls[0][1];
    expect(symbols).toHaveLength(MAX_SETTLE_CONTRACTS);
    expect(symbols[0]).toBe('GCX26');
    expect(symbols.at(-1)).toBe(toContractSymbol('GC', MONTHS[MAX_SETTLE_CONTRACTS - 1]));
  });

  describe('드문 월물 건너뛰기', () => {
    const LOOKBACK = DAYS.map((d) => d.tradeDate)
      .filter((d) => d < '2026-10-27')
      .slice(-SKIP_LOOKBACK_DAYS);
    const symbolsOf = (code: CommodityCode, ranks: readonly number[]) =>
      ranks.map((i) => toContractSymbol(code, MONTHS[i]));

    // 직전 거래일들에 ranks 순위 월물 봉이 source로 저장된 상태
    async function withHistory(
      history: Partial<Record<CommodityCode, readonly number[]>>,
      dates: readonly string[] = LOOKBACK,
      source: DailyBarRow['source'] = 'FAKE',
    ) {
      const env = setup({ DAILY_SETTLE: '2026-10-26' }, manyContractsSource());
      for (const [code, ranks] of Object.entries(history) as [CommodityCode, number[]][]) {
        await env.store.upsertDailyBars(
          dates.flatMap((tradeDate) =>
            symbolsOf(code, ranks).map((contractSymbol): DailyBarRow => ({
              contractSymbol,
              tradeDate,
              open: null,
              high: null,
              low: null,
              settle: 90,
              volume: 10,
              source,
              collectedAt: NOW,
              revisedAt: null,
            })),
          ),
        );
      }
      await env.handlers.DAILY_SETTLE(ctx());
      const requested = (code: CommodityCode) =>
        env.source.fetchDailyBars.mock.calls.find(([c]) => c === code)?.[1];
      return { ...env, requested };
    }

    const range = (n: number) => Array.from({ length: n }, (_, i) => i);

    it('직전 10거래일 지금 소스 봉이 없던 월물은 건너뛴다', async () => {
      const { requested, bars } = await withHistory({ CL: range(20) });
      expect(requested('CL')).toEqual(symbolsOf('CL', range(20)));
      expect(bars.has(`${symbolsOf('CL', [19])[0]}|2026-10-27`)).toBe(true);
    });

    it('가까운 2개와 가까운 대상 월물 5개는 봉이 없었어도 받는다', async () => {
      // 금 대상 월물은 짝수 달: 12월·2027년 2·4·6·8월. 가까운 2개는 11·12월
      const { requested } = await withHistory({ GC: [20] });
      expect(requested('GC')).toEqual(symbolsOf('GC', [0, 1, 3, 5, 7, 9, 20]));
    });

    it('직전 10거래일을 모두 지금 소스로 정산하지 않았으면 건너뛰지 않는다', async () => {
      const { requested } = await withHistory({ CL: range(5) }, LOOKBACK.slice(1));
      expect(requested('CL')).toHaveLength(MAX_SETTLE_CONTRACTS);
    });

    it('다른 소스(적재) 봉은 이력으로 치지 않는다', async () => {
      const { requested } = await withHistory({ CL: range(26) }, LOOKBACK, 'DATABENTO');
      expect(requested('CL')).toHaveLength(MAX_SETTLE_CONTRACTS);
    });
  });

  it('정산 이력이 없으면 저장된 일봉의 마지막 날 다음부터 따라잡는다(적재 직후)', async () => {
    const { handlers, store, bars } = setup({});
    await store.upsertDailyBars([
      {
        contractSymbol: 'CLZ26',
        tradeDate: '2026-10-23',
        open: null,
        high: null,
        low: null,
        settle: 90,
        volume: 1,
        source: 'DATABENTO',
        collectedAt: NOW,
        revisedAt: null,
      },
    ]);
    await handlers.DAILY_SETTLE(ctx());
    const dates = new Set([...bars.values()].map((b) => b.tradeDate));
    expect([...dates]).toEqual(['2026-10-23', '2026-10-26', '2026-10-27']);
  });
});

describe('SETTLE_REVISION', () => {
  // 10-26 일봉이 저장된 상태에서 10-27 18:30 CT에 돈다. CLQ27은 지수에 쓰지 않는 먼 월물
  async function seeded(settle: (symbol: string, tradeDate: string) => number | null) {
    const env = setup({ DAILY_SETTLE: '2026-10-27' }, testSource(settle));
    await env.store.insertContracts(
      [
        ['CLZ26', '2026-12', '2026-11-20'],
        ['CLF27', '2027-01', '2026-12-18'],
        ['CLQ27', '2027-08', '2027-07-21'],
        ['NGZ26', '2026-12', '2026-11-25'],
      ].map(([symbol, contractMonth, lastTradeDate]) => ({
        symbol,
        commodityCode: symbol.startsWith('CL') ? 'CL' : 'NG',
        contractMonth,
        firstTradeDate: null,
        lastTradeDate,
        isTarget: false,
      })),
    );
    await env.store.upsertDailyBars(
      ['CLZ26', 'CLF27', 'CLQ27', 'NGZ26'].map((contractSymbol) => ({
        contractSymbol,
        tradeDate: '2026-10-26',
        open: null,
        high: null,
        low: null,
        settle: 100,
        volume: 10,
        source: 'FAKE',
        collectedAt: NOW,
        revisedAt: null,
      })),
    );
    env.indexSymbols.set('CL|2026-10-26', ['CLZ26', 'CLF27']);
    env.indexSymbols.set('NG|2026-10-26', ['NGZ26']);
    return env;
  }

  it('바뀐 일봉만 정정 시각과 함께 저장하고 그 원자재만 재계산한다', async () => {
    const { handlers, bars, recompute } = await seeded((symbol) =>
      symbol === 'CLF27' ? 101 : 100,
    );
    const c = ctx();
    await handlers.SETTLE_REVISION(c);

    expect(c.tradeDate).toBe('2026-10-26');
    expect(bars.get('CLF27|2026-10-26')).toMatchObject({ settle: 101, revisedAt: NOW });
    expect(bars.get('CLZ26|2026-10-26')?.revisedAt).toBeNull();
    expect(recompute.mock.calls.map(([code]) => code)).toEqual(['CL']);
  });

  it('정정이 없으면 재계산하지 않는다', async () => {
    const { handlers, recompute } = await seeded(() => 100);
    await handlers.SETTLE_REVISION(ctx());
    expect(recompute).not.toHaveBeenCalled();
  });

  it('정정을 저장하고 재계산에 실패했으면 다음 시도에서 다시 계산한다', async () => {
    const { handlers, recompute } = await seeded((symbol) => (symbol === 'NGZ26' ? 99 : 100));
    recompute.mockRejectedValueOnce(new Error('boom'));
    await expect(handlers.SETTLE_REVISION(ctx())).rejects.toThrow(/Revision failed: NG: boom/);
    await handlers.SETTLE_REVISION(ctx());
    expect(recompute.mock.calls.map(([code]) => code)).toEqual(['NG', 'NG']);
  });

  it('소스에서 지수 월물이 빠지면 확인하지 못한 것으로 실패한다', async () => {
    const { handlers, recompute } = await seeded((symbol) =>
      symbol === 'CLF27' || symbol === 'CLQ27' ? null : 100,
    );
    await expect(handlers.SETTLE_REVISION(ctx())).rejects.toThrow(/CL: .*missing.*: CLF27$/);
    expect(recompute).not.toHaveBeenCalled();
  });

  it('지수에 쓰지 않는 월물만 빠지면 그 월물은 확인하지 않고 나머지를 정정한다', async () => {
    const { handlers, bars, recompute } = await seeded((symbol) =>
      symbol === 'CLQ27' ? null : symbol === 'CLZ26' ? 101 : 100,
    );
    await handlers.SETTLE_REVISION(ctx());
    expect(bars.get('CLZ26|2026-10-26')).toMatchObject({ settle: 101, revisedAt: NOW });
    expect(bars.get('CLQ27|2026-10-26')).toMatchObject({ settle: 100, revisedAt: null });
    expect(recompute.mock.calls.map(([code]) => code)).toEqual(['CL']);
  });

  it('지수 월물이 빠져도 받은 월물의 정정을 저장·재계산한 뒤 실패한다', async () => {
    const { handlers, bars, recompute } = await seeded((symbol) =>
      symbol === 'CLF27' ? null : symbol === 'CLZ26' ? 101 : 100,
    );
    await expect(handlers.SETTLE_REVISION(ctx())).rejects.toThrow(/CL: .*missing.*: CLF27$/);
    expect(bars.get('CLZ26|2026-10-26')).toMatchObject({ settle: 101, revisedAt: NOW });
    expect(recompute.mock.calls.map(([code]) => code)).toEqual(['CL']);
  });

  it('가까운 월물이 아니어도 지수에 쓴 먼 월물(US 기준)이 빠지면 실패한다', async () => {
    const { handlers, indexSymbols } = await seeded((symbol) => (symbol === 'CLQ27' ? null : 100));
    indexSymbols.set('CL|2026-10-26', ['CLZ26', 'CLQ27']);
    await expect(handlers.SETTLE_REVISION(ctx())).rejects.toThrow(/CL: .*missing.*: CLQ27$/);
  });

  it('가까운 월물이어도 지수에 쓰지 않았으면 빠져도 통과한다', async () => {
    const { handlers, indexSymbols, recompute } = await seeded((symbol) =>
      symbol === 'CLF27' ? null : 100,
    );
    indexSymbols.set('CL|2026-10-26', ['CLZ26']);
    await handlers.SETTLE_REVISION(ctx());
    expect(recompute).not.toHaveBeenCalled();
  });

  it('지수 가중치가 없으면 빠진 월물을 모두 지수 월물로 보고 실패한다', async () => {
    const { handlers, indexSymbols } = await seeded((symbol) => (symbol === 'CLQ27' ? null : 100));
    indexSymbols.delete('CL|2026-10-26');
    await expect(handlers.SETTLE_REVISION(ctx())).rejects.toThrow(/CL: .*missing.*: CLQ27$/);
  });

  it('저장된 봉이 지수에 쓰지 않는 월물뿐이어도 응답이 비면 확인하지 못한 것으로 실패한다', async () => {
    const { handlers, bars } = await seeded((symbol) => (symbol.startsWith('CL') ? null : 100));
    bars.delete('CLZ26|2026-10-26');
    bars.delete('CLF27|2026-10-26');
    await expect(handlers.SETTLE_REVISION(ctx())).rejects.toThrow(/CL: .*no bars from FAKE/);
  });

  it('다른 소스(적재)로 저장된 일봉은 다시 확인하지 않는다', async () => {
    const { handlers, store, source, recompute } = await seeded((symbol) =>
      symbol === 'GCZ26' ? null : 100,
    );
    await store.upsertDailyBars([
      {
        contractSymbol: 'GCZ26',
        tradeDate: '2026-10-26',
        open: null,
        high: null,
        low: null,
        settle: 90,
        volume: 12,
        source: 'DATABENTO',
        collectedAt: NOW,
        revisedAt: null,
      },
    ]);
    await handlers.SETTLE_REVISION(ctx());
    expect(source.fetchDailyBars.mock.calls.map(([code]) => code)).toEqual(['CL', 'NG']);
    expect(recompute).not.toHaveBeenCalled();
  });

  it('직전 거래일이 아직 정산 전이면 확인하지 못한 것으로 실패한다', async () => {
    const { handlers, source } = setup({ DAILY_SETTLE: '2026-10-23' });
    const c = ctx();
    await expect(handlers.SETTLE_REVISION(c)).rejects.toThrow(/not settled yet/);
    expect(c.tradeDate).toBe('2026-10-26');
    expect(source.fetchDailyBars).not.toHaveBeenCalled();
  });

  it('이미 확인한 거래일이면 건너뛴다(평일 휴장일 트리거)', async () => {
    const { handlers, source } = setup({
      DAILY_SETTLE: '2026-10-27',
      SETTLE_REVISION: '2026-10-26',
    });
    await handlers.SETTLE_REVISION(ctx());
    expect(source.fetchDailyBars).not.toHaveBeenCalled();
  });
});

describe('SETTLE_BACKFILL', () => {
  const SATURDAY = ct('2026-10-31', '10:00');
  const DATES = DAYS.map((d) => d.tradeDate)
    .filter((d) => d <= '2026-10-30')
    .slice(-BACKFILL_DAYS);

  // 10-30까지 정산했고, 10월 봉이 skip만 빼고 저장된 상태
  async function settled(
    skip: readonly string[],
    settle?: (symbol: string, tradeDate: string) => number | null,
    lastSettled = '2026-10-30',
  ) {
    const env = setup({ DAILY_SETTLE: lastSettled }, testSource(settle));
    for (const code of COMMODITY_CODES) {
      const definitions = await env.source.listContracts(code);
      await env.store.insertContracts(
        definitions.map((d) => ({ ...d, commodityCode: code, isTarget: true })),
      );
      const october = DAYS.map((d) => d.tradeDate).filter((d) => d <= '2026-10-30');
      const rows = october.flatMap((tradeDate) =>
        definitions
          .filter((d) => d.firstTradeDate === null || d.firstTradeDate <= tradeDate)
          .map((d) => d.symbol)
          .filter((contractSymbol) => !skip.includes(`${contractSymbol}|${tradeDate}`))
          .map((contractSymbol): DailyBarRow => ({
            contractSymbol,
            tradeDate,
            open: null,
            high: null,
            low: null,
            settle: 90,
            volume: 10,
            source: 'FAKE',
            collectedAt: NOW,
            revisedAt: null,
          })),
      );
      await env.store.upsertDailyBars(rows);
    }
    env.source.listContracts.mockClear();
    return env;
  }

  it('빠진 봉만 월물마다 한 번 받아 저장하고 그 원자재만 재계산한다', async () => {
    const { handlers, source, bars, recompute } = await settled([
      'CLZ26|2026-10-20',
      'CLZ26|2026-10-28',
      'CLF27|2026-10-29',
    ]);
    const c = ctx(SATURDAY);
    await handlers.SETTLE_BACKFILL(c);

    expect(c.tradeDate).toBe('2026-10-30');
    expect(source.fetchRecentBars.mock.calls).toEqual([['CL', ['CLZ26', 'CLF27'], DATES[0]]]);
    for (const key of ['CLZ26|2026-10-20', 'CLZ26|2026-10-28', 'CLF27|2026-10-29']) {
      expect(bars.get(key)).toMatchObject({
        settle: 100,
        source: 'FAKE',
        collectedAt: SATURDAY,
        revisedAt: null,
      });
    }
    // 저장돼 있던 봉은 그대로다
    expect(bars.get('CLZ26|2026-10-29')?.settle).toBe(90);
    expect(recompute.mock.calls.map(([code]) => code)).toEqual(['CL']);
  });

  it('빠진 봉이 없으면 소스를 부르지 않는다', async () => {
    const { handlers, source, recompute } = await settled([]);
    await handlers.SETTLE_BACKFILL(ctx(SATURDAY));
    expect(source.fetchRecentBars).not.toHaveBeenCalled();
    expect(recompute).not.toHaveBeenCalled();
  });

  it('소스에도 없으면(거래 없던 날) 저장·재계산 없이 성공한다', async () => {
    const { handlers, bars, recompute } = await settled(['SIZ26|2026-10-27'], () => null);
    const size = bars.size;
    await handlers.SETTLE_BACKFILL(ctx(SATURDAY));
    expect(bars.size).toBe(size);
    expect(recompute).not.toHaveBeenCalled();
  });

  it('보충 기간 밖이거나 아직 정산 전인 날의 봉은 받지 않는다', async () => {
    const { handlers, source, bars } = await settled(['NGZ26|2026-10-30'], undefined, '2026-10-29');
    await handlers.SETTLE_BACKFILL(ctx(SATURDAY));
    expect(source.fetchRecentBars).not.toHaveBeenCalled();
    expect(bars.has('NGZ26|2026-10-30')).toBe(false);
  });

  it('정산 이력이 없으면 아무것도 하지 않는다', async () => {
    const { handlers, source } = setup({});
    const c = ctx(SATURDAY);
    await handlers.SETTLE_BACKFILL(c);
    expect(c.tradeDate).toBeUndefined();
    expect(source.fetchRecentBars).not.toHaveBeenCalled();
  });

  it('한 원자재가 실패해도 나머지를 채우고 실패로 끝난다', async () => {
    const { handlers, source, recompute } = await settled(['GCZ26|2026-10-28', 'CLZ26|2026-10-28']);
    source.fetchRecentBars.mockRejectedValueOnce(new Error('HTTP 500'));
    await expect(handlers.SETTLE_BACKFILL(ctx(SATURDAY))).rejects.toThrow(
      /Backfill failed: GC: HTTP 500/,
    );
    expect(recompute.mock.calls.map(([code]) => code)).toEqual(['CL']);
  });
});
