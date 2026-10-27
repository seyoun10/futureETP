import { describe, expect, it } from 'vitest';
import { parseJobArgs } from './args.ts';

describe('parseJobArgs', () => {
  it('작업 이름만 받는다', () => {
    expect(parseJobArgs(['DAILY_SETTLE'])).toEqual({ job: 'DAILY_SETTLE' });
  });

  it('오프셋이 있는 기준 시각을 받는다', () => {
    expect(parseJobArgs(['INTRADAY', '2026-10-27T09:15:00-05:00'])).toEqual({
      job: 'INTRADAY',
      asOf: new Date('2026-10-27T14:15:00Z'),
    });
  });

  it.each([
    [[]],
    [['daily_settle']],
    [['INTRADAY', '2026-10-27T09:15:00']],
    [['INTRADAY', '2026-10-27T09:15:00Z', 'extra']],
  ])('잘못된 인자 %j는 사용법과 함께 실패한다', (argv) => {
    expect(() => parseJobArgs(argv)).toThrow(/Usage: npm run job/);
  });
});
