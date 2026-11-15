import { describe, expect, it } from 'vitest';
import { SWEEP_AT, createAuthFailureLimiter } from './auth.ts';

describe('createAuthFailureLimiter', () => {
  it('다시 오지 않는 IP의 지난 항목은 커지면 지워 메모리가 계속 늘지 않는다', () => {
    let t = 0;
    const limiter = createAuthFailureLimiter({ maxFailures: 3, windowMs: 1000 }, () => t);
    for (let i = 0; i < SWEEP_AT; i++) limiter.recordFailure(`198.51.100.${i}`);
    expect(limiter.size()).toBe(SWEEP_AT);

    t = 1000;
    limiter.recordFailure('203.0.113.1');
    expect(limiter.size()).toBe(1);
  });

  it('창이 남은 항목은 지우지 않는다', () => {
    let t = 0;
    const limiter = createAuthFailureLimiter({ maxFailures: 1, windowMs: 1000 }, () => t);
    limiter.recordFailure('203.0.113.1');
    t = 500;
    for (let i = 0; i < SWEEP_AT; i++) limiter.recordFailure(`198.51.100.${i}`);
    expect(limiter.isBlocked('203.0.113.1')).toBe(true);
  });
});
