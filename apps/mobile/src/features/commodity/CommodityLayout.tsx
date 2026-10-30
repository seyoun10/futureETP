import { Stack } from 'expo-router';
import { colors } from '@/theme/tokens';
import { ChartPeriodProvider } from './ChartPeriodProvider';

// C 원자재 화면 스택: 탭 그룹 위에 탭 밖 화면(C-d-a ETP 상세)을 쌓는다(D-047).
// 차트 기간 선택은 이 스택이 떠 있는 동안만 기억한다(D-107)
export function CommodityLayout() {
  return (
    <ChartPeriodProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          // 루트 스택과 같은 전환(src/app/_layout.tsx)
          animation: 'simple_push',
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </ChartPeriodProvider>
  );
}
