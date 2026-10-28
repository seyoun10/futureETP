import { COMMODITY_CODES, type CommodityCode } from '@futureetp/shared';
import { useGlobalSearchParams } from 'expo-router';

export const toCommodityCode = (value: unknown): CommodityCode | null =>
  COMMODITY_CODES.find((code) => code === value) ?? null;

// `commodity/[code]` 경로의 원자재 코드. 모르는 코드면 null이고, 없는 원자재 표시는 조회 API의 NOT_FOUND가 맡는다.
// 전역 파라미터를 읽는다. 하단 탭을 누르면 탭 화면의 로컬 파라미터에 code가 없다(처음 연 탭만 있음).
// C 화면은 모두 `commodity/[code]` 아래라 전역 code가 곧 보고 있는 원자재다.
export const useCommodityCode = (): CommodityCode | null => {
  const { code } = useGlobalSearchParams<{ code: string }>();
  return toCommodityCode(code);
};
