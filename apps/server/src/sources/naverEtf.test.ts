import { describe, expect, it, vi } from 'vitest';
import { createNaverEtfSource } from './naverEtf.ts';

// 2026-10-28 실제 응답에서 필요한 필드만
const ETF_BODY = {
  itemCode: '261220',
  etfKeyIndicator: { issuerName: '삼성자산운용(ETF)', totalFee: 0.35 },
};
const ETN_BODY = { itemCode: '530031', etfKeyIndicator: null };

describe('createNaverEtfSource', () => {
  it('ETF는 totalFee(%)를, ETN처럼 값이 없으면 null을 준다', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(ETF_BODY))
      .mockResolvedValueOnce(Response.json(ETN_BODY));
    const source = createNaverEtfSource({ fetchFn });

    expect(await source.expenseRatio('261220')).toBe(0.35);
    expect(await source.expenseRatio('530031')).toBeNull();
    expect(fetchFn.mock.calls[0][0]).toBe('https://m.stock.naver.com/api/stock/261220/integration');
  });

  it('HTTP 오류나 형식이 다르면 실패한다', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(Response.json({ etfKeyIndicator: { totalFee: '0.35%' } }));
    const source = createNaverEtfSource({ fetchFn });

    await expect(source.expenseRatio('261220')).rejects.toThrow('Naver 261220: HTTP 503');
    await expect(source.expenseRatio('261220')).rejects.toThrow();
  });
});
