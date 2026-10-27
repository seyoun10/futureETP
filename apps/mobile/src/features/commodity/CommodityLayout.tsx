import { Stack } from 'expo-router';
import { colors } from '@/theme/tokens';

// C 원자재 화면 스택: 탭 그룹 위에 탭 밖 화면(C-d-a ETP 상세)을 쌓는다(D-047).
export function CommodityLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
