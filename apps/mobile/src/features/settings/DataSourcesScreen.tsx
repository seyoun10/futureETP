import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors } from '@/theme/tokens';

// B > 데이터 출처. 문구는 5-6에서 채운다.
export function DataSourcesScreen() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('settings.dataSources')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
