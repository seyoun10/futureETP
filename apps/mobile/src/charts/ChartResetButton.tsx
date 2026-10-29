import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fontSize, spacing } from '@/theme/tokens';
import { X_LABEL_HEIGHT } from './chartLayout';

const SIZE = 40;

// 차트 하단 가운데 [↻]: 드래그·핀치로 바꾼 범위를 선택한 기간의 최근 위치로 되돌린다(screens.md C-a 기간과 제스처).
// 차트 위에 겹쳐 그리는 오버레이라 차트를 감싼 View 안에 둔다
export function ChartResetButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('chart.resetView')}
        hitSlop={8}
        onPress={onPress}
        style={styles.button}
      >
        <Text style={styles.glyph}>↻</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: X_LABEL_HEIGHT + spacing.sm,
    alignItems: 'center',
  },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  glyph: {
    color: colors.text,
    fontSize: fontSize.headline,
  },
});
