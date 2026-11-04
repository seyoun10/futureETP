import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fontSize } from '@/theme/tokens';

// 이 기기의 알림 대상 원자재 표시(A 목록 이름 아래, C title-bar 제목 옆). 크기는 두 곳이 같다
export function AlertBell() {
  const { t } = useTranslation();
  return (
    <Text style={styles.bell} accessibilityLabel={t('commodityList.alert')}>
      🔔
    </Text>
  );
}

const styles = StyleSheet.create({
  bell: {
    fontSize: fontSize.caption,
  },
});
