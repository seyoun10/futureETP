import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors } from '@/theme/tokens';

// B-b 접근 키. QR·붙여넣기와 첫 실행 진입([←] 없음)은 5-5 접근 키 항목에서 채운다(D-044).
export function AccessKeyScreen() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('settings.accessKey')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
