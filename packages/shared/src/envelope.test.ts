import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { envelopeSchema } from './envelope.ts';

const schema = envelopeSchema(z.object({ price: z.number() }));

describe('envelopeSchema', () => {
  it('성공 응답의 data를 검증한다', () => {
    expect(schema.parse({ success: true, data: { price: 1.5 } })).toEqual({
      success: true,
      data: { price: 1.5 },
    });
    expect(schema.safeParse({ success: true, data: { price: '1.5' } }).success).toBe(false);
  });

  it('실패 응답은 error의 code·message를 요구한다', () => {
    expect(
      schema.safeParse({ success: false, error: { code: 'NOT_FOUND', message: 'x' } }).success,
    ).toBe(true);
    expect(schema.safeParse({ success: false, error: { code: 'NOT_FOUND' } }).success).toBe(false);
  });

  it('success가 없으면 거부한다', () => {
    expect(schema.safeParse({ data: { price: 1 } }).success).toBe(false);
  });
});
