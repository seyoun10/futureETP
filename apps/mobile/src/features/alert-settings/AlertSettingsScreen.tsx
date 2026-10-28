import { COMMODITY_CODES } from '@futureetp/shared';
import type { Settings } from '@futureetp/shared';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ErrorView } from '@/components/QueryStateView';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { SectionHeader } from '@/features/settings/SectionHeader';
import { errorText } from '@/features/settings/SettingsScreen';
import { useSettings, useUpdateSettings } from '@/features/settings/useSettings';
import { usePushPermission } from '@/push/usePushPermission';
import { colors, fontSize, spacing } from '@/theme/tokens';
import { QuietTimeSection } from './QuietTimeSection';

// 선택지 '없음'은 alertCommodity null(알림 끔)이다
const NONE = 'NONE';
const COMMODITY_OPTIONS = [NONE, ...COMMODITY_CODES] as const;

// B-a 알림 설정(screens.md B-a). 바꾼 값은 바로 서버에 저장한다.
// 적용 기준은 B 이격도차트 설정을 그대로 쓰므로 여기서는 요약만 보여 준다.
export function AlertSettingsScreen() {
  const { t } = useTranslation();
  const settings = useSettings();
  const update = useUpdateSettings();

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('alertSettings.title')} />
      <ScrollView>
        <PermissionBanner />
        {update.isError && (
          <Text accessibilityRole="alert" style={styles.error}>
            {t('settings.saveFailed', { reason: errorText(t, update.error) })}
          </Text>
        )}
        {settings.isError && settings.data === undefined ? (
          <ErrorView error={settings.error} onRetry={() => void settings.refetch()} />
        ) : (
          <>
            <SegmentedControl
              stacked
              label={t('alertSettings.commodity')}
              options={COMMODITY_OPTIONS.map((value) => ({
                value,
                label:
                  value === NONE ? t('alertSettings.commodityNone') : t(`commodities.${value}`),
              }))}
              value={settings.data && (settings.data.alertCommodity ?? NONE)}
              onChange={(value) => update.mutate({ alertCommodity: value === NONE ? null : value })}
            />
            {settings.data && (
              <>
                <CriteriaSummary settings={settings.data} />
                <QuietTimeSection
                  value={settings.data.quietTime}
                  onChange={(quietTime) => update.mutate({ quietTime })}
                />
              </>
            )}
          </>
        )}
        <Text style={styles.guide}>{t('alertSettings.guide')}</Text>
      </ScrollView>
    </View>
  );
}

function CriteriaSummary({ settings }: { settings: Settings }) {
  const { t } = useTranslation();
  const window =
    settings.window === 'ALL'
      ? t('settings.windowALL')
      : t('alertSettings.criteriaWindowYears', { years: settings.window.slice(1) });

  return (
    <>
      <SectionHeader title={t('alertSettings.criteria')} />
      <Text style={styles.criteria}>
        {t('alertSettings.criteriaChart', {
          basis: t(`settings.basis${settings.basis}`),
          maPeriod: settings.maPeriod,
          window,
        })}
      </Text>
      <Text style={styles.criteria}>
        {t('alertSettings.criteriaLevels', { levels: settings.rareLevels.join('/') })}
      </Text>
    </>
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
  error: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: fontSize.caption,
    backgroundColor: colors.surface,
  },
  criteria: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
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
