// 한국형·미국형 다수 판정(D-013, D-015, D-024, product.md 기준값). 원자재·시장마다 상장 중 매핑 상품을 롤 규칙별로 세고,
// 가장 많은 규칙을 고른다. 동률이면 순자산 합계가 큰 규칙이다. 순자산이 하한 미만이거나 모르는 상품은 세지 않는다.
// 국내 상품은 규칙 필드가 없어 기초지수 이름으로 정한다. 지수 회사가 달라도 월물 일정·롤 시점이 같으면 같은 규칙이다
// (research/etp-sources.md 지수 계열).
import type { CommodityCode, EtpMarket } from '@futureetp/shared';

// 시장 통화 단위(국내 원, 미국 달러)
export const MIN_MAJORITY_AUM: Readonly<Record<EtpMarket, number>> = {
  KRX: 1_000_000_000,
  US: 10_000_000,
};

// S&P GSCI, DJCI, Bloomberg Single, Solactive 5-Day Roll은 모두 GSCI 일정이다.
// Enhanced는 월물 선택 규칙이 달라 따로 센다.
const KR_RULES: readonly { pattern: RegExp; ruleId: string }[] = [
  { pattern: /\bEnhanced\b/i, ruleId: 'GSCI_ENHANCED' },
  { pattern: /\b(S&P GSCI|DJCI|Bloomberg .*Single|Solactive)\b/i, ruleId: 'GSCI' },
];

// 모르는 지수면 null(세지 않는다)
export function krRuleId(underlyingIndex: string | null): string | null {
  if (underlyingIndex === null) return null;
  return KR_RULES.find(({ pattern }) => pattern.test(underlyingIndex))?.ruleId ?? null;
}

export type MajorityProduct = {
  commodityCode: CommodityCode;
  market: EtpMarket;
  // 국내는 krRuleId, 미국은 매핑표 rollRuleRef. null이면 세지 않는다
  ruleId: string | null;
  aum: number | null;
};

export type MajorityResult = {
  commodityCode: CommodityCode;
  market: EtpMarket;
  // 셀 상품이 없으면 null
  ruleId: string | null;
  // 규칙별 상품 수(로그·확인용)
  counts: Record<string, number>;
};

export function majorityRules(products: readonly MajorityProduct[]): MajorityResult[] {
  const groups = new Map<string, { counts: Map<string, number>; aums: Map<string, number> }>();
  for (const { commodityCode, market, ruleId, aum } of products) {
    const key = `${commodityCode}|${market}`;
    const group = groups.get(key) ?? { counts: new Map(), aums: new Map() };
    groups.set(key, group);
    if (ruleId === null || aum === null || aum < MIN_MAJORITY_AUM[market]) continue;
    group.counts.set(ruleId, (group.counts.get(ruleId) ?? 0) + 1);
    group.aums.set(ruleId, (group.aums.get(ruleId) ?? 0) + aum);
  }
  return [...groups].map(([key, { counts, aums }]) => {
    const [commodityCode, market] = key.split('|') as [CommodityCode, EtpMarket];
    const ranked = [...counts.keys()].sort(
      (a, b) => counts.get(b)! - counts.get(a)! || aums.get(b)! - aums.get(a)!,
    );
    return {
      commodityCode,
      market,
      ruleId: ranked[0] ?? null,
      counts: Object.fromEntries(counts),
    };
  });
}
