import { config } from '../config.ts';
import { db } from '../db/client.ts';
import { createSettleStore } from '../db/settle.ts';
import { createFakeSettlementSource } from '../sources/fakeSettlement.ts';
import type { SettlementSource } from '../sources/settlement.ts';
import { recomputeCommodity } from './recompute.ts';
import type { JobHandlers } from './runner.ts';
import { createSettleHandlers } from './settle.ts';

// 실소스(Massive) 연결 전에는 dev만 가짜 소스로 돈다. prod에 가짜 일봉이 들어가지 않게 실패시킨다(D-071)
function settlementSource(): SettlementSource {
  if (config.NODE_ENV === 'development') return createFakeSettlementSource();
  const notConnected = () => Promise.reject(new Error('Settlement source not connected (5-4)'));
  return { name: 'MASSIVE', listContracts: notConnected, fetchDailyBars: notConnected };
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
};
