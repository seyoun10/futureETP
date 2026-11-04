import { COMMODITY_CODES, type CommodityCode } from '@futureetp/shared';
import { z } from 'zod';
import { ApiException } from './errors.ts';

const commodityCodeSchema = z.enum(COMMODITY_CODES);

// 경로의 :code. 모르는 원자재면 404다
export function commodityCodeParam(raw: string | undefined): CommodityCode {
  const code = commodityCodeSchema.safeParse(raw);
  if (!code.success) throw new ApiException('NOT_FOUND', `Unknown commodity ${raw}`);
  return code.data;
}
