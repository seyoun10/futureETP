import type { CommodityCode } from '@futureetp/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getCurve } from '@/api/commodities';
import { queryKeys } from '@/api/queryKeys';

// 기준일을 옮기는 동안 이전 커브를 계속 보여 준다(버튼을 연달아 눌러도 화면이 비지 않게)
export const useCurve = (code: CommodityCode, baseDate: string | null) =>
  useQuery({
    queryKey: queryKeys.commodities.curve(code, baseDate),
    queryFn: ({ signal }) => getCurve(code, baseDate, signal),
    placeholderData: keepPreviousData,
  });
