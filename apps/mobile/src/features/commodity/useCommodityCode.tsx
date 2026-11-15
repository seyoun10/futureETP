import { COMMODITY_CODES, type CommodityCode } from '@futureetp/shared';
import { useLocalSearchParams } from 'expo-router';
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

export const toCommodityCode = (value: unknown): CommodityCode | null =>
  COMMODITY_CODES.find((code) => code === value) ?? null;

const CommodityCodeContext = createContext<CommodityCode | null>(null);

// `commodity/[code]` 스택 레이아웃의 경로 파라미터를 아래 화면에 넘긴다.
// 탭 화면의 로컬 파라미터에는 code가 없고(처음 연 탭만 있음), 전역 파라미터는 위에 B 같은 화면이 열리면
// 그 화면 기준이라 code가 사라진다. 레이아웃의 로컬 파라미터는 스택이 아래에 남아 있는 동안 그대로다
export function CommodityCodeProvider({ children }: { children: ReactNode }) {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <CommodityCodeContext value={toCommodityCode(code)}>{children}</CommodityCodeContext>;
}

// 보고 있는 원자재 코드. 모르는 코드면 null이고, 없는 원자재 표시는 조회 API의 NOT_FOUND가 맡는다
export const useCommodityCode = (): CommodityCode | null => useContext(CommodityCodeContext);
