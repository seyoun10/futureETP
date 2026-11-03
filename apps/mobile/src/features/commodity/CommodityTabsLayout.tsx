import { useFocusEffect } from 'expo-router';
import { BottomTabBar, Tabs } from 'expo-router/js-tabs';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TabFreshnessFooter } from '@/components/FreshnessLine';
import { lockPortrait, useIsLandscape } from '@/lib/orientation';
import { colors, fontSize, spacing } from '@/theme/tokens';
import { tapHaptic } from '@/lib/haptics';
import { CommodityTitleBar } from './CommodityTitleBar';

// C 원자재 화면의 하단 탭 4개(D-047). 순서는 이격도차트 / 월물차트 / 월물커브 / ETP(D-111). 스와이프로 탭을 바꾸지 않는다(차트 제스처와 충돌).
// tab-bar 아래에 지금 탭의 기준 시각 줄을 두고, 홈 인디케이터 여백은 tab-bar 대신 그 줄 아래에 둔다.
// 가로 모드에서는 title-bar와 차트만 남기고 tab-bar·기준 시각 줄을 숨긴다(홈 인디케이터 여백만 둔다, D-103).
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
      // 다른 탭으로 바뀔 때만 햅틱(D-109)
      screenListeners={({ navigation }: { navigation: { isFocused: () => boolean } }) => ({
        tabPress: () => {
          if (!navigation.isFocused()) tapHaptic();
        },
      })}
      tabBar={(props) =>
        isLandscape ? (
          <View style={{ height: props.insets.bottom, backgroundColor: colors.background }} />
        ) : (
          <View>
            <BottomTabBar {...props} insets={{ ...props.insets, bottom: 0 }} />
            <TabFreshnessFooter />
          </View>
        )
      }
      screenOptions={{
        header: () => <CommodityTitleBar />,
        sceneStyle: { backgroundColor: colors.background },
        tabBarStyle: styles.tabBar,
        // 선택 표시는 기간 칩(PeriodChips)과 같다: 둥근 surfaceSelected 배경 + 흰 굵은 글자
        tabBarItemStyle: styles.tabItem,
        tabBarActiveBackgroundColor: colors.surfaceSelected,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarIcon: () => null,
        tabBarIconStyle: { display: 'none' },
        // 아이콘 아래 라벨 배치는 탭 안쪽이 위쪽 정렬이라 아이콘 없이 라벨이 위로 붙는다.
        // 옆 배치(가운데 정렬)로 두어 라벨을 탭 한가운데에 둔다
        tabBarLabelPosition: 'beside-icon',
        tabBarLabel: ({ focused, color, children }) => (
          <Text style={[styles.label, { color }, focused && styles.labelFocused]}>{children}</Text>
        ),
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('commodity.tabs.disparity') }} />
      <Tabs.Screen name="contracts" options={{ title: t('commodity.tabs.contracts') }} />
      <Tabs.Screen name="curve" options={{ title: t('commodity.tabs.curve') }} />
      <Tabs.Screen
        name="etps"
        options={{ title: t('commodity.tabs.etps') }}
        listeners={{ focus: () => void lockPortrait() }}
      />
    </Tabs>
  );
}

// 기간 칩 높이·모서리와 같다
const TAB_ITEM_HEIGHT = 44;

const styles = StyleSheet.create({
  tabBar: {
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.barSeparator,
  },
  tabItem: {
    alignSelf: 'center',
    height: TAB_ITEM_HEIGHT,
    borderRadius: 6,
    // 안쪽 버튼의 선택 배경을 둥근 모서리로 자른다
    overflow: 'hidden',
  },
  label: {
    fontSize: fontSize.body,
  },
  labelFocused: {
    fontWeight: '600',
  },
});
