import { describe, expect, it } from 'vitest';
import { pageRange } from './chartPage.ts';

const DATES = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'];

describe('pageRange', () => {
  it('before가 없으면 최근 size개, 더 이른 날이 있으면 hasMore', () => {
    expect(pageRange(DATES, undefined, 2)).toEqual({ start: 3, end: 5, hasMore: true });
    expect(pageRange(DATES, undefined, 5)).toEqual({ start: 0, end: 5, hasMore: false });
  });

  it('before보다 이른 날만 준다', () => {
    expect(pageRange(DATES, '2026-10-22', 2)).toEqual({ start: 1, end: 3, hasMore: true });
    expect(pageRange(DATES, '2026-10-20', 2)).toEqual({ start: 0, end: 1, hasMore: false });
    expect(pageRange(DATES, '2026-10-19', 2)).toEqual({ start: 0, end: 0, hasMore: false });
  });

  it('before가 마지막 날보다 늦으면 처음 조회와 같다', () => {
    expect(pageRange(DATES, '2026-12-01', 2)).toEqual({ start: 3, end: 5, hasMore: true });
  });
});
