import { StyleSheet, View } from 'react-native';

// A 원자재 목록. 테마 토큰(D-031)과 i18n(D-033)은 이후 단계에서 붙인다.
export function CommodityListScreen() {
  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
