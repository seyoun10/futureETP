import { describe, expect, it, vi } from 'vitest';
import type { KnownEtpProduct } from '../calc/etpSeries.ts';
import type { KrxEtpDay, KrxEtpRow } from '../sources/krxEtp.ts';
import type { NaverEtfSource } from '../sources/naverEtf.ts';
import { US_ETP_MAP } from '../sources/usEtpMap.ts';
import {
  AVG_TRADING_DAYS,
  createEtpHandler,
  KRX_LOOKBACK_DAYS,
  TRADING_VALUE_LOOKBACK_DAYS,
  type EtpStore,
} from './etp.ts';

// 10/29 08:30 KST → 전일 10/28부터 본다
const NOW = new Date('2026-10-28T23:30:00Z');

const etf = (ticker: string): KrxEtpRow => ({
  ISU_CD: ticker,
  ISU_NM: 'KODEX WTI원유선물(H)',
  IDX_IND_NM: 'S&P GSCI Crude Oil Index ER',
});
const etn = (ticker: string, suffix = ''): KrxEtpRow => ({
  ISU_CD: ticker,
  ISU_NM: `삼성 레버리지 WTI원유 선물 ETN${suffix}`,
  IDX_IND_NM: null,
});
// 원자재 선물이 아닌 종목은 목록에서 빠진다
const other: KrxEtpRow = { ISU_CD: '069500', ISU_NM: 'KODEX 200', IDX_IND_NM: null };
const EMPTY: KrxEtpDay = { etf: [], etn: [] };

function setup(days: Record<string, KrxEtpDay>, products: KnownEtpProduct[] = []) {
  const fetchDay = vi.fn((date: string) => Promise.resolve(days[date] ?? EMPTY));
  const expenseRatio = vi.fn<NaverEtfSource['expenseRatio']>(() => Promise.resolve(0.35));
  const store = {
    krxProducts: vi.fn(() => Promise.resolve(products)),
    applyKrxPlan: vi.fn<EtpStore['applyKrxPlan']>(() => Promise.resolve()),
    setMetrics: vi.fn<EtpStore['setMetrics']>(() => Promise.resolve()),
    setDetails: vi.fn<EtpStore['setDetails']>(() => Promise.resolve()),
    usProducts: vi.fn<EtpStore['usProducts']>(() => Promise.resolve([])),
    applyUsSync: vi.fn<EtpStore['applyUsSync']>(() => Promise.resolve()),
  };
  // 미국 부분은 etpUs.test.ts에서 본다. 여기서는 매핑표 그대로 성공하게 둔다
  const listings = vi.fn(() =>
    Promise.resolve(Object.keys(US_ETP_MAP).map((symbol) => ({ symbol, name: symbol }))),
  );
  const nasdaq = { listings, summary: vi.fn(() => Promise.resolve(null)) };
  const yahoo = { daily: vi.fn(() => Promise.resolve({ listedDate: null, tradingValues: [] })) };
  const candidateAlert = vi.fn(() => Promise.resolve('NONE' as const));
  const majorityAlert = vi.fn(() => Promise.resolve('NONE' as const));
  const log = vi.fn();
  const handler = createEtpHandler({
    source: { fetchDay },
    naver: { expenseRatio },
    nasdaq,
    yahoo,
    store,
    candidateAlert,
    majorityAlert,
    log,
  });
  return {
    fetchDay,
    expenseRatio,
    store,
    listings,
    candidateAlert,
    majorityAlert,
    log,
    run: () => handler({ now: NOW }),
  };
}

