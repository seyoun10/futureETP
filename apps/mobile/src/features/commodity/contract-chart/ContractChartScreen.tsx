import type { CommodityCode, ContractsChart } from '@futureetp/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAutoRefresh } from '@/api/useAutoRefresh';
import { ChartSkeleton } from '@/charts/ChartSkeleton';
import { LinesChart } from '@/charts/LinesChart';
import { DetailBox, DetailRow } from '@/charts/DetailBox';
import { LegendLine } from '@/charts/LegendLine';
import { OlderDataIndicator } from '@/charts/OlderDataIndicator';
import { PeriodChips } from '@/charts/PeriodChips';
import { useOlderPages } from '@/charts/useOlderPages';
import type { OlderPagesQuery } from '@/charts/useOlderPages';
import { useTabFreshness } from '@/components/FreshnessLine';
import { QueryStateView } from '@/components/QueryStateView';
import { formatChangePct, formatContractMonth, formatPrice } from '@/lib/formatNumber';
import { perfMark, perfStart, perfTime } from '@/lib/perfLog';
import { colors, fontSize, spacing } from '@/theme/tokens';
import { useChartPeriodView } from '../useChartPeriodView';
import { useCommodityCode } from '../useCommodityCode';
import {
  contractChartModel,
  endsRollYieldPct,
  FRONT_MARK,
  visibleEndLabels,
} from './contractChartModel';
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
  const { range, chartProps, chipProps } = useChartPeriodView('contract', data.dates.length);
  useOlderPages(range?.[0] ?? null, older);
  // 끝값 라벨은 보이는 범위의 마지막 날 값이다(D-093). 범위를 받기 전에는 전체 범위
  const endLabels = useMemo(
    () => visibleEndLabels(data, range?.[0] ?? 0, range?.[1] ?? data.dates.length - 1),
    [data, range],
  );

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
          {...chartProps}
          renderDetail={renderDetail}
          overlayTop={<Legend model={model} />}
          locked={older.isFetchingNextPage}
        />
        <OlderDataIndicator visible={older.isFetchingNextPage} />
      </View>
      <PeriodChips {...chipProps} />
    </>
  );
}

// 차트 위 선 색 범례(가운데 정렬). y축 끝값 라벨은 값만 쓰고 월물은 이 범례로 읽는다
function Legend({ model }: { model: ContractChartModel }) {
  return (
    <View style={styles.legend} testID="contracts-legend">
      {model.legend.map((item) => (
        <View key={item.key} style={styles.legendItem}>
          <LegendLine color={item.color} />
          <Text style={styles.legendText}>
            {item.label}
            {item.isFront && <Text style={styles.frontMark}>{FRONT_MARK}</Text>}
          </Text>
        </View>
      ))}
    </View>
  );
}

// 십자선 상세 박스: 날짜(오늘 잠정 값이면 표시), 그날 값이 있는 월물별 가격(선 색, 대표월물 ●은 A 목록 색),
// 맨 아래 양끝 월물의 연환산 롤 수익률. 값이 있는 월물이 둘 이상일 때만
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
  const rollYield = endsRollYieldPct(data, index);

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
            mark={c.isFront ? FRONT_MARK : undefined}
          />
        );
      })}
      {rollYield !== null && (
        <DetailRow
          label={t('contracts.rollYield')}
          value={t('curve.perYear', { pct: formatChangePct(rollYield) })}
        />
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
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendText: {
    color: colors.text,
    fontSize: fontSize.caption,
    fontVariant: ['tabular-nums'],
  },
  // 대표월물 표식은 A 원자재 목록과 같은 색(선 색을 따르지 않는다)
  frontMark: {
    color: colors.textSecondary,
  },
});
