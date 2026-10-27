import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme/tokens';

// C-c 월물차트 탭. 내용은 5-6에서 채운다.
export function ContractChartScreen() {
  return <View style={styles.container} testID="contract-chart-screen" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
