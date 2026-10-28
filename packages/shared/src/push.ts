import type { Basis, CommodityCode, Direction, JobName, Locale, MaPeriod } from './domain.ts';

// 서버가 저장된 언어로 만드는 푸시 문구(D-032, D-040). 형식은 wireframes/screens.md X 화면.
export type PushText = { title: string; body: string | null };

// Android 알림 채널(앱이 만들고 서버가 발송 때 지정). 운영 알림은 거부 시간과 관계없이 따로 보낸다(D-045).
export const ANDROID_CHANNELS = ['alerts', 'ops'] as const;
export type AndroidChannel = (typeof ANDROID_CHANNELS)[number];

type Messages = {
  commodities: Record<CommodityCode, string>;
  bases: Record<Basis, string>;
  rareTitle: (name: string, basis: string, direction: Direction, level: string) => string;
  disparity: (value: string, direction: Direction) => string;
  maPeriod: (period: MaPeriod) => string;
  deferred: (time: string) => string;
  jobs: Record<JobName, string>;
  jobFailed: (job: string) => string;
  etpCandidates: (count: number) => string;
  more: (count: number) => string;
};

const MESSAGES: Record<Locale, Messages> = {
  ko: {
    commodities: { GC: '금', SI: '은', CL: '원유', NG: '천연가스' },
    bases: { FRONT: '대표월물', KR: '한국형', US: '미국형' },
    rareTitle: (name, basis, direction, level) =>
      `${name}(${basis}) 이격도 ${direction === 'UP' ? '상위' : '하위'} ${level}% 도달`,
    disparity: (value, direction) => `${value}(${direction === 'UP' ? '고가' : '저가'} 기준)`,
    maPeriod: (period) => `${period}일선`,
    deferred: (time) => `${time} 감지 · 지연 발송`,
    jobs: {
      DAILY_SETTLE: '일일 정산',
      SETTLE_REVISION: '정산 정정 확인',
      INTRADAY: '장중 판정',
      DEFERRED_PUSH: '지연 발송',
      ETP: 'ETP 목록',
      CALENDAR: '거래일 달력',
      BACKUP: '백업',
    },
    jobFailed: (job) => `서버 작업 실패: ${job}`,
    etpCandidates: (count) => `미국 ETP 새 후보 ${count}개 · 매핑표 확인 필요`,
    more: (count) => `외 ${count}개`,
  },
  en: {
    commodities: { GC: 'Gold', SI: 'Silver', CL: 'Crude Oil', NG: 'Natural Gas' },
    bases: { FRONT: 'Front month', KR: 'KR-style', US: 'US-style' },
    rareTitle: (name, basis, direction, level) =>
      `${name} (${basis}) disparity hit ${direction === 'UP' ? 'top' : 'bottom'} ${level}%`,
    disparity: (value, direction) => `${value} (${direction === 'UP' ? 'high' : 'low'})`,
    maPeriod: (period) => `${period}-day MA`,
    deferred: (time) => `detected ${time} · delayed`,
    jobs: {
      DAILY_SETTLE: 'Daily settlement',
      SETTLE_REVISION: 'Settlement revision check',
      INTRADAY: 'Intraday check',
      DEFERRED_PUSH: 'Deferred push',
      ETP: 'ETP list',
      CALENDAR: 'Trading calendar',
      BACKUP: 'Backup',
    },
    jobFailed: (job) => `Server job failed: ${job}`,
    etpCandidates: (count) =>
      `${count} new US ETP candidate${count === 1 ? '' : 's'} · check the mapping table`,
    more: (count) => `+${count} more`,
  },
};

export type RareLevelAlert = {
  commodity: CommodityCode;
  basis: Basis;
  direction: Direction;
  // rare 레벨(%), 소수 첫째 자리까지
  level: number;
  // 판정 이격도(%): 위 방향은 고가, 아래 방향은 저가 기준
  disparity: number;
  maPeriod: MaPeriod;
  // 판정 시각
  detectedAt: Date;
  // 알림 거부 시간이 끝나 보내는 알림이면 true
  deferred: boolean;
};

// 사용자 시간대의 HH:mm
function formatTime(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(at);
}

function formatDisparity(value: number): string {
  const fixed = value.toFixed(1);
  return value > 0 && fixed !== '0.0' ? `+${fixed}%` : `${fixed === '-0.0' ? '0.0' : fixed}%`;
}

// 예: 원유(미국형) 이격도 상위 5% 도달 / +19.2%(고가 기준) · 100일선 · 09:00
export function rareLevelPush(locale: Locale, timeZone: string, alert: RareLevelAlert): PushText {
  const m = MESSAGES[locale];
  const time = formatTime(alert.detectedAt, timeZone);
  return {
    title: m.rareTitle(
      m.commodities[alert.commodity],
      m.bases[alert.basis],
      alert.direction,
      String(Number(alert.level.toFixed(1))),
    ),
    body: [
      m.disparity(formatDisparity(alert.disparity), alert.direction),
      m.maPeriod(alert.maPeriod),
      alert.deferred ? m.deferred(time) : time,
    ].join(' · '),
  };
}

// 배치가 재시도까지 실패했을 때 보내는 한 줄 운영 알림(D-045)
export function jobFailedPush(locale: Locale, job: JobName): PushText {
  const m = MESSAGES[locale];
  return { title: m.jobFailed(m.jobs[job]), body: null };
}

// 본문에 심볼을 이만큼까지 쓰고 나머지는 개수로 줄인다
export const ETP_CANDIDATE_SYMBOLS_SHOWN = 5;

// 미국 ETP 새 후보를 처음 발견한 배치에서 묶어 1회 보내는 알림(D-025). 예: 미국 ETP 새 후보 2개 · 매핑표 확인 필요 / NEWG, NEWW
export function etpCandidatesPush(locale: Locale, symbols: string[]): PushText {
  const m = MESSAGES[locale];
  const shown = symbols.slice(0, ETP_CANDIDATE_SYMBOLS_SHOWN);
  const rest = symbols.length - shown.length;
  return {
    title: m.etpCandidates(symbols.length),
    body: shown.join(', ') + (rest > 0 ? ` ${m.more(rest)}` : ''),
  };
}
