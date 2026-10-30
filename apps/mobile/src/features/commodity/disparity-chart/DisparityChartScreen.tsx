import type { Basis, CommodityCode, DisparityChart } from '@futureetp/shared';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAutoRefresh } from '@/api/useAutoRefresh';
import { ChartSkeleton } from '@/charts/ChartSkeleton';
import { CandleChart } from '@/charts/CandleChart';
import { nearestPeriod, PERIOD_BARS } from '@/charts/chartPeriods';
import { ChartResetButton } from '@/charts/ChartResetButton';
import { PeriodChips } from '@/charts/PeriodChips';
import type { ChartGesture } from '@/charts/useChartViewport';
import { useTabFreshness } from '@/components/FreshnessLine';
import { ErrorView, QueryStateView } from '@/components/QueryStateView';
import {
  formatChange,
  formatChangePct,
  formatContractMonth,
  formatPrice,
} from '@/lib/formatNumber';
import { useDisplaySettings } from '@/stores/displaySettings';
import type { ChartPeriod } from '@/stores/displaySettings';
import { colors, fontSize, spacing } from '@/theme/tokens';
import { useCommodityCode } from '../useCommodityCode';
import { disparityChartModel, formatTailPct, holdingsText } from './disparityChartModel';
import type { DisparityChartModel } from './disparityChartModel';
import { visibleStats } from './disparitySeries';
import type { ChartBar } from './disparitySeries';
import { useDisparityChart } from './useDisparityChart';

// C-a 이격도차트 탭(screens.md C-a, D-086, D-087)
export function DisparityChartScreen() {
  const { t } = useTranslation();
  const code = useCommodityCode();

  return (
    <View style={styles.container} testID="disparity-chart-screen">
      {code ? (
        <DisparityChartContent code={code} />
      ) : (
        <Text style={styles.message}>{t('errors.NOT_FOUND')}</Text>
      )}
    </View>
  );
}

function DisparityChartContent({ code }: { code: CommodityCode }) {
  const { settings, chart } = useDisparityChart(code);
  useAutoRefresh(chart);

  // 설정을 못 읽으면 C-a 조회를 시작할 수 없어 설정 오류를 보여 준다
  if (settings.data === undefined && settings.isError && !settings.isFetching) {
    return <ErrorView error={settings.error} onRetry={() => void settings.refetch()} />;
  }
  return (
    <QueryStateView query={chart} skeleton={<ChartSkeleton footer="periods" />}>
      {(data) => (
        <DisparityChartView code={code} data={data} requestedBasis={settings.data?.basis} />
      )}
    </QueryStateView>
  );
}

type ViewProps = {
  code: CommodityCode;
  data: DisparityChart;
  requestedBasis: Basis | undefined;
};

function DisparityChartView({ code, data, requestedBasis }: ViewProps) {
  const { t } = useTranslation();
  useTabFreshness(data.freshness);
  const model = useMemo(() => disparityChartModel(data), [data]);
  const period = useDisplaySettings((s) => s.disparityPeriod);
  const setPeriod = useDisplaySettings((s) => s.setDisparityPeriod);
  // 제스처로 범위를 바꾸면 기간 맞춤을 멈춘다. 선택 표시는 핀치(확대·축소)일 때만 지운다.
  // 기기에 기억한 기간은 그대로 둔다
  const [gesture, setGesture] = useState<ChartGesture | null>(null);
  const [range, setRange] = useState<[number, number] | null>(null);

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
    (index: number) => <CrosshairDetail model={model} index={index} data={data} />,
    [model, data],
  );

  if (model.bars.length === 0) {
    return (
      <>
        <Text style={styles.message}>{t('disparity.noData')}</Text>
      </>
    );
  }

  return (
    <>
      <View style={styles.chart}>
        <CandleChart
          bars={model.bars}
          envelope={model.envelope}
          lines={model.lines}
          priceLabels={model.priceLabels}
          priceDecimals={data.priceDecimals}
          roll={model.roll}
          periodBars={gesture ? null : PERIOD_BARS[period]}
          onViewChange={onViewChange}
          onVisibleRangeChange={onVisibleRangeChange}
          renderDetail={renderDetail}
          overlayTop={
            <TodayLine code={code} data={data} model={model} requestedBasis={requestedBasis} />
          }
          overlayBottom={<StatsLine data={data} bars={model.bars} range={range} />}
          floating={gesture ? <ChartResetButton onPress={() => setGesture(null)} /> : undefined}
        />
      </View>
      <PeriodChips
        selected={gesture === 'zoom' ? null : period}
        nearest={
          gesture === 'zoom' && range
            ? nearestPeriod(range[1] - range[0] + 1, model.bars.length)
            : null
        }
        onSelect={onSelectPeriod}
      />
    </>
  );
}

