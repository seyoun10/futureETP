import type { EtpDetail, EtpSeries } from '@futureetp/shared';
import { useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { QueryStateView } from '@/components/QueryStateView';
import { ScreenHeader } from '@/components/ScreenHeader';
import { formatLocalDateTime } from '@/lib/formatDateTime';
import { colors, fontSize, spacing } from '@/theme/tokens';
import { useEtp } from './useEtp';

// 수집한 주소라도 웹 페이지만 연다
const isWebUrl = (url: string) => /^https?:\/\//i.test(url);

// C-d-a ETP 상세(탭 밖 스택, D-047). 값은 자동 수집 정보라 원문 언어 그대로 보여 준다.
export function EtpDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useEtp(id);

  return (
    <View style={styles.container} testID="etp-detail-screen">
      <ScreenHeader title={query.data?.name ?? t('etp.detailTitle')} />
      <QueryStateView query={query}>{(etp) => <EtpFields etp={etp} />}</QueryStateView>
    </View>
  );
}

function EtpFields({ etp }: { etp: EtpDetail }) {
  const { t } = useTranslation();
  const orDash = (value: string | null) => value ?? t('etp.noValue');
  const issuerUrl = etp.issuerUrl !== null && isWebUrl(etp.issuerUrl) ? etp.issuerUrl : null;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Field label={t('etp.commodity')} value={t(`commodities.${etp.commodityCode}`)} />
      <Field label={t('etp.market')} value={etp.market} />
      <Field label={t('etp.type')} value={etp.type} />
      <Field label={t('etp.leverage')} value={t('etp.leverageValue', { n: etp.leverage })} />
      <Field label={t('etp.fxHedge')} value={t(`etp.fxHedges.${etp.fxHedge}`)} />
      <Field label={t('etp.issuer')} value={orDash(etp.issuer)} />
      <Field label={t('etp.underlyingIndex')} value={orDash(etp.underlyingIndex)} />
      <Field
        label={t('etp.expenseRatio')}
        value={
          etp.expenseRatio === null
            ? t('etp.noValue')
            : t('etp.expenseRatioValue', { n: etp.expenseRatio })
        }
      />
      <Field label={t('etp.listedDate')} value={orDash(etp.listedDate)} />
      <Field
        label={t('etp.ticker')}
        value={
          etp.series.length === 0
            ? t('etp.noValue')
            : etp.series.map((s) => seriesLine(s, t)).join('\n')
        }
      />
      {issuerUrl && (
        <Pressable
          accessibilityRole="link"
          onPress={() => void Linking.openURL(issuerUrl)}
          style={styles.link}
        >
          <Text style={styles.linkText}>{t('etp.openIssuer')}</Text>
        </Pressable>
      )}
      <Text style={styles.note}>{t('etp.sourceNote')}</Text>
      <Text style={styles.note}>
        {t('freshness.asOf', { time: formatLocalDateTime(etp.collectedAt) })}
      </Text>
    </ScrollView>
  );
}

type T = ReturnType<typeof useTranslation>['t'];

// ETN 후속 시리즈는 줄마다 `B 시리즈 · 530031 · 만기 2031-03-15`(screens.md C-d-a). ETF는 종목코드만
function seriesLine(s: EtpSeries, t: T) {
  return [
    ...(s.seriesCode === null ? [] : [t('etp.seriesCode', { code: s.seriesCode })]),
    s.ticker,
    ...(s.maturityDate === null ? [] : [t('etp.maturity', { date: s.maturityDate })]),
  ].join(' · ');
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  field: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  label: {
    width: 88,
    color: colors.textSecondary,
    fontSize: fontSize.body,
  },
  value: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.body,
  },
  link: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: spacing.sm,
    backgroundColor: colors.surface,
  },
  linkText: {
    color: colors.text,
    fontSize: fontSize.body,
  },
  note: {
    color: colors.textSecondary,
    fontSize: fontSize.caption,
  },
});
