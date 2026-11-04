import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { DEFAULT_PERIOD } from '@/charts/chartPeriods';
import type { ChartPeriod } from '@/charts/chartPeriods';

export type ChartKind = 'disparity' | 'contract';
type PeriodState = [ChartPeriod, (period: ChartPeriod) => void];

const ChartPeriodContext = createContext<Record<ChartKind, PeriodState> | null>(null);

// C-a·C-c 기간 선택(D-107). 원자재 스택(탭·ETP 상세)이 떠 있는 동안만 기억하고, 목록으로 나가면 6M으로 돌아간다.
// 탭을 오가도 유지한다. C-a와 C-c는 따로 고른다
export function ChartPeriodProvider({ children }: { children: ReactNode }) {
  const [disparity, setDisparity] = useState<ChartPeriod>(DEFAULT_PERIOD);
  const [contract, setContract] = useState<ChartPeriod>(DEFAULT_PERIOD);
  const value = useMemo(
    () => ({
      disparity: [disparity, setDisparity] as PeriodState,
      contract: [contract, setContract] as PeriodState,
    }),
    [disparity, contract],
  );
  return <ChartPeriodContext value={value}>{children}</ChartPeriodContext>;
}

export function useChartPeriod(chart: ChartKind): PeriodState {
  const periods = useContext(ChartPeriodContext);
  if (!periods) throw new Error('useChartPeriod needs ChartPeriodProvider');
  return periods[chart];
}
