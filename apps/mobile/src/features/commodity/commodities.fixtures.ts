import type { Commodities } from '@futureetp/shared';

// C 화면 테스트용 A 목록. title-bar가 조회하는데, mock이 undefined를 돌려주면 TanStack Query가 오류를 찍는다
export const EMPTY_COMMODITIES: Commodities = {
  freshness: {
    asOf: '2026-10-22T14:45:00Z',
    tradeDate: '2026-10-22',
    delayed: true,
    marketState: 'OPEN',
    nextUpdateAt: null,
  },
  commodities: [],
};
