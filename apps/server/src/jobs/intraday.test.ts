import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { IndexHistoryRow } from '../calc/intraday.ts';
import {
  CME_TIME_ZONE,
  buildTradingDays,
  zonedTimeToUtc,
  type CalendarInput,
} from '../calc/tradingCalendar.ts';
import type { IntradayQuote, IntradaySource } from '../sources/intraday.ts';
import {
  createIntradayHandler,
  type HeldWeightRow,
  type IndexSnapshotRow,
  type IntradaySnapshotRow,
  type IntradayStore,
} from './intraday.ts';
import type { JobContext } from './runner.ts';

const DAYS = buildTradingDays(
  JSON.parse(
    readFileSync(new URL('../../../../scripts/calendar/2026.json', import.meta.url), 'utf8'),
  ) as CalendarInput,
);

const ct = (date: string, time: string) => zonedTimeToUtc(date, time, CME_TIME_ZONE);
// 거래일 10/28 장중. 직전 거래일은 10/27
const NOW = ct('2026-10-28', '09:07');
const SLOT = ct('2026-10-28', '09:00');

const contract = (symbol: string, lastTradeDate: string) => ({
  symbol,
  contractMonth: `20${symbol.slice(3)}-${symbol[2] === 'Z' ? '12' : '01'}`,
  lastTradeDate,
  isTarget: true,
});

const weight = (basis: HeldWeightRow['basis'], contractSymbol: string, w: number) => ({
  basis,
  tradeDate: '2026-10-27',
  contractSymbol,
  weight: w,
});

