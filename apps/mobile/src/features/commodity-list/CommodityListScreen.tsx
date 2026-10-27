import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme/tokens';

// A 원자재 목록. 내용은 5-6 수직 슬라이스에서 채운다.
export function CommodityListScreen() {
  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
