import { describe, expect, it } from 'vitest';
import { freshnessSchema } from './freshness.ts';

const valid = {
  asOf: '2026-10-22T14:00:00.000Z',
  tradeDate: '2026-10-22',
  delayed: true,
  marketState: 'OPEN',
  nextUpdateAt: '2026-10-22T14:20:00.000Z',
};

describe('freshnessSchema', () => {
  it('UTC 시각·거래일·장 상태를 통과시키고 nextUpdateAt은 null을 허용한다', () => {
    expect(freshnessSchema.parse(valid)).toEqual(valid);
    expect(freshnessSchema.parse({ ...valid, nextUpdateAt: null }).nextUpdateAt).toBeNull();
  });

  it('모르는 장 상태, 오프셋 시각, 형식이 다른 거래일은 거부한다', () => {
    expect(freshnessSchema.safeParse({ ...valid, marketState: 'HALTED' }).success).toBe(false);
    expect(freshnessSchema.safeParse({ ...valid, asOf: '2026-10-22T09:00:00-05:00' }).success).toBe(
      false,
    );
    expect(freshnessSchema.safeParse({ ...valid, tradeDate: '10/22' }).success).toBe(false);
  });
});
