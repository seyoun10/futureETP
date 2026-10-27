import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollViewInstance,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { CHART_PERIODS } from '@/stores/displaySettings';
import type { ChartPeriod } from '@/stores/displaySettings';
import { colors, fontSize } from '@/theme/tokens';

type PeriodChipsProps = {
  // 제스처로 범위를 바꿨으면 null(선택 표시 없음)
  selected: ChartPeriod | null;
  onSelect: (period: ChartPeriod) => void;
};

const CHIP_WIDTH = 50;
const CHIP_HEIGHT = 44;
const EDGE = 1;

// C-a·C-c 기간 칩 한 줄(screens.md C-a 기간과 제스처). 칩이 화면을 넘으면 양 끝에 < > 버튼을 두고,
// 끝에 닿은 쪽 버튼은 비활성이다. 처음 그릴 때 선택된 칩이 보이게 스크롤한다.
export function PeriodChips({ selected, onSelect }: PeriodChipsProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [viewWidth, setViewWidth] = useState(0);
  const [offset, setOffset] = useState(0);
  const contentWidth = CHART_PERIODS.length * CHIP_WIDTH;
  const scrollable = viewWidth > 0 && contentWidth > viewWidth + EDGE;
  const maxOffset = Math.max(0, contentWidth - viewWidth);

  const onLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    const first = viewWidth === 0;
    setViewWidth(width);
    if (!first || selected === null) return;
    // 선택된 칩을 가운데쯤에 둔다
    const index = CHART_PERIODS.indexOf(selected);
    const target = Math.min(
      Math.max(0, index * CHIP_WIDTH - (width - CHIP_WIDTH) / 2),
      Math.max(0, contentWidth - width),
    );
    scrollRef.current?.scrollTo({ x: target, animated: false });
    setOffset(target);
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setOffset(e.nativeEvent.contentOffset.x);
  const scrollBy = (dx: number) => {
    const x = Math.min(Math.max(0, offset + dx), maxOffset);
    scrollRef.current?.scrollTo({ x, animated: true });
  };
  const page = Math.max(CHIP_WIDTH, viewWidth - CHIP_WIDTH);

  return (
    <View style={styles.row}>
      {scrollable && (
        <ArrowButton
          glyph="<"
          label={t('chart.scrollPrev')}
          disabled={offset <= EDGE}
          onPress={() => scrollBy(-page)}
        />
      )}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={onLayout}
        onScroll={onScroll}
        scrollEventThrottle={32}
        style={styles.scroll}
        accessibilityRole="radiogroup"
        accessibilityLabel={t('chart.periodsLabel')}
      >
        {CHART_PERIODS.map((period) => {
          const isSelected = period === selected;
          return (
            <Pressable
              key={period}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              onPress={() => onSelect(period)}
              style={[styles.chip, isSelected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                {t(`chart.periods.${period}`)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {scrollable && (
        <ArrowButton
          glyph=">"
          label={t('chart.scrollNext')}
          disabled={offset >= maxOffset - EDGE}
          onPress={() => scrollBy(page)}
        />
      )}
    </View>
  );
}

type ArrowButtonProps = {
  glyph: string;
  label: string;
  disabled: boolean;
  onPress: () => void;
};

function ArrowButton({ glyph, label, disabled, onPress }: ArrowButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={styles.arrow}
    >
      <Text style={[styles.arrowText, disabled && styles.arrowDisabled]}>{glyph}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  chip: {
    width: CHIP_WIDTH,
    height: CHIP_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.surfaceSelected,
    borderRadius: 6,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
  },
  chipTextSelected: {
    color: colors.text,
    fontWeight: '600',
  },
  arrow: {
    width: 32,
    height: CHIP_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    color: colors.text,
    fontSize: fontSize.title,
  },
  arrowDisabled: {
    color: colors.border,
  },
});
