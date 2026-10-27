// Databento 1회 적재 1단계: 원본 CSV 다운로드(D-020, D-071 뒤 5-4).
// 기본은 견적만 출력한다. --yes를 주면 받는다. 이미 받은 파일은 다시 받지 않는다(요청마다 과금).
// 파일: <out>/<schema>/<원자재>/<연도>.csv.zst — 저장소 밖에 둔다. 한 요청이 길면 연결이 끊겨(CL statistics 56분)
// 연도별로 나눠 받는다. 예전 통째 파일 <out>/<schema>/<원자재>.csv.zst가 있으면 그 원자재는 받지 않는다.
// 변환·DB 적재는 2단계 스크립트가 이 파일들로 한다.
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { COMMODITY_CODES } from '@futureetp/shared';
import { config } from '../config.ts';
import {
  LOAD_SCHEMAS,
  createDatabentoClient,
  outrightRawSymbols,
  type RangeRequest,
} from './databento.ts';

// 적재 시작(D-020). 데이터셋 시작일과 같다
const START = '2010-06-06';
const DEFAULT_OUT = join(homedir(), 'futureetp-data', 'databento');
// 연도 하나가 끊기면 한 번 더 받는다
const MAX_ATTEMPTS = 2;

// [start, end)를 연도 경계로 나눈다
function yearRanges(start: string, end: string): { year: number; start: string; end: string }[] {
  const ranges = [];
  const last = Number(end.slice(0, 4));
  for (let year = Number(start.slice(0, 4)); year <= last; year++) {
    const s = year === Number(start.slice(0, 4)) ? start : `${year}-01-01`;
    const e = year === last ? end : `${year + 1}-01-01`;
    if (s < e) ranges.push({ year, start: s, end: e });
  }
  return ranges;
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: { yes: { type: 'boolean', default: false }, out: { type: 'string' } },
  });
  if (!config.DATABENTO_API_KEY) throw new Error('DATABENTO_API_KEY is not set');
  const client = createDatabentoClient(config.DATABENTO_API_KEY);
  const out = values.out ?? DEFAULT_OUT;

  const jobs: { request: RangeRequest; dir: string; path: string; label: string }[] = [];
  for (const schema of LOAD_SCHEMAS) {
    const end = await client.datasetRangeEnd(schema);
    for (const code of COMMODITY_CODES) {
      if (existsSync(join(out, schema, `${code}.csv.zst`))) {
        console.log(`[exists] ${schema} ${code} (whole file)`);
        continue;
      }
      const dir = join(out, schema, code);
      for (const range of yearRanges(START, end)) {
        jobs.push({
          request: {
            schema,
            symbols: outrightRawSymbols(code),
            start: range.start,
            end: range.end,
          },
          dir,
          path: join(dir, `${range.year}.csv.zst`),
          label: `${schema} ${code} ${range.start}..${range.end}`,
        });
      }
    }
  }

  const pending = jobs.filter((j) => !existsSync(j.path));
  console.log(`${jobs.length - pending.length} chunks already downloaded`);
  let total = 0;
  for (const job of pending) total += await client.cost(job.request);
  console.log(`Total to download: $${total.toFixed(2)} (${pending.length} chunks) → ${out}`);
  if (!values.yes) {
    console.log('Estimate only. Run again with --yes to download.');
    return 0;
  }

  for (const job of pending) {
    await mkdir(job.dir, { recursive: true });
    for (let attempt = 1; ; attempt++) {
      const started = Date.now();
      try {
        await client.downloadCsv(job.request, job.path);
        console.log(`[downloaded ${Date.now() - started} ms] ${job.label}`);
        break;
      } catch (error) {
        console.error(`[attempt ${attempt} failed] ${job.label}: ${(error as Error).message}`);
        if (attempt >= MAX_ATTEMPTS) throw error;
      }
    }
  }
  return 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}
