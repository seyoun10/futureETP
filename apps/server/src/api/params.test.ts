import type { Context } from 'hono';
import { describe, expect, it } from 'vitest';
import { ApiException } from './errors.ts';
import { etpIdParam, jsonBody } from './params.ts';

const ETP_ID = '1b2c3d4e-5f60-4718-8a9b-0c1d2e3f4a5b';

describe('etpIdParam', () => {
  it('uuid는 그대로 주고, uuid가 아니거나 없으면 404 NOT_FOUND다', () => {
    expect(etpIdParam(ETP_ID)).toBe(ETP_ID);
    for (const raw of ['abc', undefined]) {
      let error: unknown;
      try {
        etpIdParam(raw);
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(ApiException);
      expect(error).toMatchObject({ code: 'NOT_FOUND' });
    }
  });
});

describe('jsonBody', () => {
  const context = (json: () => Promise<unknown>) => ({ req: { json } }) as unknown as Context;

  it('JSON이면 읽은 값을 준다', async () => {
    await expect(jsonBody(context(() => Promise.resolve({ a: 1 })))).resolves.toEqual({ a: 1 });
  });

  it('JSON이 아니면 400 VALIDATION_FAILED를 던진다', async () => {
    await expect(
      jsonBody(context(() => Promise.reject(new SyntaxError('Unexpected token')))),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', message: 'Body must be JSON' });
  });
});
