import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { EtpSeriesPlan } from '../calc/etpSeries.ts';
import type { UsEtpSync } from '../jobs/etpUs.ts';
import type { KrxEtpEntry } from '../sources/krxEtp.ts';
import { db } from './client.ts';
import { createEtpStore } from './etpStore.ts';
import { etpProduct, etpSeries } from './schema.ts';
import { resetDb } from './testDb.ts';

const store = createEtpStore(db);
const COLLECTED = new Date('2026-10-27T23:30:00Z');
const AT = { baseDate: '2026-10-27', collectedAt: COLLECTED };

const entry = (over: Partial<KrxEtpEntry> = {}): KrxEtpEntry => ({
  ticker: '111111',
  type: 'ETN',
  name: '금 ETN',
  series: null,
  underlyingIndex: 'S&P GSCI Gold',
  issuer: '발행사',
  commodityCode: 'GC',
  leverage: 1,
  fxHedge: 'UNHEDGED',
  ...over,
});

const emptyPlan: EtpSeriesPlan<KrxEtpEntry> = {
  newProducts: [],
  addSeries: [],
  delistTickers: [],
  relistTickers: [],
  deactivateProductIds: [],
  reactivateProductIds: [],
};

const emptySync: UsEtpSync = { upserts: [], newCandidates: [], delist: [], dropCandidateIds: [] };

const mapping = {
  commodityCode: 'GC',
  type: 'ETF',
  leverage: 1,
  issuer: 'Issuer',
  underlyingIndex: null,
  rollRuleRef: 'BCOM',
} as const;

async function firstProductId(): Promise<string> {
  const [row] = await db.select({ id: etpProduct.id }).from(etpProduct);
  if (!row) throw new Error('no product');
  return row.id;
}

beforeEach(() => resetDb(db));
afterAll(() => db.$client.end());

describe('applyKrxPlan', () => {
  it('새 ETN 상품의 첫 시리즈는 A로, 후속 시리즈는 표기대로 넣는다', async () => {
    await store.applyKrxPlan(
      {
        ...emptyPlan,
        newProducts: [
          {
            groupingKey: 'key',
            listings: [entry(), entry({ ticker: '222222', series: 'B' })],
          },
        ],
      },
      AT,
    );

    const series = await db
      .select({ ticker: etpSeries.ticker, seriesCode: etpSeries.seriesCode })
      .from(etpSeries)
      .orderBy(etpSeries.ticker);
    expect(series).toEqual([
      { ticker: '111111', seriesCode: 'A' },
      { ticker: '222222', seriesCode: 'B' },
    ]);
    expect(await store.krxProducts()).toEqual([
      expect.objectContaining({ groupingKey: 'key', isActive: true }),
    ]);
  });

  it('ETF는 시리즈 코드가 없다', async () => {
    await store.applyKrxPlan(
      { ...emptyPlan, newProducts: [{ groupingKey: null, listings: [entry({ type: 'ETF' })] }] },
      AT,
    );
    const [series] = await db.select().from(etpSeries);
    expect(series?.seriesCode).toBeNull();
  });

  it('폐지·재상장과 비활성·재활성을 기준일로 기록한다', async () => {
    await store.applyKrxPlan(
      { ...emptyPlan, newProducts: [{ groupingKey: 'key', listings: [entry()] }] },
      AT,
    );
    const id = await firstProductId();

    await store.applyKrxPlan(
      { ...emptyPlan, delistTickers: ['111111'], deactivateProductIds: [id] },
      AT,
    );
    expect(await store.krxProducts()).toEqual([
      expect.objectContaining({
        isActive: false,
        series: [{ ticker: '111111', delistedDate: '2026-10-27' }],
      }),
    ]);

    await store.applyKrxPlan(
      { ...emptyPlan, relistTickers: ['111111'], reactivateProductIds: [id] },
      AT,
    );
    expect(await store.krxProducts()).toEqual([
      expect.objectContaining({
        isActive: true,
        series: [{ ticker: '111111', delistedDate: null }],
      }),
    ]);
  });

  it('도중에 실패하면 계획 전체를 되돌린다', async () => {
    await expect(
      store.applyKrxPlan(
        {
          ...emptyPlan,
          newProducts: [
            { groupingKey: 'a', listings: [entry()] },
            // 같은 종목코드라 primary key로 실패한다
            { groupingKey: 'b', listings: [entry()] },
          ],
        },
        AT,
      ),
    ).rejects.toThrow();

    expect(await db.select().from(etpProduct)).toEqual([]);
    expect(await db.select().from(etpSeries)).toEqual([]);
  });
});

