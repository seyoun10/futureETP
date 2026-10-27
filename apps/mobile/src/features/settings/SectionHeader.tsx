import { StyleSheet, Text } from 'react-native';
import { colors, fontSize, spacing } from '@/theme/tokens';

// B와 하위 화면의 묶음 제목
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
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
    color: colors.textSecondary,
    fontSize: fontSize.caption,
  },
});
