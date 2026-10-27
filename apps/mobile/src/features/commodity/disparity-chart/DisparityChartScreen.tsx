import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme/tokens';

// C-a 이격도차트 탭. 내용은 5-6에서 채운다.
export function DisparityChartScreen() {
  return <View style={styles.container} testID="disparity-chart-screen" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
