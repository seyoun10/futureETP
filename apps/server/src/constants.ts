// 서버에서만 쓰는 도메인 값(docs/data-model.md). API에도 나가는 값은 @futureetp/shared에 둔다.

// 자동 수집 소스(D-012, D-016). FAKE는 dev 전용 가짜 정산 소스다(D-071).
export const SOURCES = ['DATABENTO', 'MASSIVE', 'YAHOO', 'NAVER', 'KRX', 'NASDAQ', 'FAKE'] as const;
export type Source = (typeof SOURCES)[number];

// 배치 작업 이름은 운영 알림 문구에도 쓰므로 shared에 둔다.
export { JOB_NAMES, type JobName } from '@futureetp/shared';

export const BATCH_STATUSES = ['RUNNING', 'SUCCESS', 'FAILED'] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];

// D-006, D-023
export const ALERT_STATUSES = ['SENT', 'HELD', 'SUPPRESSED', 'RETRY', 'FAILED'] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];
