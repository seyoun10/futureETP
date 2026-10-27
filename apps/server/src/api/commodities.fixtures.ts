// 테스트 전용. 원자재 조회를 쓰지 않는 라우트 테스트의 createApp 인자
import type { CommoditiesStore } from './commodities.ts';
import type { DisparityStore } from './disparity.ts';

const unused = () => Promise.reject(new Error('unused'));

export const UNUSED_COMMODITIES: CommoditiesStore = {
  tradingDays: unused,
  lastSettledTradeDate: unused,
  commodities: unused,
  contracts: unused,
  frontSymbols: unused,
  dailyBars: unused,
  latestSnapshots: unused,
};

export const UNUSED_DISPARITY: DisparityStore = {
  tradingDays: unused,
  lastSettledTradeDate: unused,
  priceDecimals: unused,
  hasRollRule: unused,
  indexBars: unused,
  disparities: unused,
  weights: unused,
  scale: unused,
  latestIndexSnapshot: unused,
  distribution: unused,
};
