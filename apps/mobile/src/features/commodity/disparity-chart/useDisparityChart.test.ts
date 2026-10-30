import type { Settings } from '@futureetp/shared';
import { getDisparityChart } from '@/api/commodities';
import { createQueryClient } from '@/api/queryClient';
import { queryKeys } from '@/api/queryKeys';
import { getSettings } from '@/api/settings';
import { mergeDisparityPages, prefetchDisparityChart } from './useDisparityChart';

jest.mock('@/api/commodities', () => ({ getDisparityChart: jest.fn() }));
jest.mock('@/api/settings', () => ({ getSettings: jest.fn() }));

const SETTINGS: Settings = {
  locale: 'ko',
  timezone: 'Asia/Seoul',
  basis: 'KR',
  maPeriod: 200,
  window: 'Y10',
  rareLevels: [5, 10, 15, 20, 25],
  alertCommodity: 'CL',
  quietTime: null,
};
const PARAMS = { basis: 'KR', ma: 200, window: 'Y10', levels: [5, 10, 15, 20, 25] } as const;
const CHART = { bars: [] };

beforeEach(() => {
  jest.mocked(getSettings).mockReset().mockResolvedValue(SETTINGS);
  jest
    .mocked(getDisparityChart)
    .mockReset()
    .mockResolvedValue(CHART as never);
});

describe('prefetchDisparityChart', () => {
  it('설정을 읽고 그 값의 C-a key로 캐시에 넣는다', async () => {
    const client = createQueryClient();
    await prefetchDisparityChart(client, 'GC');
    expect(getDisparityChart).toHaveBeenCalledWith('GC', PARAMS, undefined, expect.anything());
    expect(client.getQueryData(queryKeys.commodities.disparity('GC', PARAMS))).toEqual({
      pages: [CHART],
      pageParams: [undefined],
    });
    client.clear();
  });

  it('설정이 캐시에 있으면 다시 조회하지 않는다', async () => {
    const client = createQueryClient();
    client.setQueryData(queryKeys.settings, SETTINGS);
    await prefetchDisparityChart(client, 'GC');
    expect(getSettings).not.toHaveBeenCalled();
    expect(getDisparityChart).toHaveBeenCalledTimes(1);
    client.clear();
  });

  it('설정 조회가 실패해도 던지지 않고 C-a를 조회하지 않는다', async () => {
    jest.mocked(getSettings).mockRejectedValue(new Error('x'));
    const client = createQueryClient();
    await expect(prefetchDisparityChart(client, 'GC')).resolves.toBeUndefined();
    expect(getDisparityChart).not.toHaveBeenCalled();
    client.clear();
  });
});

describe('mergeDisparityPages', () => {
  const page = (dates: string[], hasMore: boolean) =>
    ({ hasMore, bars: dates.map((tradeDate) => ({ tradeDate })) }) as never;

  it('이전 페이지 봉을 앞에 붙이고 hasMore는 가장 이른 페이지 값이다', () => {
    const merged = mergeDisparityPages({
      pages: [page(['d5', 'd6'], true), page(['d3', 'd4'], true), page(['d1', 'd2'], false)],
      pageParams: [undefined, 'd5', 'd3'],
    });
    expect(merged.bars.map((b) => b.tradeDate)).toEqual(['d1', 'd2', 'd3', 'd4', 'd5', 'd6']);
    expect(merged.hasMore).toBe(false);
  });
});
