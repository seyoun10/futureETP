import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useIsLandscape } from '@/lib/orientation';
import { colors, spacing } from '@/theme/tokens';
import { PERIOD_CHIPS_HEIGHT } from './PeriodChips';

type Props = {
  // 차트 아래 줄 모양. periods = 기간 칩(C-a·C-c), steps = 기준일 −/+/0(C-b)
  footer: 'periods' | 'steps';
};

const GRID_LINES = 5;
const STEP_SIZE = 44;

// 차트 탭 첫 조회 중 화면(QueryStateView skeleton). 공용 막대 대신 차트 격자와 아래 줄 자리를 그려
// 차트가 들어설 자리와 모양을 맞춘다. 캐시가 있으면 보이지 않는다
export function ChartSkeleton({ footer }: Props) {
  const { t } = useTranslation();
  // 가로 모드는 아래 줄을 숨긴다(D-103)
  const isLandscape = useIsLandscape();

  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
    >
      <View style={styles.chart}>
        {Array.from({ length: GRID_LINES }, (_, i) => (
          <View key={i} style={styles.grid} />
        ))}
      </View>
      {isLandscape ? null : footer === 'periods' ? (
        <View style={[styles.footer, { height: PERIOD_CHIPS_HEIGHT }]}>
          {Array.from({ length: 6 }, (_, i) => (
            <View key={i} style={styles.chip} />
          ))}
        </View>
      ) : (
        <View style={[styles.footer, styles.steps]}>
          <View style={styles.step} />
          <View style={[styles.step, styles.baseDate]} />
          <View style={styles.step} />
          <View style={styles.step} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  chart: {
    flex: 1,
    justifyContent: 'space-evenly',
  },
  grid: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.chart.grid,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  chip: {
    width: 40,
    height: 24,
    borderRadius: spacing.xs,
    backgroundColor: colors.surface,
  },
  steps: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  step: {
    width: STEP_SIZE,
    height: STEP_SIZE,
    borderRadius: spacing.sm,
    backgroundColor: colors.surface,
  },
  baseDate: {
    width: 160,
  },
});
