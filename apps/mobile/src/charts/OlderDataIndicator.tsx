import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing } from '@/theme/tokens';

// 이전 3년을 받아 차트에 붙일 때까지 차트 왼쪽 가운데에 띄우는 로딩 표시(D-104). 차트 터치는 막지 않는다
export function OlderDataIndicator({ visible }: { visible: boolean }) {
  const { t } = useTranslation();
  if (!visible) return null;
  return (
    <View style={styles.container} pointerEvents="none">
      <View
        style={styles.badge}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t('common.loading')}
      >
        <ActivityIndicator color={colors.text} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: spacing.lg,
  },
  badge: {
    padding: spacing.sm,
    borderRadius: spacing.lg,
    backgroundColor: colors.overlay,
  },
});
