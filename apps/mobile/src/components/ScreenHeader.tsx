import type { ReactNode } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, fontSize, spacing } from '@/theme/tokens';
import { HeaderIconButton } from './HeaderIconButton';

type Props = {
  title: string;
  // 첫 실행 B-b처럼 돌아갈 곳이 없는 화면은 끈다
  showBack?: boolean;
  right?: ReactNode;
};

// 스택 화면 상단 줄: [←] 제목 (오른쪽 버튼)
export function ScreenHeader({ title, showBack = true, right }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {showBack ? (
        <HeaderIconButton glyph="←" label={t('common.back')} onPress={() => router.back()} />
      ) : (
        <View style={styles.side} />
      )}
      <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
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
  title: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.title,
    fontWeight: '600',
  },
  right: {
    flexDirection: 'row',
  },
});
