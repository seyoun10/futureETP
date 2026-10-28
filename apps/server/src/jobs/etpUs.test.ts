import { describe, expect, it, vi } from 'vitest';
import type { NasdaqEtpSource, UsListing } from '../sources/nasdaqEtp.ts';
import { US_ETP_MAP } from '../sources/usEtpMap.ts';
import type { YahooEtpSource } from '../sources/yahooEtp.ts';
import { syncUsEtps, US_AVG_TRADING_DAYS, type KnownUsEtp, type UsEtpStore } from './etpUs.ts';

// 10/29 08:30 KST = 10/28 19:30 EDT
const NOW = new Date('2026-10-28T23:30:00Z');

const MAPPED: UsListing[] = Object.keys(US_ETP_MAP).map((symbol) => ({
  symbol,
  name: `${symbol} Fund`,
}));
const CANDIDATE: UsListing = { symbol: 'NEWG', name: 'Example 2X Gold Futures ETF' };

function setup(listings: UsListing[], known: KnownUsEtp[] = []) {
  const nasdaq = {
    listings: vi.fn(() => Promise.resolve(listings)),
    summary: vi.fn<NasdaqEtpSource['summary']>(() =>
      Promise.resolve({ aum: 1_000_000, expenseRatio: 0.95 }),
    ),
  };
  const yahoo = {
    daily: vi.fn<YahooEtpSource['daily']>(() =>
      Promise.resolve({ listedDate: '2008-11-25', tradingValues: [10, 20, 30] }),
    ),
  };
  const store = {
    usProducts: vi.fn(() => Promise.resolve(known)),
    applyUsSync: vi.fn<UsEtpStore['applyUsSync']>(() => Promise.resolve()),
  };
  const log = vi.fn();
  return {
    nasdaq,
    yahoo,
    store,
    log,
    run: () => syncUsEtps({ nasdaq, yahoo, store, now: NOW, log }),
    sync: () => store.applyUsSync.mock.calls[0][0],
  };
}

const known = (id: string, ticker: string, rest: Partial<KnownUsEtp> = {}): KnownUsEtp => ({
  id,
  ticker,
  needsReview: false,
  delistedDate: null,
  ...rest,
});

describe('syncUsEtps', () => {
  it('매핑 상품은 속성과 함께 새로 넣거나 갱신하고, 새 후보는 한 번만 넣는다', async () => {
    const { store, run, sync } = setup(
      [...MAPPED, CANDIDATE, { symbol: 'OLDC', name: 'Old Silver Futures ETF' }],
      [known('uco', 'UCO'), known('oldc', 'OLDC', { needsReview: true })],
    );

    await run();

    expect(store.applyUsSync.mock.calls[0][1]).toEqual({
      baseDate: '2026-10-28',
      collectedAt: NOW,
    });
    const { upserts, newCandidates, delist, dropCandidateIds } = sync();
    expect(upserts).toHaveLength(17);
    expect(upserts.find((u) => u.symbol === 'UCO')).toEqual({
      symbol: 'UCO',
      name: 'UCO Fund',
      productId: 'uco',
      mapping: US_ETP_MAP.UCO,
      attributes: {
        aum: 1_000_000,
        expenseRatio: 0.95,
        listedDate: '2008-11-25',
        avgTradingValue: 20,
      },
    });
    expect(upserts.find((u) => u.symbol === 'SCO')?.productId).toBeNull();
    expect(newCandidates).toEqual([CANDIDATE]);
    expect(delist).toEqual([]);
    expect(dropCandidateIds).toEqual([]);
  });

  it(`평균 거래대금은 최근 ${US_AVG_TRADING_DAYS}거래일만 쓴다`, async () => {
    const { yahoo, run, sync } = setup(MAPPED);
    yahoo.daily.mockResolvedValue({
      listedDate: null,
      tradingValues: [1000, ...Array<number>(US_AVG_TRADING_DAYS).fill(5)],
    });

    await run();

    expect(sync().upserts[0].attributes).toEqual({
      aum: 1_000_000,
      expenseRatio: 0.95,
      avgTradingValue: 5,
    });
  });

  it('소스가 실패하거나 값이 없으면 그 필드는 빼서 저장된 값을 둔다', async () => {
    const { nasdaq, yahoo, log, run, sync } = setup(MAPPED);
    nasdaq.summary
      .mockRejectedValueOnce(new Error('Nasdaq UCO: HTTP 500'))
      .mockResolvedValueOnce({ aum: null, expenseRatio: 0.95 });
    yahoo.daily
      .mockResolvedValueOnce({ listedDate: '2008-11-25', tradingValues: [] })
      .mockRejectedValueOnce(new Error('Yahoo SCO: HTTP 429'));

    await run();

    const [uco, sco] = sync().upserts;
    expect(uco.attributes).toEqual({ listedDate: '2008-11-25' });
    expect(sco.attributes).toEqual({ expenseRatio: 0.95 });
    expect(log).toHaveBeenCalledWith('[etp Nasdaq] UCO: Nasdaq UCO: HTTP 500');
    expect(log).toHaveBeenCalledWith('[etp Yahoo] SCO: Yahoo SCO: HTTP 429');
    expect(log).toHaveBeenLastCalledWith(expect.stringContaining('2 source failures'));
  });

  it('두 소스가 모든 상품에서 실패하면 반영하지 않는다', async () => {
    const { nasdaq, yahoo, store, run } = setup(MAPPED);
    nasdaq.summary.mockRejectedValue(new Error('blocked'));
    yahoo.daily.mockRejectedValue(new Error('blocked'));

    await expect(run()).rejects.toThrow('US: Nasdaq and Yahoo failed for all 17 ETPs');
    expect(store.applyUsSync).not.toHaveBeenCalled();
  });

  it('목록에서 빠진 매핑 상품은 폐지로, 다시 나오면 갱신 대상으로 둔다', async () => {
    const { run, sync } = setup(
      MAPPED.filter((listing) => listing.symbol !== 'USL'),
      [known('usl', 'USL'), known('uco', 'UCO', { delistedDate: '2026-10-01' })],
    );

    await run();

    expect(sync().delist).toEqual([{ productId: 'usl', ticker: 'USL' }]);
    expect(sync().upserts.find((u) => u.symbol === 'UCO')?.productId).toBe('uco');
  });

  it('후보였던 행은 매핑표에 오르면 갱신, 후보에서 빠지면 지운다', async () => {
    const { run, sync } = setup(
      [...MAPPED, { symbol: 'GLD', name: 'SPDR Gold Shares' }],
      [
        known('uco', 'UCO', { needsReview: true }),
        known('gld', 'GLD', { needsReview: true }),
        known('gone', 'GONE', { needsReview: true }),
      ],
    );

    await run();

    expect(sync().upserts.find((u) => u.symbol === 'UCO')?.productId).toBe('uco');
    expect(sync().dropCandidateIds).toEqual(['gld', 'gone']);
    expect(sync().delist).toEqual([]);
  });

  it('매핑 상품이 절반보다 적게 오면 대량 폐지 대신 실패한다', async () => {
    const { store, run } = setup(MAPPED.slice(0, 8), [known('uco', 'UCO')]);

    await expect(run()).rejects.toThrow('US: 8 of 17 mapped ETPs in Nasdaq screener');
    expect(store.applyUsSync).not.toHaveBeenCalled();
  });
});
