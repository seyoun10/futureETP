import { describe, expect, it } from 'vitest';
import { healthSchema } from './health.ts';

describe('healthSchema', () => {
  it('status가 ok일 때만 통과한다', () => {
    expect(healthSchema.parse({ status: 'ok' })).toEqual({ status: 'ok' });
    expect(healthSchema.safeParse({ status: 'down' }).success).toBe(false);
  });
});