describe('setDetails', () => {
  it('expenseRatio를 보내지 않으면 기존 값을 남긴다', async () => {
    await store.applyKrxPlan(
      { ...emptyPlan, newProducts: [{ groupingKey: 'key', listings: [entry()] }] },
      AT,
    );
    const productId = await firstProductId();

    await store.setDetails([{ productId, issuerUrl: 'https://a.example', expenseRatio: 0.5 }]);
    await store.setDetails([{ productId, issuerUrl: 'https://b.example' }]);

    const [row] = await db.select().from(etpProduct);
    expect(row).toMatchObject({ issuerUrl: 'https://b.example', expenseRatio: 0.5 });
  });
});

describe('applyUsSync', () => {
  it('새 후보는 확인 필요로 넣고, 알림은 한 번만 고른다', async () => {
    await store.applyUsSync(
      { ...emptySync, newCandidates: [{ symbol: 'NEW', name: 'New Fund' }] },
      AT,
    );

    const candidates = await store.unnotifiedCandidates();
    expect(candidates.map((c) => c.ticker)).toEqual(['NEW']);

    await store.markCandidatesNotified(
      candidates.map((c) => c.id),
      COLLECTED,
    );
    expect(await store.unnotifiedCandidates()).toEqual([]);
  });

  it('후보를 확인 완료로 올리면 매핑을 채우고 폐지 기록을 지운다', async () => {
    await store.applyUsSync(
      { ...emptySync, newCandidates: [{ symbol: 'GLD', name: 'Old Name' }] },
      AT,
    );
    const productId = await firstProductId();
    await store.applyUsSync({ ...emptySync, delist: [{ productId, ticker: 'GLD' }] }, AT);

    await store.applyUsSync(
      {
        ...emptySync,
        upserts: [
          {
            productId,
            symbol: 'GLD',
            name: 'Gold Fund',
            mapping,
            attributes: { listedDate: '2004-11-18', aum: 1000 },
          },
        ],
      },
      AT,
    );

    expect(await store.usProducts()).toEqual([
      { id: productId, ticker: 'GLD', needsReview: false, delistedDate: null },
    ]);
    const [product] = await db.select().from(etpProduct);
    expect(product).toMatchObject({
      commodityCode: 'GC',
      name: 'Gold Fund',
      isActive: true,
      aum: 1000,
    });
    const [series] = await db.select().from(etpSeries);
    expect(series?.listedDate).toBe('2004-11-18');
  });

  it('후보를 빼면 상품과 시리즈를 함께 지운다', async () => {
    await store.applyUsSync(
      { ...emptySync, newCandidates: [{ symbol: 'NEW', name: 'New Fund' }] },
      AT,
    );
    await store.applyUsSync({ ...emptySync, dropCandidateIds: [await firstProductId()] }, AT);

    expect(await db.select().from(etpProduct)).toEqual([]);
    expect(await db.select().from(etpSeries)).toEqual([]);
  });

  it('확인 완료 상품 중 활성만 majorityEtps에 들어간다', async () => {
    await store.applyUsSync(
      {
        ...emptySync,
        upserts: [{ productId: null, symbol: 'GLD', name: 'Gold', mapping, attributes: {} }],
        newCandidates: [{ symbol: 'NEW', name: 'New Fund' }],
      },
      AT,
    );

    expect(await store.majorityEtps()).toEqual([
      expect.objectContaining({ commodityCode: 'GC', market: 'US', rollRuleRef: 'BCOM' }),
    ]);
  });
});

describe('setMajority', () => {
  it('그 원자재·기준값의 규칙만 바꾼다', async () => {
    await store.setMajority(
      [{ commodityCode: 'GC', basis: 'KR', majorityRuleId: 'BCOM' }],
      COLLECTED,
    );

    const rules = await store.rollRules();
    expect(rules.filter((r) => r.majorityRuleId !== null)).toEqual([
      expect.objectContaining({ commodityCode: 'GC', basis: 'KR', majorityRuleId: 'BCOM' }),
    ]);
  });
});
