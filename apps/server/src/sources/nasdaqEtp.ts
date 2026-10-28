// 미국 ETP 후보 목록과 순자산·총보수(D-016, D-099). Nasdaq 비공식 API라 형식이 바뀌면 zod 검증이 던진다.
// 스크리너는 전 종목(약 5,500, ETN 포함)의 심볼·이름만 주고, 종목별 summary가 순자산(천 달러)·총보수(%)를 준다.
import { z } from 'zod';

const BASE_URL = 'https://api.nasdaq.com/api';
export const REQUEST_TIMEOUT_MS = 30_000;

const screenerSchema = z.object({
  data: z.object({
    data: z.object({
      rows: z.array(z.object({ symbol: z.string(), companyName: z.string() })),
    }),
  }),
});

// 없는 심볼은 HTTP 200에 data: null이다. 값은 '1,848,478'·'0.81%'·'N/A' 같은 문자열이다
const summarySchema = z.object({
  data: z
    .object({
      summaryData: z.record(
        z.string(),
        z.object({ value: z.union([z.string(), z.number()]).nullish() }),
      ),
    })
    .nullable(),
});

export type UsListing = { symbol: string; name: string };
export type NasdaqEtpSummary = { aum: number | null; expenseRatio: number | null };

export interface NasdaqEtpSource {
  listings(): Promise<UsListing[]>;
  // 없는 심볼이면 null
  summary(symbol: string): Promise<NasdaqEtpSummary | null>;
}

// '$'·','·'%'를 떼고 숫자로. 'N/A'처럼 숫자가 아니면 null
export function parseNasdaqNumber(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = value?.replace(/[$,%\s]/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function createNasdaqEtpSource({
  fetchFn = fetch,
}: { fetchFn?: typeof fetch } = {}): NasdaqEtpSource {
  async function get(path: string, label: string): Promise<unknown> {
    const response = await fetchFn(`${BASE_URL}${path}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Nasdaq ${label}: HTTP ${response.status}`);
    return response.json();
  }

  return {
    async listings() {
      const body = screenerSchema.parse(await get('/screener/etf?download=true', 'screener'));
      return body.data.data.rows.map((row) => ({
        symbol: row.symbol.trim(),
        name: row.companyName.trim(),
      }));
    },

    async summary(symbol) {
      const path = `/quote/${encodeURIComponent(symbol)}/summary?assetclass=etf`;
      const { data } = summarySchema.parse(await get(path, symbol));
      if (!data) return null;
      const thousands = parseNasdaqNumber(data.summaryData.AUM?.value);
      return {
        // 라벨이 'Assets Under Management (,000)'
        aum: thousands === null ? null : thousands * 1000,
        expenseRatio: parseNasdaqNumber(data.summaryData.ExpenseRatio?.value),
      };
    },
  };
}