describe('ETP 작업(국내)', () => {
  it('전일 목록으로 묶기 계획을 만들어 기준일과 함께 반영한다', async () => {
    const { store, fetchDay, run } = setup({
      '2026-10-28': { etf: [etf('261220'), other], etn: [etn('530031'), etn('530133', ' B')] },
    });

    await run();

    expect(fetchDay).toHaveBeenCalledWith('2026-10-28');
    const [plan, at] = store.applyKrxPlan.mock.calls[0];
    expect(at).toEqual({ baseDate: '2026-10-28', collectedAt: NOW });
    expect(plan.newProducts.map((p) => p.listings.map((l) => l.ticker))).toEqual([
      ['261220'],
      ['530031', '530133'],
    ]);
    expect(plan.newProducts[1].listings[1]).toMatchObject({
      series: 'B',
      name: '삼성 레버리지 WTI원유 선물 ETN B',
    });
  });

  it('휴장일(빈 응답)은 하루씩 거슬러 마지막 거래일 목록을 쓴다', async () => {
    const { store, fetchDay, run } = setup({
      '2026-10-23': { etf: [etf('261220')], etn: [etn('530031')] },
    });

    await run();

    expect(fetchDay.mock.calls.slice(0, 6).map(([d]) => d)).toEqual([
      '2026-10-28',
      '2026-10-27',
      '2026-10-26',
      '2026-10-25',
      '2026-10-24',
      '2026-10-23',
    ]);
    expect(store.applyKrxPlan.mock.calls[0][1].baseDate).toBe('2026-10-23');
  });

  it(`${KRX_LOOKBACK_DAYS}일 동안 목록이 없으면 실패하고 아무것도 반영하지 않는다`, async () => {
    const { store, fetchDay, run } = setup({});

    await expect(run()).rejects.toThrow('KRX: no ETP data');
    expect(fetchDay).toHaveBeenCalledTimes(KRX_LOOKBACK_DAYS);
    expect(store.applyKrxPlan).not.toHaveBeenCalled();
  });

  it('ETF·ETN 중 한쪽만 비면 실패한다', async () => {
    const { store, run } = setup({ '2026-10-28': { etf: [etf('261220')], etn: [] } });

    await expect(run()).rejects.toThrow('KRX 2026-10-28: ETF 1 rows, ETN 0 rows');
    expect(store.applyKrxPlan).not.toHaveBeenCalled();
  });

  it('원자재 종목이 상장 중 시리즈의 절반보다 적게 오면 대량 폐지 대신 실패한다', async () => {
    const products: KnownEtpProduct[] = ['a', 'b', 'c', 'd', 'e'].map((id, i) => ({
      id,
      groupingKey: null,
      isActive: true,
      series: [{ ticker: `26122${i}`, delistedDate: null }],
    }));
    // 이미 폐지된 시리즈는 세지 않는다
    products.push({
      id: 'f',
      groupingKey: null,
      isActive: false,
      series: [{ ticker: '999999', delistedDate: '2025-01-02' }],
    });
    const { store, run } = setup(
      { '2026-10-28': { etf: [etf('261220'), etf('261221')], etn: [other] } },
      products,
    );

    await expect(run()).rejects.toThrow('KRX 2026-10-28: 2 commodity ETPs, 5 listed in DB');
    expect(store.applyKrxPlan).not.toHaveBeenCalled();
  });

  it('절반 이상 오면 빠진 시리즈를 폐지로 반영한다', async () => {
    const products = ['a', 'b', 'c', 'd'].map((id, i) => ({
      id,
      groupingKey: null,
      isActive: true,
      series: [{ ticker: `26122${i}`, delistedDate: null }],
    }));
    const { store, run } = setup(
      { '2026-10-28': { etf: [etf('261220'), etf('261221')], etn: [other] } },
      products,
    );

    await run();

    const [plan] = store.applyKrxPlan.mock.calls[0];
    expect(plan.delistTickers).toEqual(['261222', '261223']);
    expect(plan.deactivateProductIds).toEqual(['c', 'd']);
  });

  describe('순자산·평균 거래대금', () => {
    const traded = (row: KrxEtpRow, value: string, aum?: string): KrxEtpRow => ({
      ...row,
      ACC_TRDVAL: value,
      ...(row.ISU_NM.includes('ETN') ? { MKTCAP: aum } : { INVSTASST_NETASST_TOTAMT: aum }),
    });
    const after: KnownEtpProduct[] = [
      {
        id: 'etn',
        groupingKey: 'k',
        isActive: true,
        series: [
          { ticker: '530031', delistedDate: null },
          { ticker: '530133', delistedDate: null },
        ],
      },
    ];

    it('반영 뒤 시리즈로 기준일 순자산과 이전 거래일까지의 평균 거래대금을 저장한다', async () => {
      const { store, run } = setup({
        '2026-10-28': {
          etf: [etf('261220')],
          etn: [traded(etn('530031'), '100', '1000'), traded(etn('530133', ' B'), '50', '500')],
        },
        // 10/25·26 주말
        '2026-10-24': { etf: [etf('261220')], etn: [traded(etn('530031'), '30')] },
      });
      store.krxProducts.mockResolvedValueOnce([]).mockResolvedValueOnce(after);

      await run();

      expect(store.setMetrics).toHaveBeenCalledWith(
        [{ productId: 'etn', aum: 1500, avgTradingValue: 90 }],
        NOW,
      );
      expect(store.setMetrics.mock.invocationCallOrder[0]).toBeGreaterThan(
        store.applyKrxPlan.mock.invocationCallOrder[0],
      );
    });

    it(`거래일 ${AVG_TRADING_DAYS}일을 채우면 더 거슬러 받지 않는다`, async () => {
      const day = { etf: [etf('261220')], etn: [etn('530031')] };
      const { fetchDay, run } = setup(
        Object.fromEntries(
          Array.from({ length: 30 }, (_, i) => [`2026-10-${String(28 - i).padStart(2, '0')}`, day]),
        ),
      );

      await run();

      expect(fetchDay).toHaveBeenCalledTimes(AVG_TRADING_DAYS);
      expect(fetchDay).toHaveBeenLastCalledWith('2026-10-09');
    });

    it(`거래일이 모자라면 ${TRADING_VALUE_LOOKBACK_DAYS}일까지만 보고 찾은 만큼 쓴다`, async () => {
      const { store, fetchDay, run } = setup({
        '2026-10-28': { etf: [etf('261220')], etn: [traded(etn('530031'), '10')] },
      });
      store.krxProducts.mockResolvedValueOnce([]).mockResolvedValueOnce(after);

      await run();

      expect(fetchDay).toHaveBeenCalledTimes(1 + TRADING_VALUE_LOOKBACK_DAYS);
      expect(store.setMetrics.mock.calls[0][0]).toEqual([
        { productId: 'etn', aum: null, avgTradingValue: 10 },
      ]);
    });

    it('이전 거래일 응답이 이상하면 목록도 반영하지 않는다', async () => {
      const { store, run } = setup({
        '2026-10-28': { etf: [etf('261220')], etn: [etn('530031')] },
        '2026-10-27': { etf: [], etn: [etn('530031')] },
      });

      await expect(run()).rejects.toThrow('KRX 2026-10-27: ETF 0 rows, ETN 1 rows');
      expect(store.applyKrxPlan).not.toHaveBeenCalled();
      expect(store.setMetrics).not.toHaveBeenCalled();
    });
  });

  describe('운용사 주소·총보수', () => {
    const listed = (id: string, ...tickers: string[]): KnownEtpProduct => ({
      id,
      groupingKey: null,
      isActive: true,
      series: tickers.map((ticker) => ({ ticker, delistedDate: null })),
    });
    const DAY = {
      etf: [etf('261220'), { ...etf('999990'), ISU_NM: 'XYZ 골드선물(H)' }],
      etn: [etn('530031')],
    };
    const AFTER = [
      listed('etf', '261220'),
      listed('etn', '530031'),
      listed('new-brand', '999990'),
      // 오늘 목록에 없는(폐지 처리된) 상품은 건드리지 않는다
      { ...listed('gone'), series: [{ ticker: '111111', delistedDate: '2026-10-28' }] },
    ];

    it('브랜드 고정표로 주소를, ETF만 네이버 총보수를 채운다', async () => {
      const { store, expenseRatio, run } = setup({ '2026-10-28': DAY });
      store.krxProducts.mockResolvedValueOnce([]).mockResolvedValueOnce(AFTER);

      await run();

      expect(expenseRatio.mock.calls).toEqual([['261220'], ['999990']]);
      expect(store.setDetails).toHaveBeenCalledWith([
        {
          productId: 'etf',
          issuerUrl: 'https://www.samsungfund.com/etf/main.do',
          expenseRatio: 0.35,
        },
        { productId: 'etn', issuerUrl: 'https://www.samsungpop.com/' },
        { productId: 'new-brand', issuerUrl: null, expenseRatio: 0.35 },
      ]);
    });

    it('네이버가 실패하거나 값이 없으면 그 상품 총보수는 저장된 값을 둔다', async () => {
      const { store, expenseRatio, log, run } = setup({ '2026-10-28': DAY });
      store.krxProducts.mockResolvedValueOnce([]).mockResolvedValueOnce(AFTER);
      expenseRatio
        .mockRejectedValueOnce(new Error('Naver 261220: HTTP 500'))
        .mockResolvedValueOnce(null);

      await run();

      expect(store.setDetails.mock.calls[0][0]).toEqual([
        { productId: 'etf', issuerUrl: 'https://www.samsungfund.com/etf/main.do' },
        { productId: 'etn', issuerUrl: 'https://www.samsungpop.com/' },
        { productId: 'new-brand', issuerUrl: null },
      ]);
      expect(log).toHaveBeenCalledWith('[etp Naver] 261220: Naver 261220: HTTP 500');
      expect(log).toHaveBeenCalledWith(expect.stringContaining('fees for 0/2 ETFs'));
    });
  });
});

