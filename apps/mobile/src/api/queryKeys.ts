import type { Basis, CommodityCode, MaPeriod, Window } from '@futureetp/shared';

// query key 팩토리. 원자재 조회는 ['commodities', code, ...]로 시작해 원자재 단위로 무효화할 수 있다.
export const queryKeys = {
  health: ['health'] as const,
  settings: ['settings'] as const,
  commodities: {
    all: ['commodities'] as const,
    list: () => [...queryKeys.commodities.all, 'list'] as const,
    detail: (code: CommodityCode) => [...queryKeys.commodities.all, code] as const,
    disparity: (code: CommodityCode, params: { basis: Basis; ma: MaPeriod; window: Window }) =>
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
