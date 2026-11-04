import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { useSettings } from './useSettings';

// A·C title-bar의 [⚙]. 이 기기의 알림 대상 원자재가 없으면(B 알림 행 "끔") 빨간 점을 띄운다.
// 설정을 받기 전이나 조회가 실패하면 점을 띄우지 않는다.
export function SettingsHeaderButton({ compact }: { compact?: boolean }) {
  const { t } = useTranslation();
  const { data } = useSettings();
  const alertOff = data !== undefined && data.alertCommodity === null;

  return (
    <HeaderIconButton
      icon="cog-outline"
      label={t('settings.title')}
      compact={compact}
      badge={alertOff ? t('settings.alertOffBadge') : undefined}
      onPress={() => router.push('/settings')}
    />
  );
}
