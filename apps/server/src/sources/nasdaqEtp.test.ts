import { describe, expect, it, vi } from 'vitest';
import { createNasdaqEtpSource, parseNasdaqNumber } from './nasdaqEtp.ts';

// 2026-10-28 실제 응답에서 필요한 필드만
const SCREENER_BODY = {
  data: {
    dataAsOf: '10/27/2026 8:00:00 PM',
    data: {
      rows: [
        {
          symbol: 'UCO',
          companyName: 'ProShares Ultra Bloomberg Crude Oil',
          lastSalePrice: '$64.8900',
        },
        { symbol: 'GDX', companyName: 'VanEck Gold Miners ETF ', lastSalePrice: '$70.1000' },
      ],
    },
  },
};
const SUMMARY_BODY = {
  data: {
    symbol: 'USO',
    summaryData: {
      MarketCap: { label: 'Market Cap', value: '2,693,250,000' },
      AUM: { label: 'Assets Under Management (,000)', value: '1,848,478' },
      ExpenseRatio: { label: 'Expense Ratio', value: '0.81%' },
      Beta: { label: 'Beta', value: 0.31 },
    },
  },
  status: { rCode: 200 },
};
const MISSING_BODY = {
  data: null,
  status: { rCode: 400, bCodeMessage: [{ code: 1001, errorMessage: 'Symbol not exists.' }] },
};

describe('parseNasdaqNumber', () => {
  it('기호를 떼고 숫자로, 숫자가 아니면 null', () => {
    expect(parseNasdaqNumber('1,848,478')).toBe(1848478);
    expect(parseNasdaqNumber('0.81%')).toBe(0.81);
    expect(parseNasdaqNumber('$64.89')).toBe(64.89);
    expect(parseNasdaqNumber(0.31)).toBe(0.31);
    expect(parseNasdaqNumber('N/A')).toBeNull();
    expect(parseNasdaqNumber('')).toBeNull();
    expect(parseNasdaqNumber(null)).toBeNull();
  });
});

describe('createNasdaqEtpSource', () => {
  it('스크리너 심볼·이름(공백 정리)을 준다', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(SCREENER_BODY));
    const source = createNasdaqEtpSource({ fetchFn });

    expect(await source.listings()).toEqual([
      { symbol: 'UCO', name: 'ProShares Ultra Bloomberg Crude Oil' },
      { symbol: 'GDX', name: 'VanEck Gold Miners ETF' },
    ]);
    expect(fetchFn.mock.calls[0][0]).toBe('https://api.nasdaq.com/api/screener/etf?download=true');
  });

  it('summary 순자산은 천 달러 단위를 달러로, 없는 심볼은 null', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(SUMMARY_BODY))
      .mockResolvedValueOnce(Response.json(MISSING_BODY))
      .mockResolvedValueOnce(Response.json({ data: { summaryData: { AUM: { value: 'N/A' } } } }));
    const source = createNasdaqEtpSource({ fetchFn });

    expect(await source.summary('USO')).toEqual({ aum: 1_848_478_000, expenseRatio: 0.81 });
    expect(await source.summary('ZZZZQ')).toBeNull();
    expect(await source.summary('DGZ')).toEqual({ aum: null, expenseRatio: null });
    expect(fetchFn.mock.calls[0][0]).toBe(
      'https://api.nasdaq.com/api/quote/USO/summary?assetclass=etf',
    );
  });

  it('HTTP 오류나 형식이 다르면 실패한다', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 403 }))
      .mockResolvedValueOnce(Response.json({ data: { rows: [] } }));
    const source = createNasdaqEtpSource({ fetchFn });

    await expect(source.summary('USO')).rejects.toThrow('Nasdaq USO: HTTP 403');
    await expect(source.listings()).rejects.toThrow();
  });
});
