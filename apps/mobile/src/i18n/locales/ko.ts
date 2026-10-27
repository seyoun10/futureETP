import type { CommodityCode, MarketState } from '@futureetp/shared';
import type { AppErrorCode } from '@/api/AppError';

// 번역 리소스의 기준 언어. en은 이 구조를 그대로 따라야 한다(키 누락은 타입 오류).
export const ko = {
  common: {
    retry: '다시 시도',
    loading: '불러오는 중',
    back: '뒤로',
    cancel: '취소',
  },
  commodities: {
    GC: '금',
    SI: '은',
    CL: '원유',
    NG: '천연가스',
  } satisfies Record<CommodityCode, string>,
  freshness: {
    asOf: '{{time}} 기준',
    tradeDate: '거래일 {{date}}',
    delayed: '지연',
    marketState: {
      OPEN: '장중',
      CLOSED: '휴장',
      SETTLEMENT_PENDING: '정산 대기',
    } satisfies Record<MarketState, string>,
  },
  commodity: {
    rotate: '가로/세로 전환',
    tabs: {
      disparity: '이격도차트',
      curve: '월물커브',
      contracts: '월물차트',
      etps: 'ETP',
    },
  },
  etp: {
    detailTitle: 'ETP 상세',
  },
  settings: {
    title: '설정',
    alerts: '알림',
    accessKey: '접근 키',
    dataSources: '데이터 출처',
    language: '언어',
    upDownStyle: '등락 색',
    upDownStyleKR: '한국식',
    upDownStyleUS: '미국식',
    // 언어 이름은 그 언어로 쓴다
    languageKo: '한국어',
    languageEn: 'English',
    sectionDisplay: '표시',
    sectionDisparity: '이격도차트',
    basis: '차트 기준값',
    basisFRONT: '대표월물',
    basisKR: '한국형',
    basisUS: '미국형',
    maPeriod: '기준 이평선(일)',
    window: '분포 기간(년)',
    windowALL: '전체',
    alertOff: '끔',
    rareLevels: 'rare-level(%)',
    rareLevelField: 'rare-level {{index}}',
    rareLevelHint: '{{min}}~{{max}}, 소수 첫째 자리, 서로 다른 {{count}}개',
    rareLevelInvalid: '{{min}}~{{max}} 사이 값을 소수 첫째 자리까지 입력해 주세요.',
    rareLevelDuplicate: '서로 다른 값 {{count}}개를 입력해 주세요.',
    saveFailed: '저장하지 못했습니다. {{reason}}',
  },
  dataSources: {
    sections: {
      futures: '선물 시세',
      etp: 'ETP',
    },
    rows: {
      exchange: { label: '거래소', value: 'CME Group (NYMEX·COMEX)' },
      settlement: { label: '정산가·거래량', value: 'Massive · 장 마감 후 반영' },
      intraday: { label: '장중 시세', value: 'Yahoo Finance · 약 10분 지연' },
      history: { label: '과거 일봉', value: 'Databento (2010-06~)' },
      etpKr: { label: '국내', value: '네이버 증권, KRX' },
      etpUs: { label: '미국', value: 'Nasdaq, Yahoo Finance' },
    },
    notice:
      '롤 규칙: S&P GSCI·Bloomberg 지수 방법론을 따라 앱이 계산한 값입니다. 개인 참고용이며 정확성을 보장하지 않고, 투자 권유가 아닙니다.',
  },
  accessKey: {
    guide: '서버 접근 키를 넣어 주세요. Mac에서 키 스크립트가 띄운 QR을 읽거나 키를 붙여넣으세요.',
    pastePlaceholder: '키 붙여넣기',
    submit: '확인',
    verifying: '확인 중',
    badFormat: '키 형식이 맞지 않습니다.',
    rejected: '키가 맞지 않습니다.',
    saved: '설정됨',
    scanQr: 'QR 읽기',
    scannerLabel: 'QR 카메라',
    notKeyQr: '접근 키 QR이 아닙니다.',
    cameraUnavailable: '카메라를 쓸 수 없습니다. 키를 붙여넣어 주세요.',
  },
  alertSettings: {
    title: '알림 설정',
  },
  // 에러 code별 사용자 문구(D-042). 서버 message는 보여 주지 않는다.
  errors: {
    UNAUTHORIZED: '접근 키가 없거나 맞지 않습니다.',
    RATE_LIMITED: '요청이 너무 많습니다. 잠시 뒤 다시 시도해 주세요.',
    VALIDATION_FAILED: '입력값이 올바르지 않습니다.',
    NOT_FOUND: '데이터를 찾을 수 없습니다.',
    INTERNAL: '서버에 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요.',
    NETWORK: '네트워크에 연결할 수 없습니다.',
    TIMEOUT: '서버 응답이 늦습니다. 잠시 뒤 다시 시도해 주세요.',
    SCHEMA_MISMATCH: '앱과 서버 버전이 맞지 않습니다. 앱을 업데이트해 주세요.',
  } satisfies Record<AppErrorCode, string>,
};

type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };
export type Translation = Shape<typeof ko>;
