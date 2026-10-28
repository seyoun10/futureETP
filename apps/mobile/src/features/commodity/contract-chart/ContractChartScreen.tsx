import type { CommodityCode, ContractsChart } from '@futureetp/shared';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAutoRefresh } from '@/api/useAutoRefresh';
import { PERIOD_BARS } from '@/charts/chartPeriods';
import { LinesChart } from '@/charts/LinesChart';
import { PeriodChips } from '@/charts/PeriodChips';
import { FreshnessLine } from '@/components/FreshnessLine';
import { QueryStateView } from '@/components/QueryStateView';
import { formatContractMonth, formatPrice } from '@/lib/formatNumber';
import { useDisplaySettings } from '@/stores/displaySettings';
import type { ChartPeriod } from '@/stores/displaySettings';
import { colors, fontSize, spacing } from '@/theme/tokens';
import { useCommodityCode } from '../useCommodityCode';
import { contractChartModel } from './contractChartModel';
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
  const [gestured, setGestured] = useState(false);

  const onSelectPeriod = (next: ChartPeriod) => {
    setPeriod(next);
    setGestured(false);
  };
  const onGestureStart = useCallback(() => setGestured(true), []);
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
          endLabels={model.endLabels}
          priceDecimals={data.priceDecimals}
          periodBars={gestured ? null : PERIOD_BARS[period]}
          onGestureStart={onGestureStart}
          renderDetail={renderDetail}
        />
      </View>
      <PeriodChips selected={gestured ? null : period} onSelect={onSelectPeriod} />
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
