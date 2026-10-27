import { COMMODITY_CODES, type CommodityCode } from '@futureetp/shared';
import { useLocalSearchParams } from 'expo-router';

export const toCommodityCode = (value: unknown): CommodityCode | null =>
  COMMODITY_CODES.find((code) => code === value) ?? null;

// `commodity/[code]` 경로의 원자재 코드. 모르는 코드면 null이고, 없는 원자재 표시는 조회 API의 NOT_FOUND가 맡는다.
export const useCommodityCode = (): CommodityCode | null => {
  const { code } = useLocalSearchParams<{ code: string }>();
  return toCommodityCode(code);
};
