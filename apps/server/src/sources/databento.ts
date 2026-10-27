// Databento 과거 데이터 HTTP API(D-020, D-048). 2010-06~ 일봉 1회 적재에만 쓴다.
// 요청 형식은 공식 Python 클라이언트와 같다: POST form, Basic 인증(사용자 = API 키, 비밀번호 없음).
import { createWriteStream } from 'node:fs';
import { rename } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import type { CommodityCode } from '@futureetp/shared';
import { MONTH_CODES } from '../calc/contractSymbol.ts';

const BASE_URL = 'https://hist.databento.com/v0';
export const DATASET = 'GLBX.MDP3';
// 적재에 쓰는 스키마: 정산가·확정 거래량(statistics), 시가·고가·저가(ohlcv-1d), 만기(definition)
export const LOAD_SCHEMAS = ['statistics', 'ohlcv-1d', 'definition'] as const;
export type LoadSchema = (typeof LOAD_SCHEMAS)[number];

// 단일 월물 Globex 심볼(연도 1자리, 예: CLZ6). 같은 심볼이 10년마다 다시 쓰이지만 raw_symbol은
// 날짜별로 그때의 월물로 풀린다. 스프레드(CLZ6-CLF7)·옵션은 빠진다(비용 약 1/11)
export function outrightRawSymbols(code: CommodityCode): string[] {
  return MONTH_CODES.flatMap((month) =>
    Array.from({ length: 10 }, (_, year) => `${code}${month}${year}`),
  );
}

export type RangeRequest = {
  schema: LoadSchema;
  symbols: readonly string[];
  // ISO. end는 포함하지 않는다
  start: string;
  end: string;
};

export function createDatabentoClient(apiKey: string, fetchFn: typeof fetch = fetch) {
  const auth = `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;

  async function request(path: string, init: RequestInit = {}): Promise<Response> {
    const response = await fetchFn(`${BASE_URL}/${path}`, {
      ...init,
      headers: { authorization: auth, accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Databento ${path}: HTTP ${response.status} ${await response.text()}`);
    }
    return response;
  }

  const rangeForm = (r: RangeRequest) =>
    new URLSearchParams({
      dataset: DATASET,
      schema: r.schema,
      symbols: r.symbols.join(','),
      stype_in: 'raw_symbol',
      start: r.start,
      end: r.end,
    });

  return {
    // 스키마별 받을 수 있는 범위 끝(ISO)
    async datasetRangeEnd(schema: LoadSchema): Promise<string> {
      const response = await request(`metadata.get_dataset_range?dataset=${DATASET}`);
      const body = (await response.json()) as { schema: Record<string, { end: string }> };
      const end = body.schema[schema]?.end;
      if (!end) throw new Error(`Databento: no range for ${schema}`);
      return end;
    },

    // 예상 비용(USD). 데이터를 받지 않는다
    async cost(r: RangeRequest): Promise<number> {
      const response = await request('metadata.get_cost', { method: 'POST', body: rangeForm(r) });
      return Number(await response.text());
    },

    // CSV(zstd 압축)로 받아 path에 쓴다. 받는 중 실패하면 path는 생기지 않는다(.part만 남음).
    // 요청할 때마다 과금되므로 호출자가 이미 받은 파일이면 부르지 않는다
    async downloadCsv(r: RangeRequest, path: string): Promise<void> {
      const form = rangeForm(r);
      form.set('encoding', 'csv');
      form.set('compression', 'zstd');
      form.set('pretty_px', 'true');
      form.set('pretty_ts', 'true');
      form.set('map_symbols', 'true');
      const response = await request('timeseries.get_range', { method: 'POST', body: form });
      if (!response.body) throw new Error('Databento: empty response body');
      const part = `${path}.part`;
      await pipeline(
        Readable.fromWeb(response.body as WebReadableStream<Uint8Array>),
        createWriteStream(part),
      );
      await rename(part, path);
    },
  };
}
