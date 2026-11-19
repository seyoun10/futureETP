// C-d 정렬 기준(정렬 방법은 features/commodity/etp/etpListModel). 문구 키 etp.sorts도 이 목록을 따른다
export const ETP_SORTS = ['DEFAULT', 'AUM', 'TRADING_VALUE'] as const;
export type EtpSort = (typeof ETP_SORTS)[number];
