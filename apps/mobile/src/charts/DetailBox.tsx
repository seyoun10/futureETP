import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, spacing } from '@/theme/tokens';

// 십자선·툴팁 상세 박스(C-a·C-b·C-c 공용). 너비는 가장 긴 줄에 맞춘다
export function DetailBox({ children }: { children: ReactNode }) {
  return <View style={styles.box}>{children}</View>;
}

// 상세 박스 한 줄: 이름은 왼쪽, 값은 오른쪽 정렬. 둘 사이는 최소 spacing.md
export function DetailRow({
  label,
  value,
  color = colors.text,
}: {
  label: string;
  value: string | null;
  color?: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.text, { color }]}>{label}</Text>
      {value !== null && <Text style={[styles.text, { color }]}>{value}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: 2,
    padding: spacing.sm,
    borderRadius: spacing.xs,
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  text: {
    color: colors.text,
    fontSize: fontSize.caption,
    fontVariant: ['tabular-nums'],
  },
});
