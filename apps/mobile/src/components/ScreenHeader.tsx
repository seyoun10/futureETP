import type { ReactNode } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, fontSize, spacing } from '@/theme/tokens';
import { HeaderIconButton } from './HeaderIconButton';

type Props = {
  title: string;
  // 제목 바로 오른쪽에 붙이는 표시(C의 🔔). 제목이 길면 제목만 줄인다
  titleAccessory?: ReactNode;
  // 첫 실행 B-b처럼 돌아갈 곳이 없는 화면은 끈다
  showBack?: boolean;
  right?: ReactNode;
  // 기본은 router.back(). C처럼 이력과 상관없이 정해진 곳으로 가는 화면만 준다
  onBack?: () => void;
  // 가로 모드처럼 세로 공간이 좁을 때 버튼 높이·제목 글자를 줄인다
  compact?: boolean;
};

// 모든 화면의 상단 줄: [←] 제목 (오른쪽 버튼). 제목은 왼쪽 정렬로 통일한다
export function ScreenHeader({
  title,
  titleAccessory,
  showBack = true,
  right,
  onBack,
  compact = false,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {showBack ? (
        <HeaderIconButton
          icon="arrow-left"
          label={t('common.back')}
          compact={compact}
          onPress={onBack ?? (() => router.back())}
        />
      ) : (
        <View style={styles.side} />
      )}
      <View style={styles.titleRow}>
        <Text
          style={[styles.title, compact && styles.titleCompact]}
          numberOfLines={1}
          accessibilityRole="header"
        >
          {title}
        </Text>
        {titleAccessory}
      </View>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.barSeparator,
  },
  side: {
    width: spacing.sm,
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    flexShrink: 1,
    color: colors.text,
    fontSize: fontSize.title,
    fontWeight: '600',
  },
  titleCompact: {
    fontSize: fontSize.body,
  },
  right: {
    flexDirection: 'row',
  },
});
