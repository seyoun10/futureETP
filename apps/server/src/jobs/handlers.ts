import { config } from '../config.ts';
import { createPgDumpTarget } from '../db/backupTarget.ts';
import { createCalendarStore } from '../db/calendarStore.ts';
import { db } from '../db/client.ts';
import { createPushDeviceStore } from '../db/devicesStore.ts';
import { createEtpStore } from '../db/etpStore.ts';
import { createIntradayStore } from '../db/intraday.ts';
import { createRareAlertStore } from '../db/rareAlertStore.ts';
import { createRetentionStore } from '../db/retentionStore.ts';
import { createSettingsStore } from '../db/settingsStore.ts';
import { createSettleStore } from '../db/settle.ts';
import { pushSender } from '../push/configuredSender.ts';
import { createKrxEtpSource } from '../sources/krxEtp.ts';
import { createFakeSettlementSource } from '../sources/fakeSettlement.ts';
import { createMassiveSettlementSource } from '../sources/massiveSettlement.ts';
import { createNasdaqEtpSource } from '../sources/nasdaqEtp.ts';
import { createNaverEtfSource } from '../sources/naverEtf.ts';
import type { SettlementSource } from '../sources/settlement.ts';
import { createYahooEtpSource } from '../sources/yahooEtp.ts';
import { createYahooIntradaySource } from '../sources/yahooIntraday.ts';
import { createBackupHandler } from './backup.ts';
import { createCalendarHandler } from './calendar.ts';
import { createDeferredPushHandler } from './deferredPush.ts';
import { createEtpHandler } from './etp.ts';
import { createEtpCandidateAlert } from './etpCandidateAlert.ts';
import { createIntradayHandler } from './intraday.ts';
import { createMajorityAlert } from './majorityAlert.ts';
import { createAlertRetry, createDeferredAlert, createRareAlert } from './rareAlert.ts';
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

const alertDeps = {
  store: createRareAlertStore(db),
  devices: createPushDeviceStore(db),
  sender: pushSender,
};
const retry = createAlertRetry(alertDeps);
const etpStore = createEtpStore(db);
const settings = createSettingsStore(db);

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
    alert: createRareAlert(alertDeps),
    retry,
  }),
  DEFERRED_PUSH: createDeferredPushHandler({ retry, deferred: createDeferredAlert(alertDeps) }),
  ETP: createEtpHandler({
    source: createKrxEtpSource({ apiKey: config.KRX_API_KEY }),
    naver: createNaverEtfSource(),
    nasdaq: createNasdaqEtpSource(),
    yahoo: createYahooEtpSource(),
    store: etpStore,
    candidateAlert: createEtpCandidateAlert({
      store: etpStore,
      devices: alertDeps.devices,
      sender: pushSender,
      locale: async () => (await settings.get()).locale,
    }),
    majorityAlert: createMajorityAlert({
      store: etpStore,
      devices: alertDeps.devices,
      sender: pushSender,
      locale: async () => (await settings.get()).locale,
    }),
  }),
  CALENDAR: createCalendarHandler({ store: createCalendarStore(db) }),
  BACKUP: createBackupHandler({
    target: config.BACKUP_DIR
      ? createPgDumpTarget({ dir: config.BACKUP_DIR, databaseUrl: config.DATABASE_URL })
      : null,
    retention: createRetentionStore(db),
  }),
};
