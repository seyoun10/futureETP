import type { Href } from 'expo-router';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, fontSize, spacing } from '@/theme/tokens';

// B 설정. 표시·이격도차트 설정 항목은 5-6에서 채우고, 지금은 하위 화면으로 가는 행만 둔다.
export function SettingsScreen() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('settings.title')} />
      <LinkRow label={t('settings.alerts')} href="/settings/alerts" />
      <LinkRow label={t('settings.accessKey')} href="/settings/access-key" />
      <LinkRow label={t('settings.dataSources')} href="/settings/data-sources" />
    </View>
  );
}

function LinkRow({ label, href }: { label: string; href: Href }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(href)} style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  label: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.body,
  },
  chevron: {
    color: colors.textSecondary,
    fontSize: fontSize.title,
  },
});
