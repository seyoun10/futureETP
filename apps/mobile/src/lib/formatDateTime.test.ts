import { formatLocalDateTime, formatTradeDate } from './formatDateTime';

describe('formatLocalDateTime', () => {
  it('UTC 시각을 지정한 시간대의 MM/DD HH:mm으로 바꾼다', () => {
    expect(formatLocalDateTime('2026-10-22T00:00:00Z', 'Asia/Seoul')).toBe('10/22 09:00');
    expect(formatLocalDateTime('2026-10-22T14:05:00Z', 'America/Chicago')).toBe('10/22 09:05');
  });

  it('자정은 24가 아니라 00으로, 날짜가 바뀌면 현지 날짜로 쓴다', () => {
    expect(formatLocalDateTime('2026-10-22T15:00:00Z', 'Asia/Seoul')).toBe('10/23 00:00');
  });
});

describe('formatTradeDate', () => {
  it('거래일을 MM/DD로 쓴다', () => {
    expect(formatTradeDate('2026-01-05')).toBe('01/05');
  });
});
