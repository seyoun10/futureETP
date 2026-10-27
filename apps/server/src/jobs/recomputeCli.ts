// 재계산 1회 실행(D-070). 원자재를 주지 않으면 4종 모두. 적재 뒤·규칙 변경 뒤 바로 확인할 때 쓴다.
import { COMMODITY_CODES, type CommodityCode } from '@futureetp/shared';
import { db } from '../db/client.ts';
import { recomputeCommodity } from './recompute.ts';

const USAGE = `Usage: npm run recompute -w apps/server -- [${COMMODITY_CODES.join('|')} ...]`;

const isCommodityCode = (v: string): v is CommodityCode =>
  (COMMODITY_CODES as readonly string[]).includes(v);

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  if (!args.every(isCommodityCode)) throw new Error(USAGE);
  const codes = args.length > 0 ? args : COMMODITY_CODES;

  let failed = 0;
  for (const code of codes) {
    const started = Date.now();
    try {
      const summaries = await recomputeCommodity(db, code, new Date());
      for (const s of summaries) {
        const detail =
          s.days === null ? 'no roll rule, cleared' : `${s.days} days, last ${s.lastTradeDate}`;
        console.log(`[recompute ${code} ${s.basis}] ${detail}`);
      }
      console.log(`[recompute ${code}] done in ${Date.now() - started} ms`);
    } catch (error) {
      failed++;
      console.error(`[recompute ${code}] ${(error as Error).message}`);
    }
  }
  return failed === 0 ? 0 : 1;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  await db.$client.end();
}
