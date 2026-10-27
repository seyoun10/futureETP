import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';
import { colors, fontSize } from '@/theme/tokens';
import { CommodityTitleBar } from './CommodityTitleBar';

// C 원자재 화면의 하단 탭 4개(D-047). 스와이프로 탭을 바꾸지 않는다(차트 제스처와 충돌).
export function CommodityTabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      backBehavior="none"
      screenOptions={{
        header: () => <CommodityTitleBar />,
        sceneStyle: { backgroundColor: colors.background },
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarIcon: () => null,
        tabBarIconStyle: { display: 'none' },
        tabBarLabelStyle: { fontSize: fontSize.body },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('commodity.tabs.disparity') }} />
      <Tabs.Screen name="curve" options={{ title: t('commodity.tabs.curve') }} />
      <Tabs.Screen name="contracts" options={{ title: t('commodity.tabs.contracts') }} />
      <Tabs.Screen name="etps" options={{ title: t('commodity.tabs.etps') }} />
    </Tabs>
  );
}
