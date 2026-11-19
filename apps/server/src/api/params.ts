import { COMMODITY_CODES, type CommodityCode } from '@futureetp/shared';
import type { Context } from 'hono';
import { z } from 'zod';
import { ApiException } from './errors.ts';

const commodityCodeSchema = z.enum(COMMODITY_CODES);

// 경로의 :code. 모르는 원자재면 404다
export function commodityCodeParam(raw: string | undefined): CommodityCode {
  const code = commodityCodeSchema.safeParse(raw);
  if (!code.success) throw new ApiException('NOT_FOUND', `Unknown commodity ${raw}`);
  return code.data;
}

const etpIdSchema = z.uuid();

// 경로의 ETP :id. uuid가 아니면 없는 상품과 같이 404다
export function etpIdParam(raw: string | undefined): string {
  const id = etpIdSchema.safeParse(raw);
  if (!id.success) throw new ApiException('NOT_FOUND', `Unknown ETP ${raw}`);
  return id.data;
}

// query·body 검증. 실패하면 400 VALIDATION_FAILED에 zod 오류 문구를 담는다
export function parseInput<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiException('VALIDATION_FAILED', z.prettifyError(parsed.error));
  return parsed.data;
}

// 요청 body를 JSON으로 읽는다. JSON이 아니면 400이다
export async function jsonBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new ApiException('VALIDATION_FAILED', 'Body must be JSON');
  }
}