// 좌상단 한 줄: 기준값 · 오늘 시고저종. 기준값을 누르면 안내가 열린다(screens.md C-a 좌상단 한 줄)
function TodayLine({
  code,
  data,
  model,
  requestedBasis,
}: ViewProps & { model: DisparityChartModel }) {
  const { t } = useTranslation();
  const [hintOpen, setHintOpen] = useState(false);
  const today = model.bars[model.bars.length - 1];
  const basisName = t(`settings.basis${data.basis}`);

  let basisLabel = data.fallback ? t('disparity.basisFallback', { basis: basisName }) : basisName;
  if (data.basis === 'FRONT') {
    const front = today.holdings[0]?.contractMonth;
    if (front) basisLabel = `${basisLabel} ${formatContractMonth(front)}`;
  } else if (today.inRoll) {
    basisLabel = t('disparity.basisInRoll', { basis: basisName });
  }

  const hints = [
    data.basis === 'FRONT'
      ? t('disparity.hint.FRONT')
      : t('disparity.hint.adjusted', { basis: basisName }),
    ...(data.fallback && requestedBasis && requestedBasis !== 'FRONT'
      ? [t('disparity.hint.fallback', { basis: t(`settings.basis${requestedBasis}`) })]
      : []),
    // 금·은은 미국형과 한국형이 같은 지수다(D-014)
    ...(data.basis === 'US' && (code === 'GC' || code === 'SI')
      ? [t('disparity.hint.sameAsKR')]
      : []),
  ];

  return (
    <View style={styles.today}>
      <Text style={styles.line} numberOfLines={1}>
        <Text
          accessibilityRole="button"
          onPress={() => setHintOpen((open) => !open)}
          style={styles.basis}
        >
          {basisLabel}
        </Text>
        {` · ${ohlcText(t, today, data.priceDecimals)}`}
      </Text>
      {hintOpen && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setHintOpen(false)}
          style={styles.hint}
        >
          {hints.map((hint) => (
            <Text key={hint} style={styles.hintText}>
              {hint}
            </Text>
          ))}
        </Pressable>
      )}
    </View>
  );
}

type T = ReturnType<typeof useTranslation>['t'];

const ohlcText = (t: T, bar: ChartBar, decimals: number) =>
  (['open', 'high', 'low', 'close'] as const)
    .map((key) => `${t(`disparity.${key}`)}${formatPrice(bar[key], decimals)}`)
    .join(' ');

const formatDisparity = (value: number) => `${formatChange(value, 1)}%`;

// 좌하단 한 줄: 이격도(꼬리 백분위) · 저점대비 · 고점대비. LC·HC는 보이는 봉 기준이다
function StatsLine({
  data,
  bars,
  range,
}: {
  data: DisparityChart;
  bars: readonly ChartBar[];
  range: [number, number] | null;
}) {
  const { t } = useTranslation();
  const today = bars[bars.length - 1];
  // 새로 조회해 봉이 줄었을 수 있어 범위를 봉 안으로 자른다
  const stats = range ? visibleStats(bars, range[0], Math.min(range[1], bars.length - 1)) : null;
  const items: string[] = [];
  if (today.disparity !== null) {
    const tail = data.currentTail
      ? ` (${t(`disparity.tail${data.currentTail.side}`, { pct: formatTailPct(data.currentTail.pct) })})`
      : '';
    items.push(`${t('disparity.disparity', { value: formatDisparity(today.disparity) })}${tail}`);
  }
  if (stats) {
    items.push(t('disparity.fromLow', { pct: formatChangePct(stats.fromLowPct) }));
    items.push(t('disparity.fromHigh', { pct: formatChangePct(stats.fromHighPct) }));
  }
  return (
    <Text style={styles.line} numberOfLines={1} testID="disparity-stats">
      {items.join(' · ')}
    </Text>
  );
}

// 십자선 상세 박스: 날짜, 시고저종, 전일 대비, 이격도, 월물 구성(screens.md C-a 길게 누르기)
function CrosshairDetail({
  model,
  index,
  data,
}: {
  model: DisparityChartModel;
  index: number;
  data: DisparityChart;
}) {
  const { t } = useTranslation();
  const bar = model.bars[index];
  if (!bar) return null;
  const prev = model.bars[index - 1];
  const decimals = data.priceDecimals;
  const switchTo = model.frontSwitchAt.get(index);
  const current = holdingsText(bar, data.basis);
  // 전환 마커 봉이면 새 월물명을 이어 쓴다(마커는 월 번호만, D-087)
  const holdings = switchTo && current ? `${current} → ${switchTo}` : current;

  return (
    <View style={styles.detail}>
      <Text style={styles.detailText}>{bar.tradeDate}</Text>
      <Text style={styles.detailText}>
        {`${t('disparity.open')} ${formatPrice(bar.open, decimals)}  ${t('disparity.high')} ${formatPrice(bar.high, decimals)}`}
      </Text>
      <Text style={styles.detailText}>
        {`${t('disparity.low')} ${formatPrice(bar.low, decimals)}  ${t('disparity.close')} ${formatPrice(bar.close, decimals)}`}
      </Text>
      {prev && (
        <Text style={styles.detailText}>
          {t('disparity.prevChange', {
            change: formatChange(bar.close - prev.close, decimals),
            pct: formatChangePct((bar.close / prev.close - 1) * 100),
          })}
        </Text>
      )}
      {bar.disparity !== null && (
        <Text style={styles.detailText}>
          {t('disparity.disparity', { value: formatDisparity(bar.disparity) })}
        </Text>
      )}
      {holdings && <Text style={styles.detailText}>{holdings}</Text>}
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
  line: {
    color: colors.text,
    fontSize: fontSize.caption,
    fontVariant: ['tabular-nums'],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    textAlign: 'center',
  },
  // 안내 상자가 차트 위에 오도록
  today: {
    zIndex: 1,
  },
  basis: {
    color: colors.text,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  hint: {
    position: 'absolute',
    top: '100%',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 1,
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: spacing.sm,
    backgroundColor: colors.surface,
  },
  hintText: {
    color: colors.text,
    fontSize: fontSize.caption,
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
