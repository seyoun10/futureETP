import type { AppErrorCode } from '@/api/AppError';

// 번역 리소스의 기준 언어. en은 이 구조를 그대로 따라야 한다(키 누락은 타입 오류).
export const ko = {
  common: {
    retry: '다시 시도',
    loading: '불러오는 중',
  },
  settings: {
    language: '언어',
    upDownStyle: '등락 색',
    upDownStyleKR: '한국식',
    upDownStyleUS: '미국식',
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
