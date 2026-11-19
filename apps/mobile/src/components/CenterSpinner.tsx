import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '@/theme/tokens';

// 첫 조회 중 스켈레톤 위 가운데에 겹치는 스피너. API 응답이 늦어도 불러오는 중임이 보이게 한다.
// 접근성 라벨은 감싸는 스켈레톤(progressbar)이 갖고, 터치는 막지 않는다
export function CenterSpinner() {
  return (
    <View style={styles.container} pointerEvents="none" testID="center-spinner">
      <ActivityIndicator size="large" color={colors.textSecondary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
