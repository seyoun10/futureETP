import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, size, spacing } from '@/theme/tokens';
import { tapHaptic } from '@/lib/haptics';

type Option<T> = { value: T; label: string };

type Props<T extends string | number> = {
  label: string;
  options: readonly Option<T>[];
  // 아직 값을 모르면(설정 조회 중) 아무것도 고르지 않은 채로 둔다
  value: T | undefined;
  onChange: (value: T) => void;
  // 선택지가 많으면 이름을 위에 두고 선택지가 전체 폭을 나눠 쓴다
  stacked?: boolean;
  // 행 아래 한 줄 설명
  description?: string;
};

// 설정 행: 이름 + [a|b|c] 중 하나 고르기. 고른 값을 다시 누르면 아무것도 하지 않는다.
export function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
  stacked = false,
  description,
}: Props<T>) {
  return (
    <View style={styles.container}>
      <View style={[styles.row, stacked && styles.stackedRow]}>
        <Text style={[styles.label, stacked && styles.stackedLabel]}>{label}</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.group}>
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => {
                  if (selected) return;
                  tapHaptic();
                  onChange(option.value);
                }}
                style={[
                  styles.segment,
                  stacked && styles.stackedSegment,
                  selected && styles.selected,
                ]}
              >
                <Text style={styles.segmentText}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {description && <Text style={styles.description}>{description}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing.xs,
  },
  description: {
    marginTop: -spacing.xs,
    paddingHorizontal: spacing.lg,
    color: colors.textSecondary,
    fontSize: fontSize.caption,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: size.touchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  stackedRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  label: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.body,
  },
  stackedLabel: {
    flex: 0,
  },
  group: {
    flexDirection: 'row',
    borderRadius: spacing.sm,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  segment: {
    minHeight: 36,
    minWidth: size.touchTarget,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  stackedSegment: {
    flex: 1,
    paddingHorizontal: spacing.xs,
  },
  selected: {
    backgroundColor: colors.surfaceSelected,
  },
  segmentText: {
    color: colors.text,
    fontSize: fontSize.body,
    textAlign: 'center',
  },
});
