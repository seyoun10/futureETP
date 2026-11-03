import type { CommodityCode, ContractsChart } from '@futureetp/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAutoRefresh } from '@/api/useAutoRefresh';
import { ChartSkeleton } from '@/charts/ChartSkeleton';
import { nearestPeriod, PERIOD_BARS } from '@/charts/chartPeriods';
import type { ChartPeriod } from '@/charts/chartPeriods';
import { LinesChart } from '@/charts/LinesChart';
import { ChartResetButton } from '@/charts/ChartResetButton';
import { DetailBox, DetailRow } from '@/charts/DetailBox';
import { OlderDataIndicator } from '@/charts/OlderDataIndicator';
import { PeriodChips } from '@/charts/PeriodChips';
import type { ChartGesture } from '@/charts/useChartViewport';
import { useOlderPages } from '@/charts/useOlderPages';
import type { OlderPagesQuery } from '@/charts/useOlderPages';
import { useTabFreshness } from '@/components/FreshnessLine';
import { QueryStateView } from '@/components/QueryStateView';
import { formatChangePct, formatContractMonth, formatPrice } from '@/lib/formatNumber';
import { perfMark, perfStart, perfTime } from '@/lib/perfLog';
import { colors, fontSize, spacing } from '@/theme/tokens';
import { useChartPeriod } from '../ChartPeriodProvider';
import { useCommodityCode } from '../useCommodityCode';
import { contractChartModel, visibleEndLabels } from './contractChartModel';
import type { ContractChartModel } from './contractChartModel';
import { useContracts } from './useContracts';

// C-c 월물차트 탭(screens.md C-c, D-092)
export function ContractChartScreen() {
  const { t } = useTranslation();
  const code = useCommodityCode();

  return (
    <View style={styles.container} testID="contract-chart-screen">
      {code ? (
        <ContractChartContent code={code} />
      ) : (
        <Text style={styles.message}>{t('errors.NOT_FOUND')}</Text>
      )}
    </View>
  );
}

function ContractChartContent({ code }: { code: CommodityCode }) {
  // 진입 측정은 첫 렌더에 시작한다(effect는 자식 조회 뒤라 늦다)
  useState(() => perfStart(`C-c ${code}`));
  const query = useContracts(code);
  useAutoRefresh(query);
  return (
    <QueryStateView query={query} skeleton={<ChartSkeleton footer="periods" />}>
      {(data) => <ContractChartView data={data} older={query} />}
    </QueryStateView>
  );
}

function ContractChartView({ data, older }: { data: ContractsChart; older: OlderPagesQuery }) {
  const { t } = useTranslation();
  useTabFreshness(data.freshness);
  const model = useMemo(
    () => perfTime(`model ${data.dates.length} dates`, () => contractChartModel(data)),
    [data],
  );
  useEffect(() => perfMark('view committed'), []);
  // 기간 선택은 C-a와 따로 기억한다(screens.md C-c)
  const [period, setPeriod] = useChartPeriod('contract');
  // 제스처로 범위를 바꾸면 기간 맞춤을 멈춘다. 선택 표시는 핀치(확대·축소)일 때만 지운다.
  // 고른 기간은 그대로 둔다
  const [gesture, setGesture] = useState<ChartGesture | null>(null);
  const [range, setRange] = useState<[number, number] | null>(null);
  useOlderPages(range?.[0] ?? null, older);
  // 끝값 라벨은 보이는 범위의 마지막 날 값이다(D-093). 범위를 받기 전에는 전체 범위
  const endLabels = useMemo(
    () => visibleEndLabels(data, range?.[0] ?? 0, range?.[1] ?? data.dates.length - 1),
    [data, range],
  );

  const onSelectPeriod = (next: ChartPeriod) => {
    setPeriod(next);
    setGesture(null);
  };
  // 한 번 핀치하면 이후 드래그해도 선택 표시를 되살리지 않는다. 기간 범위로 돌아오면(null) 처음 상태다
  const onViewChange = useCallback(
    (next: ChartGesture | null) =>
      setGesture((prev) => (next !== null && prev === 'zoom' ? prev : next)),
    [],
  );
  const onVisibleRangeChange = useCallback((i0: number, i1: number) => setRange([i0, i1]), []);
  const renderDetail = useCallback(
    (index: number) => <CrosshairDetail data={data} model={model} index={index} />,
    [data, model],
  );

  if (data.dates.length === 0 || model.lines.length === 0) {
    return (
      <>
        <Text style={styles.message}>{t('contracts.noData')}</Text>
      </>
    );
  }

  return (
    <>
      <View style={styles.chart}>
        <LinesChart
          dates={data.dates}
          lines={model.lines}
          envelope={model.envelope}
          endLabels={endLabels}
          widestLabels={model.widestLabels}
          priceDecimals={data.priceDecimals}
          periodBars={gesture ? null : PERIOD_BARS[period]}
          onViewChange={onViewChange}
          onVisibleRangeChange={onVisibleRangeChange}
          renderDetail={renderDetail}
          floating={gesture ? <ChartResetButton onPress={() => setGesture(null)} /> : undefined}
          locked={older.isFetchingNextPage}
        />
        <OlderDataIndicator visible={older.isFetchingNextPage} />
      </View>
      <PeriodChips
        selected={gesture === 'zoom' ? null : period}
        nearest={
          gesture === 'zoom' && range
            ? nearestPeriod(range[1] - range[0] + 1, data.dates.length)
            : null
        }
        onSelect={onSelectPeriod}
      />
    </>
  );
}

// 십자선 상세 박스: 날짜(오늘 잠정 값이면 표시), 그날 값이 있는 월물별 가격(선 색),
// 맨 아래 양끝 차이(가장 먼 월물 / 가장 가까운 월물 - 1). 값이 있는 월물이 둘 이상일 때만
function CrosshairDetail({
  data,
  model,
  index,
}: {
  data: ContractsChart;
  model: ContractChartModel;
  index: number;
}) {
  const { t } = useTranslation();
  const date = data.dates[index];
  if (!date) return null;
  const provisional = data.provisional && index === data.dates.length - 1;
  const prices = data.contracts
    .map((c) => c.prices[index])
    .filter((p): p is number => p !== null && p !== undefined);
  const near = prices[0];
  const far = prices[prices.length - 1];
  const spread = prices.length >= 2 && near > 0 ? (far / near - 1) * 100 : null;

  return (
    <DetailBox>
      <DetailRow label={date} value={provisional ? t('contracts.provisional') : null} />
      {data.contracts.map((c, i) => {
        const price = c.prices[index];
        if (price === null || price === undefined) return null;
        return (
          <DetailRow
            key={c.symbol}
            label={formatContractMonth(c.contractMonth)}
            value={formatPrice(price, data.priceDecimals)}
            color={model.lines[i].color}
          />
        );
      })}
      {spread !== null && (
        <DetailRow label={t('contracts.endSpread')} value={formatChangePct(spread)} />
      )}
    </DetailBox>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  message: {
    color: colors.text,
    fontSize: fontSize.body,
    textAlign: 'center',
    padding: spacing.lg,
  },
  chart: {
    flex: 1,
  },
});
