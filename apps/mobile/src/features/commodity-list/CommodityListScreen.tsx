import type { CommoditySummary, ContractQuote } from '@futureetp/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAutoRefresh } from '@/api/useAutoRefresh';
import { AlertBell } from '@/components/AlertBell';
import { FreshnessFooter } from '@/components/FreshnessLine';
import { QueryStateView } from '@/components/QueryStateView';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  formatChange,
  formatChangePct,
  formatContractMonth,
  formatPrice,
} from '@/lib/formatNumber';
import { changePairColor, useUpDownPalette } from '@/theme/upDownColor';
import type { UpDownPalette } from '@/theme/upDownColor';
import { colors, fontSize, size, spacing } from '@/theme/tokens';
import { prefetchDisparityChart } from '@/features/commodity/disparity-chart/useDisparityChart';
import { refreshHaptic, tapHaptic } from '@/lib/haptics';
import { SettingsHeaderButton } from '@/features/settings/SettingsHeaderButton';
import { useCommodities } from './useCommodities';

// A 원자재 목록(screens.md A, D-085). 원자재와 월물 줄은 서버가 준 순서대로 그린다.
export function CommodityListScreen() {
  const query = useCommodities();
  const palette = useUpDownPalette();
  const { refreshing, failed, onRefresh } = usePullRefresh(query);
  useAutoRefresh(query);

  return (
    <View style={styles.container}>
      <ScreenHeader title="futureETP" showBack={false} right={<SettingsHeaderButton />} />
      <QueryStateView query={query}>
        {(data) => (
          <>
            {failed && <RefreshFailedLine onRetry={() => void onRefresh()} />}
            <FlatList
              testID="commodity-list"
              data={data.commodities}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => <CommodityRow commodity={item} palette={palette} />}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => void onRefresh()}
                  tintColor={colors.textSecondary}
                />
              }
            />
            <FreshnessFooter freshness={data.freshness} />
          </>
        )}
      </QueryStateView>
      {/* 새로고침 중에는 헤더까지 덮어 다른 터치를 막는다. 투명이라 목록 위 인디케이터는 보인다 */}
      {refreshing && (
        <View
          testID="refresh-touch-blocker"
          style={StyleSheet.absoluteFill}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      )}
    </View>
  );
}

// 당겨서 새로고침이 이 시간 안에 끝나지 않으면 인디케이터를 거두고 다시 시도 안내를 띄운다
const REFRESH_TIMEOUT_MS = 5000;

// 당겨서 새로고침 상태. 자동 새로고침·복귀 재조회는 인디케이터 없이 조용히 한다.
// 걸리는 순간 햅틱, 조회가 끝날 때까지 인디케이터 유지, 시간 초과·실패면 안내를 띄운다.
// 늦게 끝난 조회가 데이터를 바꾸면(자동 새로고침 포함) 안내를 거둔다.
function usePullRefresh(query: ReturnType<typeof useCommodities>) {
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  // 시간 초과로 거둔 회차의 늦은 응답이 상태를 다시 바꾸지 않게 회차를 센다
  const run = useRef(0);
  const [seenUpdatedAt, setSeenUpdatedAt] = useState(query.dataUpdatedAt);
  if (query.dataUpdatedAt !== seenUpdatedAt) {
    setSeenUpdatedAt(query.dataUpdatedAt);
    setFailed(false);
  }

  const onRefresh = async () => {
    const id = ++run.current;
    refreshHaptic();
    setFailed(false);
    setRefreshing(true);
    const timer = setTimeout(() => {
      if (run.current !== id) return;
      run.current++;
      setRefreshing(false);
      setFailed(true);
    }, REFRESH_TIMEOUT_MS);
    const result = await query.refetch();
    clearTimeout(timer);
    if (run.current !== id) return;
    setRefreshing(false);
    if (result.isError) setFailed(true);
  };

  return { refreshing, failed, onRefresh };
}

function RefreshFailedLine({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <View style={styles.failedLine}>
      <Text style={styles.failedText}>{t('commodityList.refreshFailed')}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.failedRetry}>
        <Text style={styles.failedText}>{t('common.retry')}</Text>
      </Pressable>
    </View>
  );
}

function CommodityRow({
  commodity,
  palette,
}: {
  commodity: CommoditySummary;
  palette: UpDownPalette;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { code } = commodity;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        tapHaptic();
        void prefetchDisparityChart(queryClient, code);
        router.push({ pathname: '/commodity/[code]', params: { code } });
      }}
      style={styles.row}
    >
      <View style={styles.nameColumn}>
        <Text style={styles.name}>{`${t(`commodities.${code}`)}\n(${code})`}</Text>
        {commodity.alert && <AlertBell />}
      </View>
      <View style={styles.quotes}>
        {commodity.contracts.map((quote) => (
          <QuoteLine
            key={quote.symbol}
            quote={quote}
            decimals={commodity.priceDecimals}
            palette={palette}
          />
        ))}
      </View>
    </Pressable>
  );
}

// 월물 / 현재가 / 전일 대비 / 등락률. 오늘 값이 없으면 마지막 정산가와 "거래 없음"이다.
function QuoteLine({
  quote,
  decimals,
  palette,
}: {
  quote: ContractQuote;
  decimals: number;
  palette: UpDownPalette;
}) {
  const { t } = useTranslation();
  const color =
    quote.noTrade || quote.change === null
      ? colors.neutral
      : changePairColor(quote.change, quote.changePct ?? 0, decimals, palette);

  return (
    <View style={styles.quoteLine}>
      <Text style={[styles.cell, styles.month]}>
        {formatContractMonth(quote.contractMonth)}
        {quote.isFront ? '●' : ' '}
      </Text>
      <Text style={[styles.cell, styles.price]}>
        {quote.price === null ? '-' : formatPrice(quote.price, decimals)}
      </Text>
      {quote.noTrade ? (
        <Text style={[styles.cell, styles.noTrade]}>{t('commodityList.noTrade')}</Text>
      ) : (
        <>
          <Text style={[styles.cell, styles.change, { color }]}>
            {quote.change === null ? '-' : formatChange(quote.change, decimals)}
          </Text>
          <Text style={[styles.cell, styles.pct, { color }]}>
            {quote.changePct === null ? '-' : formatChangePct(quote.changePct)}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  failedLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  failedText: {
    color: colors.error,
    fontSize: fontSize.caption,
  },
  failedRetry: {
    minHeight: size.touchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.sm,
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  nameColumn: {
    width: 104,
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: {
    color: colors.text,
    fontSize: fontSize.body,
    textAlign: 'center',
  },
  quotes: {
    flex: 1,
    gap: spacing.xs,
  },
  quoteLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cell: {
    fontSize: fontSize.caption,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  month: {
    width: 52,
    color: colors.textSecondary,
  },
  price: {
    flex: 1,
    color: colors.text,
  },
  change: {
    width: 64,
  },
  pct: {
    width: 60,
  },
  noTrade: {
    width: 124,
    color: colors.neutral,
  },
});
