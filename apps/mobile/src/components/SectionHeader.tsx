import { StyleSheet, Text } from 'react-native';
import { colors, fontSize, spacing } from '@/theme/tokens';

// B와 하위 화면의 묶음 제목. 화면 폭 전체의 surface 띠로 그려 묶음 경계가 한눈에 보이게 한다
export function SectionHeader({ title }: { title: string }) {
  return (
    <Text accessibilityRole="header" style={styles.sectionHeader}>
      {title}
    </Text>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: colors.surface,
  },
});
