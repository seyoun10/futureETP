// 속성 기반 테스트(D-129): 알림 거부 시간(D-026, 시작 포함·종료 제외, 자정 넘김)의 경계 일관성.
// 시작과 종료가 같은 구간은 설정 스키마(shared settings)가 막으므로 대상이 아니다.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { isQuietTime } from './alert.ts';

const minute = fc.integer({ min: 0, max: 1439 });
// UTC 하루 안의 임의 시각(초·밀리초 포함)
const instant = fc
  .record({ m: minute, ms: fc.integer({ min: 0, max: 59_999 }) })
  .map(({ m, ms }) => ({ m, now: new Date(Date.UTC(2026, 10, 16) + m * 60_000 + ms) }));

describe('isQuietTime 속성', () => {
  it('[시작, 종료)와 [종료, 시작)은 하루를 겹침 없이 나눈다', () => {
    fc.assert(
      fc.property(instant, minute, minute, ({ now }, start, end) => {
        fc.pre(start !== end);
        expect(isQuietTime(now, 'UTC', start, end)).toBe(!isQuietTime(now, 'UTC', end, start));
      }),
    );
  });

  it('시작 분은 거부 시간이고 종료 분은 아니다', () => {
    fc.assert(
      fc.property(minute, minute, (start, end) => {
        fc.pre(start !== end);
        const at = (m: number) => new Date(Date.UTC(2026, 10, 16) + m * 60_000);
        expect(isQuietTime(at(start), 'UTC', start, end)).toBe(true);
        expect(isQuietTime(at(end), 'UTC', start, end)).toBe(false);
      }),
    );
  });

  it('끄기(null)면 언제나 false다', () => {
    fc.assert(
      fc.property(instant, fc.option(minute, { nil: null }), ({ now }, start) => {
        expect(isQuietTime(now, 'UTC', start, null)).toBe(false);
        expect(isQuietTime(now, 'UTC', null, start)).toBe(false);
      }),
    );
  });
});
