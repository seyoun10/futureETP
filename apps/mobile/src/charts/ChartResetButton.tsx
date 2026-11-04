import { Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { colors } from '@/theme/tokens';

const SIZE = 40;

// 차트 하단 가운데 [되돌리기](restore 아이콘, 새로고침과 구분): 드래그·핀치로 바꾼 범위를 선택한 기간의
// 최근 위치로 되돌리고 십자선·상세 박스도 지운다(screens.md C-a 기간과 제스처). 차트(onResetView)가 floating 자리(x축 라벨 위)에 넣는다
// accessibilityLabel이 없으면 기간 차트 문구(C-b는 기준일 되돌리기 문구를 넘긴다)
export function ChartResetButton({
  onPress,
  accessibilityLabel,
}: {
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? t('chart.resetView')}
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
