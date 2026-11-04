import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useIsLandscape } from '@/lib/orientation';
import { CHART_PERIODS } from './chartPeriods';
import type { ChartPeriod } from './chartPeriods';
import { colors, fontSize, radius, size, spacing } from '@/theme/tokens';
import { tapHaptic } from '@/lib/haptics';

type PeriodChipsProps = {
  // 제스처로 범위를 바꿨으면 null(선택 표시 없음)
  selected: ChartPeriod | null;
  // 핀치로 범위를 바꿨을 때 보이는 범위와 가장 가까운 기간. 선택과 구분해 테두리로 표시한다
  nearest?: ChartPeriod | null;
  onSelect: (period: ChartPeriod) => void;
};

const CHIP_HEIGHT = size.touchTarget;
// 칩 줄 높이(ChartSkeleton이 자리를 맞춘다)
export const PERIOD_CHIPS_HEIGHT = CHIP_HEIGHT;

// C-a·C-c 기간 칩 한 줄(screens.md C-a 기간과 제스처). 칩이 줄 너비를 똑같이 나눠 스크롤 없이 다 보인다.
// 가로 모드에서는 차트만 보이게 숨긴다(D-103)
export function PeriodChips({ selected, nearest = null, onSelect }: PeriodChipsProps) {
  const { t } = useTranslation();
  const isLandscape = useIsLandscape();
  if (isLandscape) return null;

  return (
    <View
      style={styles.row}
      accessibilityRole="radiogroup"
      accessibilityLabel={t('chart.periodsLabel')}
    >
      {CHART_PERIODS.map((period) => {
        const isSelected = period === selected;
        const isNearest = !isSelected && period === nearest;
        return (
          <Pressable
            key={period}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            onPress={() => {
              if (!isSelected) tapHaptic();
              onSelect(period);
            }}
            style={[
              styles.chip,
              isSelected && styles.chipSelected,
              isNearest && styles.chipNearest,
            ]}
          >
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
              {t(`chart.periods.${period}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  chip: {
    flex: 1,
    height: CHIP_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.surfaceSelected,
    borderRadius: radius.md,
  },
  chipNearest: {
    borderWidth: 1,
    borderColor: colors.surfaceSelected,
    borderRadius: radius.md,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
  },
  chipTextSelected: {
    color: colors.text,
    fontWeight: '600',
  },
});
