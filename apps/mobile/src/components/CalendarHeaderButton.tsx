import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { HeaderIconButton } from '@/components/HeaderIconButton';

// A title-bar의 [📅]. 휴장 달력 화면으로 간다
export function CalendarHeaderButton() {
  const { t } = useTranslation();

  return (
    <HeaderIconButton
      icon="calendar-month-outline"
      label={t('calendar.title')}
      onPress={() => router.push('/calendar')}
    />
  );
}
