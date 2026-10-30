import { BASES, MA_PERIODS, WINDOWS } from '@futureetp/shared';
import type { Settings, SettingsPatch } from '@futureetp/shared';
import type { Href } from 'expo-router';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useHasAccessKey } from '@/api/accessToken';
import { AppError } from '@/api/AppError';
import { ErrorView } from '@/components/QueryStateView';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { LANGUAGES, UP_DOWN_STYLES, useDisplaySettings } from '@/stores/displaySettings';
import { Icon } from '@/components/Icon';
import { colors, fontSize, spacing } from '@/theme/tokens';
import { RareLevelsInput } from './RareLevelsInput';
import { SectionHeader } from './SectionHeader';
import { useSettings, useUpdateSettings } from './useSettings';

// B 설정(screens.md B). 표시 설정은 기기에, 이격도차트·알림 설정은 서버에 한 벌 저장한다(D-011, D-047).
export function SettingsScreen() {
  const { t } = useTranslation();
  const hasKey = useHasAccessKey();
  const settings = useSettings();
  const update = useUpdateSettings();
  const save = (patch: SettingsPatch) => update.mutate(patch);

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('settings.title')} />
      {/* rare-level 키패드는 화면을 끌면 닫힌다. 키패드가 열린 채 다른 행을 눌러도 그 행이 눌린다 */}
      <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
        {update.isError && (
          <Text accessibilityRole="alert" style={styles.error}>
            {t('settings.saveFailed', { reason: errorText(t, update.error) })}
          </Text>
        )}
        <DisplaySection onLanguageChange={(locale) => save({ locale })} />
        <SectionHeader title={t('settings.sectionDisparity')} />
        {settings.isError && settings.data === undefined ? (
          <ErrorView error={settings.error} onRetry={() => void settings.refetch()} />
        ) : (
          <DisparitySection settings={settings.data} onChange={save} />
        )}
        <View style={styles.divider} />
        <LinkRow
          label={t('settings.accessKey')}
          value={hasKey ? t('accessKey.saved') : undefined}
          href="/settings/access-key"
          description={t('settings.accessKeyDesc')}
        />
        <LinkRow
          label={t('settings.dataSources')}
          href="/settings/data-sources"
          description={t('settings.dataSourcesDesc')}
        />
      </ScrollView>
    </View>
  );
}

export const errorText = (t: ReturnType<typeof useTranslation>['t'], error: unknown) =>
  t(`errors.${error instanceof AppError ? error.code : 'INTERNAL'}`);

// 언어·등락 색은 기기 설정이다. 언어는 푸시 문구에 쓰므로 서버에도 보낸다(마지막으로 바꾼 기기의 값).
function DisplaySection({
  onLanguageChange,
}: {
  onLanguageChange: (locale: Settings['locale']) => void;
}) {
  const { t } = useTranslation();
  const { language, upDownStyle, setLanguage, setUpDownStyle } = useDisplaySettings();
  const languageLabels = { ko: t('settings.languageKo'), en: t('settings.languageEn') };

  return (
    <>
      <SectionHeader title={t('settings.sectionDisplay')} />
      <SegmentedControl
        label={t('settings.language')}
        options={LANGUAGES.map((value) => ({ value, label: languageLabels[value] }))}
        value={language}
        description={t('settings.languageDesc')}
        onChange={(value) => {
          setLanguage(value);
          onLanguageChange(value);
        }}
      />
      <SegmentedControl
        label={t('settings.upDownStyle')}
        options={UP_DOWN_STYLES.map((value) => ({
          value,
          label: t(`settings.upDownStyle${value}`),
        }))}
        value={upDownStyle}
        description={t('settings.upDownStyleDesc')}
        onChange={setUpDownStyle}
      />
    </>
  );
}

// 조회 중에는 아무것도 고르지 않은 채로 보여 준다. 알림 행은 B-a로 간다.
function DisparitySection({
  settings,
  onChange,
}: {
  settings: Settings | undefined;
  onChange: (patch: SettingsPatch) => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <SegmentedControl
        label={t('settings.basis')}
        options={BASES.map((value) => ({ value, label: t(`settings.basis${value}`) }))}
        value={settings?.basis}
        description={t('settings.basisDesc')}
        onChange={(basis) => onChange({ basis })}
      />
      <SegmentedControl
        label={t('settings.maPeriod')}
        options={MA_PERIODS.map((value) => ({ value, label: String(value) }))}
        value={settings?.maPeriod}
        description={t('settings.maPeriodDesc')}
        onChange={(maPeriod) => onChange({ maPeriod })}
      />
      <SegmentedControl
        label={t('settings.window')}
        options={WINDOWS.map((value) => ({
          value,
          label: value === 'ALL' ? t('settings.windowALL') : value.slice(1),
        }))}
        value={settings?.window}
        description={t('settings.windowDesc')}
        onChange={(window) => onChange({ window })}
      />
      <RareLevelsInput
        levels={settings?.rareLevels}
        onSave={(rareLevels) => onChange({ rareLevels })}
        description={t('settings.rareLevelsDesc')}
      />
      <LinkRow
        label={t('settings.alerts')}
        value={
          settings &&
          (settings.alertCommodity
            ? t(`commodities.${settings.alertCommodity}`)
            : t('settings.alertOff'))
        }
        href="/settings/alerts"
        description={t('settings.alertsDesc')}
      />
    </>
  );
}

type LinkRowProps = { label: string; value?: string; href: Href; description?: string };

// 이름 + 값 + › 행. 설명은 이름·값 아래 한 줄이다
function LinkRow({ label, value, href, description }: LinkRowProps) {
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(href)} style={styles.row}>
      <View style={styles.rowMain}>
        <View style={styles.rowLine}>
          <Text style={styles.label}>{label}</Text>
          {value && <Text style={styles.value}>{value}</Text>}
        </View>
        {description && <Text style={styles.description}>{description}</Text>}
      </View>
      <Icon name="chevron-right" color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  error: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: fontSize.caption,
    backgroundColor: colors.surface,
  },
  divider: {
    height: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  rowMain: {
    flex: 1,
  },
  rowLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.body,
  },
  description: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    fontSize: fontSize.caption,
  },
  value: {
    marginRight: spacing.sm,
    color: colors.textSecondary,
    fontSize: fontSize.body,
  },
});
