import { describe, expect, it } from 'vitest';
import { parseKrxEtpName } from './krxEtpName.ts';

// 종목명은 KRX Open API 2026-10-28 응답에서 그대로 가져왔다
describe('parseKrxEtpName', () => {
  it.each([
    // ETF: 환헤지는 (H)·(합성 H), 인버스·레버리지는 이름 뒤에 붙기도 한다
    ['KODEX WTI원유선물(H)', 'CL', 1, 'HEDGED', 'KODEX', null],
    ['KODEX WTI원유선물인버스(H)', 'CL', -1, 'HEDGED', 'KODEX', null],
    ['TIGER 원유선물Enhanced(H)', 'CL', 1, 'HEDGED', 'TIGER', null],
    ['KODEX 골드선물인버스(H)', 'GC', -1, 'HEDGED', 'KODEX', null],
    ['ACE 골드선물 레버리지(합성 H)', 'GC', 2, 'HEDGED', 'ACE', null],
    ['KODEX 은선물(H)', 'SI', 1, 'HEDGED', 'KODEX', null],
    // ETN: (H)가 없으면 환노출, 끝 글자가 시리즈
    ['삼성 레버리지 WTI원유 선물 ETN', 'CL', 2, 'UNHEDGED', '삼성', null],
    ['삼성 블룸버그 레버리지 WTI원유선물 ETN B', 'CL', 2, 'UNHEDGED', '삼성', 'B'],
    ['KB S&P 인버스 2X WTI원유 선물 ETN B', 'CL', -2, 'UNHEDGED', 'KB', 'B'],
    ['한투 인버스2XWTI원유선물 ETN B', 'CL', -2, 'UNHEDGED', '한투', 'B'],
    ['메리츠 인버스 2X WTI원유 선물 ETN(H)', 'CL', -2, 'HEDGED', '메리츠', null],
    ['미래에셋 -1.5X 천연가스 선물 ETN', 'NG', -1.5, 'UNHEDGED', '미래에셋', null],
    ['미래에셋 1.5X 천연가스 선물 ETN', 'NG', 1.5, 'UNHEDGED', '미래에셋', null],
    ['신한 블룸버그 2X 천연가스 선물 ETN B', 'NG', 2, 'UNHEDGED', '신한', 'B'],
    ['KB 솔랙티브 인버스 천연가스 선물 ETN', 'NG', -1, 'UNHEDGED', 'KB', null],
    ['한투 레버리지천연가스선물 ETN C', 'NG', 2, 'UNHEDGED', '한투', 'C'],
    ['삼성 인버스 2X 천연가스 선물 ETN D', 'NG', -2, 'UNHEDGED', '삼성', 'D'],
    ['한투 인버스금선물 ETN', 'GC', -1, 'UNHEDGED', '한투', null],
    ['한투 솔랙티브레버리지금선물 ETN', 'GC', 2, 'UNHEDGED', '한투', null],
    ['메리츠 솔랙티브 금 선물 ETN(H)', 'GC', 1, 'HEDGED', '메리츠', null],
    ['KB 은 선물 ETN', 'SI', 1, 'UNHEDGED', 'KB', null],
    ['한투 인버스2X은선물 ETN', 'SI', -2, 'UNHEDGED', '한투', null],
    ['미래에셋 레버리지 은 선물 ETN B', 'SI', 2, 'UNHEDGED', '미래에셋', 'B'],
  ] as const)('%s', (name, commodityCode, leverage, fxHedge, issuer, series) => {
    expect(parseKrxEtpName(name)).toEqual({ commodityCode, leverage, fxHedge, issuer, series });
  });

  it.each([
    // 현물·주식형·금리형은 "선물"이 없다
    'ACE KRX금현물',
    '미래에셋 레버리지 KRX 금현물 ETN',
    'RISE 미국S&P원유생산기업(합성 H)',
    'KoAct 미국천연가스인프라액티브',
    'KB KIS CD금리투자 ETN',
    // 두 원자재 바스켓
    'TIGER 금은선물(H)',
    // 대상이 아닌 선물
    'KODEX 미국S&P500선물(H)',
  ])('원자재 선물 상품이 아니면 null: %s', (name) => {
    expect(parseKrxEtpName(name)).toBeNull();
  });
});
