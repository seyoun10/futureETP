import { Pressable, StyleSheet, View } from 'react-native';
import { tapHaptic } from '@/lib/haptics';
import { colors } from '@/theme/tokens';
import { Icon } from './Icon';
import type { IconName } from './Icon';

type Props = {
  icon: IconName;
  label: string;
  onPress: () => void;
  // 가로 모드처럼 세로 공간이 좁을 때 높이를 줄인다
  compact?: boolean;
  // 있으면 아이콘 오른쪽 위에 빨간 점을 그리고, 이 문구를 접근성 힌트로 읽는다
  badge?: string;
};

export function HeaderIconButton({ icon, label, onPress, compact = false, badge }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={badge}
      hitSlop={8}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={[styles.button, compact && styles.compact]}
    >
      <View>
        <Icon name={icon} />
        {badge !== undefined && <View testID="header-badge" style={styles.badge} />}
      </View>
    </Pressable>
  );
}

const BADGE_SIZE = 9;

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
  // 배경색 테두리로 아이콘 선과 떼어 보이게 한다
  badge: {
    position: 'absolute',
    top: -2,
    right: -3,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    borderWidth: 1.5,
    borderColor: colors.background,
    backgroundColor: colors.badge,
  },
});
