import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '@/components/ScreenHeader';
import { usePushPermission } from '@/push/usePushPermission';
import { colors, fontSize, spacing } from '@/theme/tokens';

// B-a 알림 설정(screens.md B-a). 대상·적용 기준·거부 시간은 5-8에서 이어서 채운다.
export function AlertSettingsScreen() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('alertSettings.title')} />
      <ScrollView>
        <PermissionBanner />
        <Text style={styles.guide}>{t('alertSettings.guide')}</Text>
      </ScrollView>
    </View>
  );
}

// 권한이 꺼져 있을 때만 보인다. 확인 전(null)에는 숨긴다.
function PermissionBanner() {
  const { t } = useTranslation();
  const { permission, request } = usePushPermission();
  if (permission === null || permission.granted) return null;

  return (
    <View accessibilityRole="alert" style={styles.banner}>
      <Text style={styles.bannerText}>{t('alertSettings.permissionOff')}</Text>
      <Pressable accessibilityRole="button" onPress={() => void request()} style={styles.button}>
        <Text style={styles.buttonText}>
          {permission.canAskAgain ? t('alertSettings.allow') : t('alertSettings.openSettings')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  bannerText: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.body,
  },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 4,
    backgroundColor: colors.surfaceSelected,
  },
  buttonText: {
    color: colors.text,
    fontSize: fontSize.body,
  },
  guide: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    color: colors.textSecondary,
    fontSize: fontSize.caption,
  },
});