// 199개 유효 종가(이평선 200까지 계산되도록) + 마지막 날 맞춤 배율 0.5
const HISTORY: IndexHistoryRow[] = Array.from({ length: 200 }, (_, i) => ({
  tradeDate: i === 199 ? '2026-10-27' : `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
  close: 50,
  blendedPrice: 100,
  isValid: true,
}));

function memoryStore({
  lastSettled = '2026-10-27',
  held = [weight('FRONT', 'CLZ26', 1), weight('KR', 'CLZ26', 0.6), weight('KR', 'CLF27', 0.4)],
  history = HISTORY,
}: { lastSettled?: string; held?: HeldWeightRow[]; history?: IndexHistoryRow[] } = {}) {
  const saved: { quotes: IntradaySnapshotRow[]; indexes: IndexSnapshotRow[] } = {
    quotes: [],
    indexes: [],
  };
  const store: IntradayStore = {
    tradingDays: (from, to) =>
      Promise.resolve(DAYS.filter((d) => d.tradeDate >= from && d.tradeDate <= to)),
    lastSettledTradeDate: () => Promise.resolve(lastSettled),
    contracts: (code) =>
      Promise.resolve(
        code === 'CL'
          ? [
              contract('CLX26', '2026-10-20'),
              contract('CLZ26', '2026-11-17'),
              contract('CLF27', '2026-12-16'),
              contract('CLG27', '2027-01-20'),
            ].filter((c) => c.lastTradeDate >= '2026-10-28')
          : [],
      ),
    heldWeights: (code) => Promise.resolve(code === 'CL' ? held : []),
    indexHistory: () => Promise.resolve(history),
    save(quotes, indexes) {
      saved.quotes.push(...quotes);
      saved.indexes.push(...indexes);
      return Promise.resolve();
    },
  };
  return { store, saved };
}

const quote = (contractSymbol: string, last: number, session = true): IntradayQuote => ({
  contractSymbol,
  last,
  dayOpen: session ? last - 1 : null,
  dayHigh: session ? last + 2 : null,
  dayLow: session ? last - 5 : null,
  volume: session ? 1000 : null,
  sourceTime: ct('2026-10-28', '08:55'),
});

const PRICES: Record<string, number> = { CLZ26: 110, CLF27: 100, CLG27: 99 };

function fakeSource(missing: string[] = []) {
  const respond = (symbols: readonly string[], session: boolean) =>
    Promise.resolve(
      symbols.filter((s) => !missing.includes(s)).map((s) => quote(s, PRICES[s]!, session)),
    );
  const source = {
    name: 'YAHOO',
    fetchSessionQuotes: vi.fn((symbols: readonly string[], sessionOpenAt: Date) =>
      sessionOpenAt ? respond(symbols, true) : Promise.reject(new Error('no session')),
    ),
    fetchLastPrices: vi.fn((symbols: readonly string[]) => respond(symbols, false)),
  } satisfies IntradaySource;
  return source;
}

const run = (handler: ReturnType<typeof createIntradayHandler>, now = NOW) => {
  const ctx: JobContext = { now };
  return handler(ctx).then(() => ctx);
};

describe('INTRADAY', () => {
  it('지수 월물은 세션 값, 나머지 커브 월물은 현재가로 받아 슬롯 시각에 저장한다', async () => {
    const { store, saved } = memoryStore();
    const source = fakeSource();
    const ctx = await run(createIntradayHandler({ store, source, log: () => {} }));

    expect(ctx.tradeDate).toBe('2026-10-28');
    expect(source.fetchSessionQuotes).toHaveBeenCalledWith(
      ['CLZ26', 'CLF27'],
      ct('2026-10-27', '17:00'),
    );
    expect(source.fetchLastPrices).toHaveBeenCalledWith(['CLG27']);
    expect(saved.quotes.map((q) => [q.contractSymbol, q.dayHigh])).toEqual([
      ['CLZ26', 112],
      ['CLF27', 102],
      ['CLG27', null],
    ]);
    expect(saved.quotes.every((q) => q.capturedAt.getTime() === SLOT.getTime())).toBe(true);
    expect(saved.quotes[0]!.tradeDate).toBe('2026-10-28');

    // 기준값마다 잠정 지수(US는 roll_weight가 없어 빠진다)
    expect(saved.indexes.map((i) => i.basis)).toEqual(['FRONT', 'KR']);
    const [front, kr] = saved.indexes;
    expect(front).toMatchObject({ commodityCode: 'CL', capturedAt: SLOT, tradeDate: '2026-10-28' });
    expect(front!.last).toBeCloseTo(0.5 * 110);
    expect(front!.high).toBeCloseTo(0.5 * 112);
    expect(kr!.last).toBeCloseTo(0.5 * (0.6 * 110 + 0.4 * 100));
    expect(kr!.disparityByMa['200'].last).toBeCloseTo((53 / ((199 * 50 + 53) / 200) - 1) * 100);
  });

  it.each([
    // 10/28 세션이 열렸지만 10/27이 아직 정산 전
    ['정산 대기', ct('2026-10-27', '18:00'), '2026-10-26'],
    ['휴장(토요일)', ct('2026-10-31', '12:00'), '2026-10-30'],
    ['일일 정지 시간', ct('2026-10-28', '16:30'), '2026-10-27'],
  ])('%s면 돌지 않는다', async (_, now, lastSettled) => {
    const { store, saved } = memoryStore({ lastSettled });
    const source = fakeSource();
    const log = vi.fn();
    const ctx = await run(createIntradayHandler({ store, source, log }), now);
    expect(source.fetchSessionQuotes).not.toHaveBeenCalled();
    expect(saved.quotes).toHaveLength(0);
    expect(ctx.tradeDate).toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^\[intraday\] skipped: /));
  });

  it('보유 월물 값이 없으면 받은 값과 다른 기준값은 저장하고 실패한다', async () => {
    const { store, saved } = memoryStore();
    const handler = createIntradayHandler({ store, source: fakeSource(['CLF27']), log: () => {} });
    await expect(run(handler)).rejects.toThrow('CL: KR CLF27 장중 가격이 없다');
    expect(saved.quotes.map((q) => q.contractSymbol)).toEqual(['CLZ26', 'CLG27']);
    expect(saved.indexes.map((i) => i.basis)).toEqual(['FRONT']);
  });

  it('커브 전용 월물 현재가를 받지 못해도 지수·알림은 이어 가고 배치는 실패로 남긴다', async () => {
    const { store, saved } = memoryStore();
    const source = fakeSource();
    source.fetchLastPrices.mockRejectedValue(new Error('spark 500'));
    const alert = vi.fn(() => Promise.resolve());
    const handler = createIntradayHandler({ store, source, alert, log: () => {} });
    await expect(run(handler)).rejects.toThrow('CL: curve prices spark 500');
    expect(saved.quotes.map((q) => q.contractSymbol)).toEqual(['CLZ26', 'CLF27']);
    expect(saved.indexes.map((i) => i.basis)).toEqual(['FRONT', 'KR']);
    expect(alert).toHaveBeenCalledTimes(4);
  });

  it('달력에 직전 거래일 행이 없으면 원인이 드러나는 메시지로 실패한다', async () => {
    const { store } = memoryStore();
    store.tradingDays = (from, to) =>
      Promise.resolve(DAYS.filter((d) => d.tradeDate >= '2026-10-28' && d.tradeDate <= to));
    const handler = createIntradayHandler({ store, source: fakeSource(), log: () => {} });
    await expect(run(handler)).rejects.toThrow(/trading calendar has no session or previous day/);
  });

  it('직전 거래일 재계산 결과가 없으면(날짜 어긋남) 지수를 만들지 않고 실패한다', async () => {
    const stale = HISTORY.slice(0, -1);
    const { store, saved } = memoryStore({ history: stale });
    const handler = createIntradayHandler({ store, source: fakeSource(), log: () => {} });
    await expect(run(handler)).rejects.toThrow(
      `FRONT expected 2026-10-27, roll_weight 2026-10-27, index_bar ${stale[stale.length - 1]!.tradeDate}`,
    );
    expect(saved.indexes).toHaveLength(0);
    expect(saved.quotes).toHaveLength(3);
  });

  it('저장 뒤 원자재마다 알림 판정을 부르고, 판정이 실패하면 저장은 두고 배치를 실패로 남긴다', async () => {
    const { store, saved } = memoryStore();
    const alert = vi.fn((input: { commodityCode: string }) =>
      input.commodityCode === 'CL' ? Promise.reject(new Error('push down')) : Promise.resolve(),
    );
    const handler = createIntradayHandler({ store, source: fakeSource(), alert, log: () => {} });
    await expect(run(handler)).rejects.toThrow('CL: alert push down');

    expect(alert).toHaveBeenCalledTimes(4);
    expect(alert).toHaveBeenCalledWith({
      commodityCode: 'CL',
      tradeDate: '2026-10-28',
      detectedAt: SLOT,
      now: NOW,
      ruleBases: ['FRONT', 'KR'],
      indexes: saved.indexes,
    });
    expect(saved.indexes).toHaveLength(2);
  });

  it('장 상태와 상관없이 먼저 지난 슬롯의 RETRY를 다시 보낸다', async () => {
    const { store } = memoryStore({ lastSettled: '2026-10-26' });
    const retry = vi.fn(() => Promise.resolve());
    const now = ct('2026-10-27', '18:22');
    await run(createIntradayHandler({ store, source: fakeSource(), retry, log: () => {} }), now);
    expect(retry).toHaveBeenCalledWith({ before: new Date(ct('2026-10-27', '18:15')), now });
  });

  // :00/:30에는 DEFERRED_PUSH가 먼저 재발송한다. 그 뒤 실패해 RETRY가 된 지연 발송을 같은 슬롯에서 다시 보내면 안 된다(D-023)
  it.each(['18:00', '18:30'])('%s 슬롯에는 RETRY 재발송을 DEFERRED_PUSH에 맡긴다', async (time) => {
    const { store } = memoryStore({ lastSettled: '2026-10-26' });
    const retry = vi.fn(() => Promise.resolve());
    await run(
      createIntradayHandler({ store, source: fakeSource(), retry, log: () => {} }),
      ct('2026-10-27', time),
    );
    expect(retry).not.toHaveBeenCalled();
  });

  it('재발송이 실패해도 장중 값은 저장하고 배치를 실패로 남긴다', async () => {
    const { store, saved } = memoryStore();
    const retry = vi.fn(() => Promise.reject(new Error('db down')));
    const handler = createIntradayHandler({ store, source: fakeSource(), retry, log: () => {} });
    await expect(run(handler, ct('2026-10-28', '09:22'))).rejects.toThrow('alert retry db down');
    expect(saved.indexes).toHaveLength(2);
  });

  // 정지일 다음 거래일 세션은 정지일 전날 17:00 CT에 열린다. 달력을 +1일까지만 읽으면 CLOSED로 건너뛰었다
  it.each([
    ['추수감사절 전날 저녁', ct('2026-11-25', '17:07'), '2026-11-25', '2026-11-27'],
    ['Juneteenth 전날 저녁', ct('2026-06-18', '17:07'), '2026-06-18', '2026-06-22'],
  ])('%s 세션도 OPEN으로 판정해 저장한다', async (_label, now, previous, tradeDate) => {
    const { store, saved } = memoryStore({
      lastSettled: previous,
      held: [weight('FRONT', 'CLZ26', 1)].map((w) => ({ ...w, tradeDate: previous })),
      history: HISTORY.map((row, i) => (i === 199 ? { ...row, tradeDate: previous } : row)),
    });
    const logs: string[] = [];
    const handler = createIntradayHandler({
      store,
      source: fakeSource(),
      log: (m) => logs.push(m),
    });
    const ctx = await run(handler, now);
    expect(logs.filter((m) => m.includes('skipped'))).toEqual([]);
    expect(ctx.tradeDate).toBe(tradeDate);
    expect(saved.indexes.map((i) => i.tradeDate)).toEqual([tradeDate]);
  });
});
