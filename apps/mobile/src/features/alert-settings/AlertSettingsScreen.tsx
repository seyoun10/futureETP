import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors } from '@/theme/tokens';

// B-a 알림 설정. 내용은 5-8에서 채운다.
export function AlertSettingsScreen() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('alertSettings.title')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
