import { useFocusEffect } from 'expo-router';
import { BottomTabBar, Tabs } from 'expo-router/js-tabs';
import { useCallback } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TabFreshnessFooter } from '@/components/FreshnessLine';
import { lockPortrait, useIsLandscape } from '@/lib/orientation';
import { colors, fontSize } from '@/theme/tokens';
import { CommodityTitleBar } from './CommodityTitleBar';

// 가로 모드 tab-bar 높이(문구 한 줄)
const COMPACT_TAB_BAR_HEIGHT = 32;

// C 원자재 화면의 하단 탭 4개(D-047). 스와이프로 탭을 바꾸지 않는다(차트 제스처와 충돌).
// tab-bar 아래에 지금 탭의 기준 시각 줄을 두고, 홈 인디케이터 여백은 tab-bar 대신 그 줄 아래에 둔다.
// ETP 탭으로 가거나 C를 떠나면(A·B·ETP 상세) 세로로 돌아간다(D-076).
export function CommodityTabsLayout() {
  const { t } = useTranslation();
  const isLandscape = useIsLandscape();

  useFocusEffect(
    useCallback(
      () => () => {
        void lockPortrait();
      },
      [],
    ),
  );

  return (
    <Tabs
      backBehavior="none"
      tabBar={(props) => (
        <View>
          <BottomTabBar {...props} insets={{ ...props.insets, bottom: 0 }} />
          <TabFreshnessFooter />
        </View>
      )}
      screenOptions={{
        header: () => <CommodityTitleBar />,
        sceneStyle: { backgroundColor: colors.background },
        tabBarStyle: [
          {
            backgroundColor: colors.background,
            borderTopWidth: 1,
            borderTopColor: colors.barSeparator,
          },
          isLandscape && { height: COMPACT_TAB_BAR_HEIGHT },
        ],
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
      <Tabs.Screen
        name="etps"
        options={{ title: t('commodity.tabs.etps') }}
        listeners={{ focus: () => void lockPortrait() }}
      />
    </Tabs>
  );
}
