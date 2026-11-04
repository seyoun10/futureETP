// 장중 배치 조회·저장(D-094). 흐름은 jobs/intraday.ts
import { BASES } from '@futureetp/shared';
import { and, desc, eq, lt, max, sql } from 'drizzle-orm';
import type { IntradayStore } from '../jobs/intraday.ts';
import type { db as Db } from './client.ts';
import { createCommoditiesStore } from './commoditiesStore.ts';
import { contractsFrom } from './queries.ts';
import { indexBar, indexSnapshot, intradaySnapshot, rollWeight } from './schema.ts';

const excluded = (column: string) => sql.raw(`excluded.${column}`);

export function createIntradayStore(db: typeof Db): IntradayStore {
  const { tradingDays, lastSettledTradeDate } = createCommoditiesStore(db);
  return {
    tradingDays,
    lastSettledTradeDate,
    contracts: (code, fromDate) => contractsFrom(db, code, fromDate),
    async heldWeights(code, before) {
      const perBasis = await Promise.all(
        BASES.map((basis) => {
          const latest = db
            .select({ tradeDate: max(rollWeight.tradeDate) })
            .from(rollWeight)
            .where(
              and(
                eq(rollWeight.commodityCode, code),
                eq(rollWeight.basis, basis),
                lt(rollWeight.tradeDate, before),
              ),
            );
          return db
            .select({
              basis: rollWeight.basis,
              tradeDate: rollWeight.tradeDate,
              contractSymbol: rollWeight.contractSymbol,
              weight: rollWeight.weight,
            })
            .from(rollWeight)
            .where(
              and(
                eq(rollWeight.commodityCode, code),
                eq(rollWeight.basis, basis),
                sql`${rollWeight.tradeDate} = (${latest})`,
              ),
            );
        }),
      );
      return perBasis.flat();
    },
    async indexHistory(code, basis, before, limit) {
      const rows = await db
        .select({
          tradeDate: indexBar.tradeDate,
          close: indexBar.close,
          blendedPrice: indexBar.blendedPrice,
          isValid: indexBar.isValid,
        })
        .from(indexBar)
        .where(
          and(
            eq(indexBar.commodityCode, code),
            eq(indexBar.basis, basis),
            lt(indexBar.tradeDate, before),
          ),
        )
        .orderBy(desc(indexBar.tradeDate))
        .limit(limit);
      return rows.reverse();
    },
    async save(quotes, indexes) {
      await db.transaction(async (tx) => {
        if (quotes.length > 0) {
          await tx
            .insert(intradaySnapshot)
            .values([...quotes])
            .onConflictDoUpdate({
              target: [intradaySnapshot.contractSymbol, intradaySnapshot.capturedAt],
              set: {
                tradeDate: excluded('trade_date'),
                last: excluded('last'),
                dayOpen: excluded('day_open'),
                dayHigh: excluded('day_high'),
                dayLow: excluded('day_low'),
                volume: excluded('volume'),
                sourceTime: excluded('source_time'),
              },
            });
        }
        if (indexes.length > 0) {
          await tx
            .insert(indexSnapshot)
            .values([...indexes])
            .onConflictDoUpdate({
              target: [indexSnapshot.commodityCode, indexSnapshot.basis, indexSnapshot.capturedAt],
              set: {
                tradeDate: excluded('trade_date'),
                open: excluded('open'),
                high: excluded('high'),
                low: excluded('low'),
                last: excluded('last'),
                disparityByMa: excluded('disparity_by_ma'),
              },
            });
        }
      });
    },
  };
}
