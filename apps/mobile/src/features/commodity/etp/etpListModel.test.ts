import type { EtpSummary } from '@futureetp/shared';
import { filterEtps, leverageOptions, NO_FILTERS, sortEtps, sortValue } from './etpListModel';

const etp = (name: string, fields: Partial<EtpSummary> = {}): EtpSummary => ({
  id: name,
  market: 'KRX',
  type: 'ETF',
  leverage: 1,
  fxHedge: 'HEDGED',
  name,
  tickers: [],
  aum: null,
  avgTradingValue: null,
  ...fields,
});

const ETPS = [
  etp('UNG', { market: 'US', fxHedge: 'NA', aum: 900, avgTradingValue: 50 }),
  etp('KODEX 인버스', { leverage: -1, aum: 10, avgTradingValue: 10 }),
  etp('레버리지 ETN', { type: 'ETN', leverage: 2, fxHedge: 'UNHEDGED', aum: 300 }),
  etp('KODEX', { aum: 200, avgTradingValue: 30 }),
  etp('BOIL', { market: 'US', leverage: 2, fxHedge: 'NA', aum: 100, avgTradingValue: 70 }),
  etp('KOSEF', { leverage: -2, avgTradingValue: 20 }),
];
const names = (etps: EtpSummary[]) => etps.map((e) => e.name);

describe('sortEtps', () => {
  it('기본은 시장, 배수(양수 먼저·절댓값 오름차순), 이름순이다', () => {
    expect(names(sortEtps(ETPS, 'DEFAULT'))).toEqual([
      'KODEX',
      '레버리지 ETN',
      'KODEX 인버스',
      'KOSEF',
      'UNG',
      'BOIL',
    ]);
  });

  it('순자산·거래대금은 시장 안에서 큰 순서이고 값이 없으면 뒤다', () => {
    expect(names(sortEtps(ETPS, 'AUM'))).toEqual([
      '레버리지 ETN',
      'KODEX',
      'KODEX 인버스',
      'KOSEF',
      'UNG',
      'BOIL',
    ]);
    expect(names(sortEtps(ETPS, 'TRADING_VALUE'))).toEqual([
      'KODEX',
      'KOSEF',
      'KODEX 인버스',
      '레버리지 ETN',
      'BOIL',
      'UNG',
    ]);
  });
});

describe('filterEtps', () => {
  it('4가지 필터를 모두 적용하고 ALL은 거르지 않는다', () => {
    expect(filterEtps(ETPS, NO_FILTERS)).toHaveLength(6);
    expect(names(filterEtps(ETPS, { ...NO_FILTERS, market: 'US' }))).toEqual(['UNG', 'BOIL']);
    expect(names(filterEtps(ETPS, { ...NO_FILTERS, type: 'ETN' }))).toEqual(['레버리지 ETN']);
    expect(names(filterEtps(ETPS, { ...NO_FILTERS, leverage: 2 }))).toEqual([
      '레버리지 ETN',
      'BOIL',
    ]);
    expect(
      names(filterEtps(ETPS, { ...NO_FILTERS, market: 'KRX', fxHedge: 'HEDGED', leverage: -1 })),
    ).toEqual(['KODEX 인버스']);
  });
});

it('배수 선택지는 있는 배수만 기본 정렬 순서로 준다', () => {
  expect(leverageOptions(ETPS)).toEqual([1, 2, -1, -2]);
});

it('정렬 값은 기본 정렬이면 붙이지 않는다', () => {
  expect(sortValue(ETPS[0], 'DEFAULT')).toBeUndefined();
  expect(sortValue(ETPS[0], 'AUM')).toBe(900);
  expect(sortValue(ETPS[2], 'TRADING_VALUE')).toBeNull();
});
