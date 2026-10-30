import type { CommoditySummary, ContractQuote } from '@futureetp/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAutoRefresh } from '@/api/useAutoRefresh';
import { FreshnessFooter } from '@/components/FreshnessLine';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { QueryStateView } from '@/components/QueryStateView';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  formatChange,
  formatChangePct,
  formatContractMonth,
  formatPrice,
} from '@/lib/formatNumber';
import { changeColor, useUpDownPalette } from '@/theme/upDownColor';
import type { UpDownPalette } from '@/theme/upDownColor';
import { colors, fontSize, spacing } from '@/theme/tokens';
import { useCommodities } from './useCommodities';

// A 원자재 목록(screens.md A, D-085). 원자재와 월물 줄은 서버가 준 순서대로 그린다.
export function CommodityListScreen() {
  const { t } = useTranslation();
  const query = useCommodities();
  const palette = useUpDownPalette();
  // 당겨서 새로고침만 스피너를 띄운다(자동 새로고침·복귀 재조회는 조용히)
  const [refreshing, setRefreshing] = useState(false);
  useAutoRefresh(query);

  const onRefresh = async () => {
    setRefreshing(true);
    await query.refetch();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="futureETP"
        showBack={false}
        right={
          <HeaderIconButton
            icon="cog-outline"
            label={t('settings.title')}
            onPress={() => router.push('/settings')}
          />
        }
      />
      <QueryStateView query={query}>
        {(data) => (
          <>
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
  const { code } = commodity;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/commodity/[code]', params: { code } })}
      style={styles.row}
    >
      <View style={styles.nameColumn}>
        {commodity.alert && (
          <Text style={styles.bell} accessibilityLabel={t('commodityList.alert')}>
            🔔
          </Text>
        )}
        <Text style={styles.name}>{`${t(`commodities.${code}`)}\n(${code})`}</Text>
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
    quote.noTrade || quote.change === null ? colors.neutral : changeColor(quote.change, palette);

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
  bell: {
    fontSize: fontSize.caption,
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
