import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme/tokens';

// C-d ETP 목록 탭. 내용은 5-9에서 채운다.
export function EtpListScreen() {
  return <View style={styles.container} testID="etp-list-screen" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
