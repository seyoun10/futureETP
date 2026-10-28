import type { CommodityCode, Curve } from '@futureetp/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAutoRefresh } from '@/api/useAutoRefresh';
import { CurveChart } from '@/charts/CurveChart';
import type { CurvePoint } from '@/charts/CurveChart';
import { FreshnessLine } from '@/components/FreshnessLine';
import { QueryStateView } from '@/components/QueryStateView';
import { formatContractMonth, formatPrice } from '@/lib/formatNumber';
import { colors, fontSize, spacing } from '@/theme/tokens';
import { useCommodityCode } from '../useCommodityCode';
import { BaseDateSheet, openAndroidBaseDatePicker } from './BaseDatePicker';
import {
  curveSummaryLines,
  formatCurvePct,
  formatFullDate,
  formatLegendDate,
  formatWeekday,
} from './curveModel';
import { useCurve } from './useCurve';

// C-b 월물커브 탭(screens.md C-b, D-090)
export function CurveScreen() {
  const { t } = useTranslation();
  const code = useCommodityCode();

  return (
    <View style={styles.container} testID="curve-screen">
      {code ? (
        <CurveContent code={code} />
      ) : (
        <Text style={styles.message}>{t('errors.NOT_FOUND')}</Text>
      )}
    </View>
  );
}

function CurveContent({ code }: { code: CommodityCode }) {
  // null = 서버 기본값(D-1). 화면을 떠나면 잊는다(기기 설정이 아님)
  const [baseDate, setBaseDate] = useState<string | null>(null);
  // 시트에서 고른 날짜. 응답 기준일이 다르면(휴장일) 옮긴 날짜를 잠깐 안내한다
  const [picked, setPicked] = useState<string | null>(null);
  const curve = useCurve(code, baseDate);
  useAutoRefresh(curve);

  const resolved = curve.isPlaceholderData ? undefined : curve.data?.baseDate;
  const movedTo =
    picked !== null && resolved !== undefined && resolved !== picked ? resolved : null;
  useEffect(() => {
    if (movedTo === null) return;
    const id = setTimeout(() => setPicked(null), MOVED_NOTICE_MS);
    return () => clearTimeout(id);
  }, [movedTo]);

  const changeBaseDate = useCallback((next: string | null) => {
    setPicked(null);
    setBaseDate(next);
  }, []);
  const pickBaseDate = useCallback((date: string, maxBaseDate: string) => {
    setPicked(date);
    // D-1이면 기본값과 같은 조회 key를 쓴다
    setBaseDate(date === maxBaseDate ? null : date);
  }, []);

  return (
    <QueryStateView query={curve}>
      {(data) => (
        <CurveView
          data={data}
          movedTo={movedTo}
          onChangeBaseDate={changeBaseDate}
          onPickBaseDate={pickBaseDate}
        />
      )}
    </QueryStateView>
  );
}

const MOVED_NOTICE_MS = 3000;

type ViewProps = {
  data: Curve;
  // 휴장일을 골라 서버가 옮긴 기준일
  movedTo: string | null;
  onChangeBaseDate: (baseDate: string | null) => void;
  onPickBaseDate: (date: string, maxBaseDate: string) => void;
};

