import type { Freshness } from '@futureetp/shared';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatLocalDateTime, formatTradeDate } from '@/lib/formatDateTime';
import { colors, fontSize, spacing } from '@/theme/tokens';

type Props = {
  freshness: Freshness;
};

// A·C 상단 기준 시각 줄: `10/22 09:00 기준 · 거래일 10/22 · 지연 · 장중`(screens.md 공통 규칙).
// 새로고침이 실패해도 마지막 데이터의 기준 시각을 그대로 보여 줘 오래됨을 알린다(architecture.md).
export function FreshnessLine({ freshness }: Props) {
  const { t } = useTranslation();
  const items = [
    t('freshness.asOf', { time: formatLocalDateTime(freshness.asOf) }),
    t('freshness.tradeDate', { date: formatTradeDate(freshness.tradeDate) }),
    ...(freshness.delayed ? [t('freshness.delayed')] : []),
    t(`freshness.marketState.${freshness.marketState}`),
  ];

  return (
    <Text style={styles.text} numberOfLines={1}>
      {items.join(' · ')}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    color: colors.textSecondary,
    fontSize: fontSize.caption,
    textAlign: 'center',
  },
});
