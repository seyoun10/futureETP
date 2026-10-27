// 재계산 파이프라인(D-024, D-070): 원자재 하나의 세 기준값을 daily_bar에서 처음부터 다시 계산해 저장한다.
// 일일 정산(DAILY_SETTLE)과 1회 실행 CLI(recomputeCli.ts)가 쓴다.
import { BASES, type Basis, type CommodityCode } from '@futureetp/shared';
import { recomputeBasis } from '../calc/recompute.ts';
import type { db as Db } from '../db/client.ts';
import { loadCommoditySource, replaceBasisResult } from '../db/recompute.ts';

export type BasisSummary = {
  basis: Basis;
  // 규칙이 없어 지우기만 한 기준값은 null
  days: number | null;
  lastTradeDate: string | null;
};

// 기준값마다 따로 저장한다. 한 기준값이 실패해도 나머지는 저장하고, 실패를 모아 마지막에 던진다
export async function recomputeCommodity(
  db: typeof Db,
  commodityCode: CommodityCode,
  now: Date,
): Promise<BasisSummary[]> {
  const source = await loadCommoditySource(db, commodityCode);
  const summaries: BasisSummary[] = [];
  const failures: string[] = [];

  for (const basis of BASES) {
    const rule = basis === 'FRONT' ? null : source.rules[basis];
    if (rule === undefined) {
      await replaceBasisResult(db, commodityCode, basis, null, now);
      summaries.push({ basis, days: null, lastTradeDate: null });
      continue;
    }
    try {
      const result = recomputeBasis({ ...source, rule });
      await replaceBasisResult(db, commodityCode, basis, result, now);
      summaries.push({
        basis,
        days: result.indexBars.length,
        lastTradeDate: result.indexBars.at(-1)?.tradeDate ?? null,
      });
    } catch (error) {
      failures.push(`${commodityCode} ${basis}: ${(error as Error).message}`);
    }
  }
  if (failures.length > 0) throw new Error(`Recompute failed: ${failures.join('; ')}`);
  return summaries;
}
