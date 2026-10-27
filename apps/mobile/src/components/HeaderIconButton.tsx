import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fontSize } from '@/theme/tokens';

type Props = {
  // 아이콘 글리프. 아이콘 세트는 디자인 단계에서 정한다.
  glyph: string;
  label: string;
  onPress: () => void;
  // 가로 모드처럼 세로 공간이 좁을 때 높이를 줄인다
  compact?: boolean;
};

export function HeaderIconButton({ glyph, label, onPress, compact = false }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={[styles.button, compact && styles.compact]}
    >
      <Text style={styles.glyph}>{glyph}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: {
    minHeight: 32,
  },
  glyph: {
    color: colors.text,
    fontSize: fontSize.headline,
  },
});
