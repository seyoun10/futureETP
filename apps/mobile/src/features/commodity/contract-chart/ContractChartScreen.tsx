import type { CommodityCode, ContractsChart } from '@futureetp/shared';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAutoRefresh } from '@/api/useAutoRefresh';
import { PERIOD_BARS } from '@/charts/chartPeriods';
import { LinesChart } from '@/charts/LinesChart';
import { ChartResetButton } from '@/charts/ChartResetButton';
import { PeriodChips } from '@/charts/PeriodChips';
import type { ChartGesture } from '@/charts/useChartViewport';
import { FreshnessLine } from '@/components/FreshnessLine';
import { QueryStateView } from '@/components/QueryStateView';
import { formatContractMonth, formatPrice } from '@/lib/formatNumber';
import { useDisplaySettings } from '@/stores/displaySettings';
import type { ChartPeriod } from '@/stores/displaySettings';
import { colors, fontSize, spacing } from '@/theme/tokens';
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
  const query = useContracts(code);
  useAutoRefresh(query);
  return (
    <QueryStateView query={query}>{(data) => <ContractChartView data={data} />}</QueryStateView>
  );
}

function ContractChartView({ data }: { data: ContractsChart }) {
  const { t } = useTranslation();
  const model = useMemo(() => contractChartModel(data), [data]);
  // 기간 선택은 C-a와 따로 기억한다(screens.md C-c)
  const period = useDisplaySettings((s) => s.contractPeriod);
  const setPeriod = useDisplaySettings((s) => s.setContractPeriod);
  // 제스처로 범위를 바꾸면 기간 맞춤을 멈춘다. 선택 표시는 핀치(확대·축소)일 때만 지운다.
  // 기기에 기억한 기간은 그대로 둔다
  const [gesture, setGesture] = useState<ChartGesture | null>(null);
  const [range, setRange] = useState<[number, number] | null>(null);
  // 끝값 라벨은 보이는 범위의 마지막 날 값이다(D-093). 범위를 받기 전에는 전체 범위
  const endLabels = useMemo(
    () => visibleEndLabels(data, range?.[0] ?? 0, range?.[1] ?? data.dates.length - 1),
    [data, range],
  );

  const onSelectPeriod = (next: ChartPeriod) => {
    setPeriod(next);
    setGesture(null);
  };
  // 한 번 핀치하면 이후 드래그해도 선택 표시를 되살리지 않는다
  const onGestureStart = useCallback(
    (next: ChartGesture) => setGesture((prev) => (prev === 'zoom' ? prev : next)),
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
        <FreshnessLine freshness={data.freshness} />
        <Text style={styles.message}>{t('contracts.noData')}</Text>
      </>
    );
  }

  return (
    <>
      <FreshnessLine freshness={data.freshness} />
      <View style={styles.chart}>
        <LinesChart
          dates={data.dates}
          lines={model.lines}
          envelope={model.envelope}
          endLabels={endLabels}
          widestLabels={model.widestLabels}
          priceDecimals={data.priceDecimals}
          periodBars={gesture ? null : PERIOD_BARS[period]}
          onGestureStart={onGestureStart}
          onVisibleRangeChange={onVisibleRangeChange}
          renderDetail={renderDetail}
        />
        {gesture && <ChartResetButton onPress={() => setGesture(null)} />}
      </View>
      <PeriodChips selected={gesture === 'zoom' ? null : period} onSelect={onSelectPeriod} />
    </>
  );
}

// 십자선 상세 박스: 날짜(오늘 잠정 값이면 표시), 그날 값이 있는 월물별 가격(선 색)
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

  return (
    <View style={styles.detail}>
      <Text style={styles.detailText}>
        {provisional ? `${date} ${t('contracts.provisional')}` : date}
      </Text>
      {data.contracts.map((c, i) => {
        const price = c.prices[index];
        if (price === null || price === undefined) return null;
        return (
          <Text key={c.symbol} style={[styles.detailText, { color: model.lines[i].color }]}>
            {`${formatContractMonth(c.contractMonth)} ${formatPrice(price, data.priceDecimals)}`}
          </Text>
        );
      })}
    </View>
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
  detail: {
    gap: 2,
    padding: spacing.sm,
    borderRadius: spacing.xs,
    backgroundColor: colors.surface,
  },
  detailText: {
    color: colors.text,
    fontSize: fontSize.caption,
    fontVariant: ['tabular-nums'],
  },
});
