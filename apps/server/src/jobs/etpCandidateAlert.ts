// 미국 ETP 새 후보(needs_review)를 처음 발견한 배치에서 묶어 1회 알린다(D-025).
// 처리는 코드의 매핑표 수정이라 운영 알림처럼 ops 채널로 보내고, 누르면 A로 간다(앱 push/notificationHref.ts).
// 한 기기에도 전달하지 못하면 표시하지 않아 다음 ETP 작업 때 다시 보낸다.
import { etpCandidatesPush, type Locale } from '@futureetp/shared';
import { broadcast, delivered, type PushDeviceStore } from '../push/broadcast.ts';
import type { PushSender } from '../push/sender.ts';

export type EtpCandidate = { id: string; ticker: string };

export interface EtpCandidateAlertStore {
  // 아직 알리지 않은 후보(review_notified_at 없음), 심볼 순
  unnotifiedCandidates(): Promise<EtpCandidate[]>;
  markCandidatesNotified(ids: string[], at: Date): Promise<void>;
}

export type EtpCandidateAlertOutcome = 'NONE' | 'SENT' | 'UNDELIVERED';

export function createEtpCandidateAlert(deps: {
  store: EtpCandidateAlertStore;
  devices: PushDeviceStore;
  sender: PushSender;
  locale: () => Promise<Locale>;
  log?: (message: string) => void;
}) {
  const log = deps.log ?? console.log;
  return async (now: Date): Promise<EtpCandidateAlertOutcome> => {
    const candidates = await deps.store.unnotifiedCandidates();
    if (candidates.length === 0) return 'NONE';
    const symbols = candidates.map((candidate) => candidate.ticker);
    const result = await broadcast(
      { store: deps.devices, sender: deps.sender },
      {
        text: etpCandidatesPush(await deps.locale(), symbols),
        channel: 'ops',
        data: { type: 'ETP_CANDIDATES' },
      },
    );
    if (!delivered(result)) {
      log(
        `[etp candidates] ${symbols.join(', ')} not delivered to ${result.devices} device(s): ` +
          result.failures.join('; '),
      );
      return 'UNDELIVERED';
    }
    await deps.store.markCandidatesNotified(
      candidates.map((candidate) => candidate.id),
      now,
    );
    log(`[etp candidates] notified ${symbols.join(', ')}`);
    return 'SENT';
  };
}

export type EtpCandidateAlert = ReturnType<typeof createEtpCandidateAlert>;
