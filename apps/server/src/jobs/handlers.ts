import { config } from '../config.ts';
import { db } from '../db/client.ts';
import { createIntradayStore } from '../db/intraday.ts';
import { createSettleStore } from '../db/settle.ts';
import { createFakeSettlementSource } from '../sources/fakeSettlement.ts';
import { createMassiveSettlementSource } from '../sources/massiveSettlement.ts';
import type { SettlementSource } from '../sources/settlement.ts';
import { createYahooIntradaySource } from '../sources/yahooIntraday.ts';
import { createIntradayHandler } from './intraday.ts';
import { recomputeCommodity } from './recompute.ts';
import type { JobHandlers } from './runner.ts';
import { createSettleHandlers } from './settle.ts';

// 실소스는 Massive(D-095). dev는 키가 없을 때만 가짜 소스로 돈다(D-071).
// dev DB에도 실데이터를 적재했으므로(D-088) 키가 있으면 가짜 일봉을 섞지 않는다. prod는 키가 없으면 작업이 실패한다
function settlementSource(): SettlementSource {
  if (config.NODE_ENV === 'development' && !config.MASSIVE_API_KEY) {
    return createFakeSettlementSource();
  }
  return createMassiveSettlementSource({ apiKey: config.MASSIVE_API_KEY });
}

// 구현된 작업만 등록한다. 스케줄러는 여기 있는 작업만 돌리고, CLI는 없는 작업이면 종료한다.
export const JOB_HANDLERS: JobHandlers = {
  ...createSettleHandlers({
    store: createSettleStore(db),
    source: settlementSource(),
    recompute: async (code, now) => {
      await recomputeCommodity(db, code, now);
    },
  }),
  INTRADAY: createIntradayHandler({
    store: createIntradayStore(db),
    source: createYahooIntradaySource(),
  }),
};
