import type { Freshness } from '@futureetp/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { formatLocalDateTime, formatTradeDate } from '@/lib/formatDateTime';
import { useFooterFreshness } from '@/stores/footerFreshness';
import { colors, fontSize, spacing } from '@/theme/tokens';

type Props = {
  freshness: Freshness;
};

// A·C 화면 최하단 기준 시각 줄: `10/22 09:00 기준 · 거래일 10/22 · 지연 · 장중`(screens.md 공통 규칙).
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

// 줄 높이를 최소로 둔다(글자 높이 + 위아래 1pt)
const LINE_HEIGHT = fontSize.caption + 2;
const LINE_BLOCK = LINE_HEIGHT + 2;

// 화면 최하단 기준 시각 줄. 높이를 아끼려고 홈 인디케이터 여백 위쪽에 겹쳐 둔다(여백 34pt면 줄 아래 18pt,
// 인디케이터는 맨 아래 약 13pt 안). freshness가 없으면 여백만 남는다
export function FreshnessFooter({ freshness }: { freshness: Freshness | null }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom - LINE_BLOCK, 0) }]}>
      {freshness && <FreshnessLine freshness={freshness} />}
    </View>
  );
}

// C 탭 레이아웃의 tab-bar 아래 줄(TabFreshnessFooter)에 이 화면의 freshness를 보인다. 화면을 떠나면 비운다
export function useTabFreshness(freshness: Freshness | undefined) {
  const setFreshness = useFooterFreshness((s) => s.setFreshness);
  useFocusEffect(
    useCallback(() => {
      setFreshness(freshness ?? null);
      return () => setFreshness(null);
    }, [freshness, setFreshness]),
  );
}

export function TabFreshnessFooter() {
  const freshness = useFooterFreshness((s) => s.freshness);
  return <FreshnessFooter freshness={freshness} />;
}

const styles = StyleSheet.create({
  footer: {
    backgroundColor: colors.background,
  },
  text: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 1,
    lineHeight: LINE_HEIGHT,
    color: colors.textSecondary,
    fontSize: fontSize.caption,
    textAlign: 'center',
  },
});
