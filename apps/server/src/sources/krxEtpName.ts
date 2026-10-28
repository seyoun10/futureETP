// 국내 ETF·ETN 종목명에서 원자재·배수·환헤지·발행사·시리즈를 뽑는다(research/etp-sources.md, D-096).
// KRX·네이버 목록에는 이 속성이 따로 없어 이름 규칙으로만 알 수 있다.
import type { CommodityCode, FxHedge } from '@futureetp/shared';

export type KrxEtpName = {
  commodityCode: CommodityCode;
  // 부호 있는 배수. 인버스는 음수(-1, -2, -1.5)
  leverage: number;
  fxHedge: FxHedge;
  // 첫 단어. ETN은 발행사, ETF는 브랜드(KODEX 등)
  issuer: string;
  // ETN 후속 시리즈 끝 글자(B, C, D). 첫 시리즈는 표기가 없어 null
  series: string | null;
};

// "선물" 바로 앞 단어로 원자재를 정한다. 현물·주식형("금현물", "원유생산기업")은 "선물"이 없어 빠진다.
// "금은선물"처럼 두 원자재가 붙으면 바스켓이라 뺀다.
const COMMODITY_BEFORE_FUTURES: [RegExp, CommodityCode][] = [
  [/(?:WTI|원유)$/, 'CL'],
  [/천연가스$/, 'NG'],
  [/(?<![금은])(?:금|골드)$/, 'GC'],
  [/(?<![금은])은$/, 'SI'],
];
const MULTIPLE = /(-?\d+(?:\.\d+)?)\s*X/i;
const HEDGED = /\((?:합성\s*)?H\)/;
const SERIES = /ETN(?:\(H\))?\s*([A-Z])$/;

// 원자재 선물 상품이 아니면 null
export function parseKrxEtpName(name: string): KrxEtpName | null {
  const trimmed = name.trim();
  const futuresAt = trimmed.indexOf('선물');
  if (futuresAt < 0) return null;
  const beforeFutures = trimmed.slice(0, futuresAt).trimEnd();
  const commodityCode = COMMODITY_BEFORE_FUTURES.find(([pattern]) =>
    pattern.test(beforeFutures),
  )?.[1];
  if (!commodityCode) return null;

  return {
    commodityCode,
    leverage: parseLeverage(trimmed),
    fxHedge: HEDGED.test(trimmed) ? 'HEDGED' : 'UNHEDGED',
    issuer: trimmed.split(/\s+/)[0],
    series: SERIES.exec(trimmed)?.[1] ?? null,
  };
}

// nX가 있으면 그 수(인버스면 음수), 없으면 "레버리지" 2, "인버스" -1, 그 밖은 1
function parseLeverage(name: string): number {
  const inverse = name.includes('인버스');
  const multiple = MULTIPLE.exec(name);
  if (multiple) {
    const value = Number(multiple[1]);
    return inverse && value > 0 ? -value : value;
  }
  if (name.includes('레버리지')) return inverse ? -2 : 2;
  return inverse ? -1 : 1;
}
