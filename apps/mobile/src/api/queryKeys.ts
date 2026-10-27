import type { Basis, CommodityCode, MaPeriod, Window } from '@futureetp/shared';

// C-a 조회 query. 설정 값을 그대로 담아 설정이 바뀌면 key가 바뀌어 다시 조회된다(D-086)
export type DisparityParams = {
  basis: Basis;
  ma: MaPeriod;
  window: Window;
  // 오름차순 5개
  levels: readonly number[];
};

// query key 팩토리. 원자재 조회는 ['commodities', code, ...]로 시작해 원자재 단위로 무효화할 수 있다.
export const queryKeys = {
  health: ['health'] as const,
  settings: ['settings'] as const,
  commodities: {
    all: ['commodities'] as const,
    list: () => [...queryKeys.commodities.all, 'list'] as const,
    detail: (code: CommodityCode) => [...queryKeys.commodities.all, code] as const,
    disparity: (code: CommodityCode, params: DisparityParams) =>
      [...queryKeys.commodities.detail(code), 'disparity', params] as const,
    curve: (code: CommodityCode, baseDate: string | null) =>
      [...queryKeys.commodities.detail(code), 'curve', baseDate] as const,
    contracts: (code: CommodityCode) =>
      [...queryKeys.commodities.detail(code), 'contracts'] as const,
    etps: (code: CommodityCode) => [...queryKeys.commodities.detail(code), 'etps'] as const,
  },
  etps: {
    detail: (id: string) => ['etps', id] as const,
  },
};