function CurveView({ data, movedTo, onChangeBaseDate, onPickBaseDate }: ViewProps) {
  const { t, i18n } = useTranslation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const points = useMemo<CurvePoint[]>(
    () =>
      data.points.map((p) => ({
        label: formatContractMonth(p.contractMonth),
        base: p.basePrice,
        current: p.currentPrice,
        changePct: p.changePct,
      })),
    [data.points],
  );
  const renderDetail = useCallback(
    (index: number) => <CurveDetail data={data} index={index} />,
    [data],
  );
  const currentDate = data.freshness.tradeDate;
  const [stateLine, rollLine] = curveSummaryLines(t, data);
  const range = {
    value: data.baseDate,
    minBaseDate: data.minBaseDate,
    maxBaseDate: data.maxBaseDate,
  };
  const confirmPick = (date: string) => {
    setSheetOpen(false);
    onPickBaseDate(date, data.maxBaseDate);
  };
  const openPicker = () => {
    if (Platform.OS === 'android') {
      openAndroidBaseDatePicker(t, range, { onConfirm: confirmPick, onCancel: () => {} });
    } else {
      setSheetOpen(true);
    }
  };

  return (
    <>
      <Text style={styles.line} numberOfLines={1} testID="curve-legend">
        <Text style={styles.legendBase}>{'╌╌ '}</Text>
        {t('curve.legendBase', { date: formatLegendDate(data.baseDate, currentDate) })}
        {'   '}
        <Text style={styles.legendCurrent}>{'── '}</Text>
        {t('curve.legendCurrent', { date: formatLegendDate(currentDate, currentDate) })}
      </Text>
      <FreshnessLine freshness={data.freshness} />
      <View style={styles.chart}>
        {points.length === 0 ? (
          <Text style={styles.message}>{t('curve.noData')}</Text>
        ) : (
          <CurveChart
            points={points}
            priceDecimals={data.priceDecimals}
            formatPct={formatCurvePct}
            renderDetail={renderDetail}
          />
        )}
        {movedTo !== null && (
          <View style={styles.notice} pointerEvents="none">
            <Text style={styles.noticeText} testID="curve-moved">
              {t('curve.moved', {
                date: formatLegendDate(movedTo, currentDate),
                weekday: formatWeekday(movedTo, i18n.language),
              })}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.controls}>
        <StepButton
          label="-"
          accessibilityLabel={t('curve.prev')}
          onPress={data.prevBaseDate === null ? null : () => onChangeBaseDate(data.prevBaseDate)}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityHint={t('curve.pickTitle')}
          onPress={openPicker}
          style={styles.step}
        >
          <Text style={styles.baseDate} testID="curve-base-date">
            {t('curve.baseDate', { date: formatFullDate(data.baseDate), n: data.baseOffset })}
          </Text>
        </Pressable>
        <StepButton
          label="+"
          accessibilityLabel={t('curve.next')}
          // D-1로 오면 기본값과 같은 조회 key를 쓴다
          onPress={
            data.nextBaseDate === null
              ? null
              : () =>
                  onChangeBaseDate(
                    data.nextBaseDate === data.maxBaseDate ? null : data.nextBaseDate,
                  )
          }
        />
        <StepButton
          label="0"
          accessibilityLabel={t('curve.reset')}
          onPress={data.baseDate === data.maxBaseDate ? null : () => onChangeBaseDate(null)}
        />
      </View>
      <Text style={styles.line} numberOfLines={1} testID="curve-state">
        {stateLine}
      </Text>
      <Text style={styles.line} numberOfLines={1} testID="curve-roll-yield">
        {rollLine}
      </Text>
      {sheetOpen && (
        <BaseDateSheet range={range} onConfirm={confirmPick} onCancel={() => setSheetOpen(false)} />
      )}
    </>
  );
}

type StepButtonProps = {
  label: string;
  accessibilityLabel: string;
  // null이면 범위 끝이라 비활성
  onPress: (() => void) | null;
};

function StepButton({ label, accessibilityLabel, onPress }: StepButtonProps) {
  const disabled = onPress === null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress ?? undefined}
      style={[styles.step, disabled && styles.stepDisabled]}
    >
      <Text style={[styles.stepText, disabled && styles.stepTextDisabled]}>{label}</Text>
    </Pressable>
  );
}

// 툴팁: 월물 / 기준일 / 현재 / 변화율. 그 커브에 없는 값은 줄을 뺀다(screens.md C-b 선차트)
function CurveDetail({ data, index }: { data: Curve; index: number }) {
  const { t } = useTranslation();
  const point = data.points[index];
  if (!point) return null;
  const price = (v: number) => formatPrice(v, data.priceDecimals);

  return (
    <View style={styles.detail}>
      <Text style={styles.detailText}>{formatContractMonth(point.contractMonth)}</Text>
      {point.basePrice !== null && (
        <Text style={styles.detailText}>
          {t('curve.tooltipBase', { price: price(point.basePrice) })}
        </Text>
      )}
      {point.currentPrice !== null && (
        <Text style={styles.detailText}>
          {t('curve.tooltipCurrent', { price: price(point.currentPrice) })}
        </Text>
      )}
      {point.changePct !== null && (
        <Text style={styles.detailText}>
          {t('curve.tooltipChange', { pct: formatCurvePct(point.changePct) })}
        </Text>
      )}
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
  },
  legendBase: {
    color: colors.chart.curveBase,
  },
  legendCurrent: {
    color: colors.chart.curveCurrent,
  },
  chart: {
    flex: 1,
    paddingHorizontal: spacing.sm,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  step: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: spacing.sm,
    backgroundColor: colors.surface,
  },
  stepDisabled: {
    opacity: 0.4,
  },
  stepText: {
    color: colors.text,
    fontSize: fontSize.title,
  },
  stepTextDisabled: {
    color: colors.textSecondary,
  },
  baseDate: {
    color: colors.text,
    fontSize: fontSize.body,
    fontVariant: ['tabular-nums'],
    paddingHorizontal: spacing.sm,
  },
  // 차트 위쪽에 띄운다. 아래쪽이면 x축 월물 라벨을 가린다
  notice: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: spacing.sm,
    alignItems: 'center',
  },
  noticeText: {
    color: colors.text,
    fontSize: fontSize.caption,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: spacing.xs,
    backgroundColor: colors.surface,
    overflow: 'hidden',
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
