import { Pressable, StyleSheet } from 'react-native';
import { Icon } from './Icon';
import type { IconName } from './Icon';

type Props = {
  icon: IconName;
  label: string;
  onPress: () => void;
  // 가로 모드처럼 세로 공간이 좁을 때 높이를 줄인다
  compact?: boolean;
};

export function HeaderIconButton({ icon, label, onPress, compact = false }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={[styles.button, compact && styles.compact]}
    >
      <Icon name={icon} />
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
});
