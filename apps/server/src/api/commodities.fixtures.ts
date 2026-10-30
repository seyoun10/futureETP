// 테스트 전용. 원자재 조회를 쓰지 않는 라우트 테스트의 createApp 인자
import type { CommoditiesStore } from './commodities.ts';
import type { ContractsStore } from './contracts.ts';
import type { CurveStore } from './curve.ts';
import type { DevicesStore } from './devices.ts';
import type { DisparityStore } from './disparity.ts';
import type { EtpsStore } from './etps.ts';

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
  rollRule: unused,
  indexBars: unused,
  disparities: unused,
  weights: unused,
  scale: unused,
  latestIndexSnapshot: unused,
  distribution: unused,
};

export const UNUSED_CURVE: CurveStore = {
  tradingDays: unused,
  lastSettledTradeDate: unused,
  latestSnapshots: unused,
  priceDecimals: unused,
  firstBarDate: unused,
  tradeDates: unused,
  contracts: unused,
  frontSymbol: unused,
  dailyBars: unused,
};

export const UNUSED_CONTRACTS: ContractsStore = {
  tradingDays: unused,
  lastSettledTradeDate: unused,
  frontSymbols: unused,
  latestSnapshots: unused,
  priceDecimals: unused,
  contracts: unused,
  settleHistory: unused,
};

export const UNUSED_DEVICES: DevicesStore = { upsert: unused };

export const UNUSED_ETPS: EtpsStore = { products: unused, product: unused, series: unused };
