import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors } from '@/theme/tokens';

// C-d-a ETP 상세(탭 밖 스택, D-047). 제목은 상품명으로, 내용은 5-9에서 채운다.
export function EtpDetailScreen() {
  const { t } = useTranslation();

  return (
    <View style={styles.container} testID="etp-detail-screen">
      <ScreenHeader title={t('etp.detailTitle')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
