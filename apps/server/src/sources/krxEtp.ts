// KRX Open API 일별 ETF·ETN 매매정보로 받는 국내 원자재 선물 ETP 목록(research/etp-sources.md, D-096).
// 요청은 basDd + AUTH_KEY 헤더, 하루치 전 종목이 한 번에 온다. 휴장일이나 아직 반영 전인 날은 빈 배열이다.
import type { EtpType } from '@futureetp/shared';
import { z } from 'zod';
import type { KrxEtpListing } from '../calc/etpSeries.ts';
import { parseKrxEtpName } from './krxEtpName.ts';

const BASE_URL = 'https://data-dbg.krx.co.kr/svc/apis/etp';
export const REQUEST_TIMEOUT_MS = 30_000;

// 금액(원)은 숫자 문자열로 온다. 순자산총액은 ETF에만 있다
const rowSchema = z.object({
  ISU_CD: z.string().regex(/^\w{6}$/),
  ISU_NM: z.string(),
  IDX_IND_NM: z.string().nullish(),
  ACC_TRDVAL: z.string().nullish(),
  MKTCAP: z.string().nullish(),
  INVSTASST_NETASST_TOTAMT: z.string().nullish(),
});
export type KrxEtpRow = z.infer<typeof rowSchema>;

const responseSchema = z.object({ OutBlock_1: z.array(rowSchema) });

// 묶기 계획(calc/etpSeries.ts)에 넣는 목록 항목 + 저장할 원문 필드
export type KrxEtpEntry = KrxEtpListing & {
  name: string;
  // ETN 후속 시리즈 끝 글자. 첫 시리즈는 표기가 없어 null
  series: string | null;
  underlyingIndex: string | null;
};

export type KrxEtpDay = { etf: KrxEtpRow[]; etn: KrxEtpRow[] };

export interface KrxEtpSource {
  // date: 'YYYY-MM-DD'
  fetchDay(date: string): Promise<KrxEtpDay>;
}

// 원자재 선물 상품만 남긴다
export function toKrxEtpEntries(rows: readonly KrxEtpRow[], type: EtpType): KrxEtpEntry[] {
  return rows.flatMap((row) => {
    const parsed = parseKrxEtpName(row.ISU_NM);
    if (!parsed) return [];
    const { series, ...attributes } = parsed;
    return [
      {
        ...attributes,
        ticker: row.ISU_CD,
        type,
        name: row.ISU_NM.trim(),
        series,
        underlyingIndex: row.IDX_IND_NM?.trim() || null,
      },
    ];
  });
}

// 빈 값·'-'처럼 숫자가 아니면 null
function toAmount(value: string | null | undefined): number | null {
  if (!value) return null;
  const amount = Number(value.replaceAll(',', ''));
  return Number.isFinite(amount) ? amount : null;
}

function amountsByTicker(
  rows: readonly KrxEtpRow[],
  pick: (row: KrxEtpRow) => string | null | undefined,
) {
  const amounts = new Map<string, number>();
  for (const row of rows) {
    const amount = toAmount(pick(row));
    if (amount !== null) amounts.set(row.ISU_CD, amount);
  }
  return amounts;
}

// 순자산(D-015): ETF는 순자산총액, ETN은 시가총액
export const krxAumByTicker = (day: KrxEtpDay) =>
  new Map([
    ...amountsByTicker(day.etf, (row) => row.INVSTASST_NETASST_TOTAMT),
    ...amountsByTicker(day.etn, (row) => row.MKTCAP),
  ]);

// 거래대금(D-017): KRX 누적 거래대금(ACC_TRDVAL)
export const krxTradingValueByTicker = (day: KrxEtpDay) =>
  amountsByTicker([...day.etf, ...day.etn], (row) => row.ACC_TRDVAL);

export function createKrxEtpSource({
  apiKey,
  fetchFn = fetch,
}: {
  apiKey: string | undefined;
  fetchFn?: typeof fetch;
}): KrxEtpSource {
  async function get(api: string, basDd: string): Promise<KrxEtpRow[]> {
    if (!apiKey) throw new Error('KRX_API_KEY is not set');
    const response = await fetchFn(`${BASE_URL}/${api}?basDd=${basDd}`, {
      headers: { AUTH_KEY: apiKey },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`KRX ${api}: HTTP ${response.status}`);
    return responseSchema.parse(await response.json()).OutBlock_1;
  }

  return {
    async fetchDay(date) {
      const basDd = date.replaceAll('-', '');
      return {
        etf: await get('etf_bydd_trd', basDd),
        etn: await get('etn_bydd_trd', basDd),
      };
    },
  };
}
