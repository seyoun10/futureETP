import { describe, expect, it } from 'vitest';
import { contractsQuerySchema, curveQuerySchema, disparityQuerySchema } from './queries.ts';

const disparity = { basis: 'KR', ma: '200', window: 'Y10', levels: '20,1,5,2.5,10' };

describe('disparityQuerySchema', () => {
  it('문자열 query를 값으로 바꾸고 rare 레벨은 정렬한다', () => {
    expect(disparityQuerySchema.parse({ ...disparity, before: '2024-01-02' })).toEqual({
      basis: 'KR',
      ma: 200,
      window: 'Y10',
      levels: [1, 2.5, 5, 10, 20],
      before: '2024-01-02',
    });
  });

  it.each([
    ['허용되지 않는 이평선', { ma: '30' }],
    ['숫자 형식이 다른 이평선', { ma: '200.0' }],
    ['레벨 4개', { levels: '1,2,5,10' }],
    ['공백이 낀 레벨', { levels: ' 1, 2,4 ,8,16' }],
    ['16진수 레벨', { levels: '1,2,4,0x8,16' }],
    ['지수 표기 레벨', { levels: '1,2,4,8,1e1' }],
    ['빈 레벨', { levels: '1,2,,8,16' }],
    ['반올림하면 겹치는 레벨', { levels: '1,1.00000000001,2,4,8' }],
    ['날짜가 아닌 before', { before: '2024-1-2' }],
  ])('%s는 거절한다', (_, patch) => {
    expect(disparityQuerySchema.safeParse({ ...disparity, ...patch }).success).toBe(false);
  });
});

describe('차트 query', () => {
  it('before·baseDate는 생략할 수 있다', () => {
    expect(contractsQuerySchema.parse({})).toEqual({});
    expect(curveQuerySchema.parse({ baseDate: '2026-11-02' })).toEqual({ baseDate: '2026-11-02' });
  });
});
