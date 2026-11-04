import { z } from 'zod';
import { freshnessSchema } from './freshness.ts';

// C-c 월물 하나의 원가격 선(product.md 월물차트). 가격은 소수 자릿수를 맞추지 않은 값이다.
export const contractLineSchema = z.object({
  symbol: z.string(),
  // YYYY-MM
  contractMonth: z.string().regex(/^\d{4}-\d{2}$/),
  // 롤 수익률 연환산(만기 간격)에 쓴다
  lastTradeDate: z.iso.date(),
  // 대표월물(A의 ● 표식)
  isFront: z.boolean(),
  // dates와 같은 길이·순서. 그날 값이 없으면(상장 전 등) null
  prices: z.array(z.number().nullable()),
});
export type ContractLine = z.infer<typeof contractLineSchema>;

// GET /v1/commodities/:code/contracts. 선 여러 개가 날짜를 공유하므로 열 배열이다(D-092).
export const contractsChartSchema = z
  .object({
    freshness: freshnessSchema,
    priceDecimals: z.number().int().nonnegative(),
    // 거래일 오름차순. 가장 이른 월물의 첫 일봉부터 D까지 중 최근 3년씩 준다.
    // before를 주면 그 날짜보다 이른 3년이다(D-104)
    dates: z.array(z.iso.date()),
    // dates보다 이른 날이 더 있는지
    hasMore: z.boolean(),
    // 마지막 날짜에 장중 스냅숏 값(오늘 잠정 값)이 하나라도 있는지
    provisional: z.boolean(),
    // A와 같은 월물 목록(만기순 5개, 대표월물 안전장치 6번째)
    contracts: z.array(contractLineSchema),
  })
  .refine((c) => c.contracts.every((l) => l.prices.length === c.dates.length), {
    message: 'prices length must match dates',
  });
export type ContractsChart = z.infer<typeof contractsChartSchema>;
