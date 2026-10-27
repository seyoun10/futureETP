// 서버에서만 쓰는 도메인 값(docs/data-model.md). API에도 나가는 값은 @futureetp/shared에 둔다.

// 자동 수집 소스(D-012, D-016)
export const SOURCES = ['DATABENTO', 'MASSIVE', 'YAHOO', 'NAVER', 'KRX', 'NASDAQ'] as const;
export type Source = (typeof SOURCES)[number];

// 배치 작업 이름. 스케줄러 등록 이름·CLI 인자·Healthchecks.io check slug와 같다(D-045).
export const JOB_NAMES = [
  'DAILY_SETTLE',
  'INTRADAY',
  'DEFERRED_PUSH',
  'ETP',
  'CALENDAR',
  'BACKUP',
] as const;
export type JobName = (typeof JOB_NAMES)[number];

export const BATCH_STATUSES = ['RUNNING', 'SUCCESS', 'FAILED'] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];

// D-006, D-023
export const ALERT_STATUSES = ['SENT', 'HELD', 'SUPPRESSED', 'RETRY', 'FAILED'] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];
