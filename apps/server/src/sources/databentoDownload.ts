// Databento 1회 적재 1단계: 원본 CSV 다운로드(D-020, D-071 뒤 5-4).
// 기본은 견적만 출력한다. --yes를 주면 받는다. 이미 받은 파일은 다시 받지 않는다(요청마다 과금).
// 파일: <out>/<schema>/<원자재>.csv.zst — 저장소 밖에 둔다. 변환·DB 적재는 2단계 스크립트가 이 파일로 한다.
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

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: { yes: { type: 'boolean', default: false }, out: { type: 'string' } },
  });
  if (!config.DATABENTO_API_KEY) throw new Error('DATABENTO_API_KEY is not set');
  const client = createDatabentoClient(config.DATABENTO_API_KEY);
  const out = values.out ?? DEFAULT_OUT;

  const jobs: { request: RangeRequest; path: string; label: string }[] = [];
  for (const schema of LOAD_SCHEMAS) {
    const end = await client.datasetRangeEnd(schema);
    for (const code of COMMODITY_CODES) {
      jobs.push({
        request: { schema, symbols: outrightRawSymbols(code), start: START, end },
        path: join(out, schema, `${code}.csv.zst`),
        label: `${schema} ${code} ${START}..${end}`,
      });
    }
  }

  let total = 0;
  const pending = jobs.filter((j) => !existsSync(j.path));
  for (const job of jobs) {
    if (!pending.includes(job)) {
      console.log(`[exists] ${job.label}`);
      continue;
    }
    const cost = await client.cost(job.request);
    total += cost;
    console.log(`[cost $${cost.toFixed(2)}] ${job.label}`);
  }
  console.log(`Total to download: $${total.toFixed(2)} (${pending.length} files) → ${out}`);
  if (!values.yes) {
    console.log('Estimate only. Run again with --yes to download.');
    return 0;
  }

  for (const job of pending) {
    await mkdir(join(out, job.request.schema), { recursive: true });
    const started = Date.now();
    await client.downloadCsv(job.request, job.path);
    console.log(`[downloaded ${Date.now() - started} ms] ${job.label}`);
  }
  return 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}