describe('ETP 작업(시장별 실패)', () => {
  it('국내가 실패해도 미국은 반영하고, 끝에 실패로 둔다', async () => {
    const { store, run } = setup({});

    await expect(run()).rejects.toThrow('KRX: no ETP data');
    expect(store.applyKrxPlan).not.toHaveBeenCalled();
    expect(store.applyUsSync).toHaveBeenCalledTimes(1);
  });

  it('두 시장이 모두 실패하면 메시지를 모은다', async () => {
    const { store, listings, run } = setup({});
    listings.mockResolvedValueOnce([]);

    await expect(run()).rejects.toThrow(/^KRX: no ETP data.*; US: 0 of 17 mapped ETPs/);
    expect(store.applyUsSync).not.toHaveBeenCalled();
  });

  it('미국 동기화가 실패해도 남은 새 후보 알림·다수 판정은 하고, 그 실패도 모은다', async () => {
    const { listings, candidateAlert, majorityAlert, run } = setup({});
    listings.mockResolvedValueOnce([]);
    candidateAlert.mockRejectedValueOnce(new Error('db down'));
    majorityAlert.mockRejectedValueOnce(new Error('db down'));

    await expect(run()).rejects.toThrow(
      /; US: 0 of 17 mapped ETPs.*; US candidates: db down; majority: db down$/,
    );
    expect(candidateAlert).toHaveBeenCalledWith(NOW);
    expect(majorityAlert).toHaveBeenCalledWith(NOW);
  });
});
