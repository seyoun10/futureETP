import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme/tokens';

// C-b 월물커브 탭. 내용은 5-6에서 채운다.
export function CurveScreen() {
  return <View style={styles.container} testID="curve-screen" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
