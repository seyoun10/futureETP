import { describe, expect, it, vi } from 'vitest';
import type { KnownEtpProduct } from '../calc/etpSeries.ts';
import type { KrxEtpDay, KrxEtpRow } from '../sources/krxEtp.ts';
import { createEtpHandler, KRX_LOOKBACK_DAYS, type EtpStore } from './etp.ts';

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
  const store = {
    krxProducts: vi.fn(() => Promise.resolve(products)),
    applyKrxPlan: vi.fn<EtpStore['applyKrxPlan']>(() => Promise.resolve()),
  };
  const handler = createEtpHandler({ source: { fetchDay }, store, log: () => {} });
  return { fetchDay, store, run: () => handler({ now: NOW }) };
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

    expect(fetchDay.mock.calls.map(([d]) => d)).toEqual([
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
});
