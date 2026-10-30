import { Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { colors } from '@/theme/tokens';

const SIZE = 40;

// 차트 하단 가운데 [되돌리기](restore 아이콘, 새로고침과 구분): 드래그·핀치로 바꾼 범위를 선택한 기간의
// 최근 위치로 되돌린다(screens.md C-a 기간과 제스처). 차트의 floating 자리(아래 정보 줄 위)에 넣는다
export function ChartResetButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('chart.resetView')}
      hitSlop={8}
      onPress={onPress}
      style={styles.button}
    >
      <Icon name="restore" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
});
