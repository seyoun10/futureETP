// 국내 ETF 총보수(C-d-a). KRX Open API에 없어 네이버 모바일 비공식 API `integration`의
// `etfKeyIndicator.totalFee`(%)를 쓴다(research/etp-sources.md). ETN은 이 값이 없다.
// 비공식이라 실패해도 ETP 작업은 계속하고 저장된 값을 둔다(jobs/etp.ts).
import { z } from 'zod';
import { fetchJson } from './http.ts';

const BASE_URL = 'https://m.stock.naver.com/api/stock';
export const REQUEST_TIMEOUT_MS = 15_000;

const responseSchema = z.object({
  etfKeyIndicator: z.object({ totalFee: z.number().nonnegative() }).nullish(),
});

export interface NaverEtfSource {
  // ETF가 아니거나 값이 없으면 null
  expenseRatio(ticker: string): Promise<number | null>;
}

export function createNaverEtfSource({
  fetchFn = fetch,
}: { fetchFn?: typeof fetch } = {}): NaverEtfSource {
  return {
    async expenseRatio(ticker) {
      const body = await fetchJson(
        fetchFn,
        `${BASE_URL}/${encodeURIComponent(ticker)}/integration`,
        {
          label: `Naver ${ticker}`,
          timeoutMs: REQUEST_TIMEOUT_MS,
        },
      );
      return responseSchema.parse(body).etfKeyIndicator?.totalFee ?? null;
    },
  };
}
