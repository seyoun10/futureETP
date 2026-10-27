import { settingsPatchSchema } from '@futureetp/shared';
import { getCalendars } from 'expo-localization';
import { useEffect, useRef } from 'react';
import { useSettings, useUpdateSettings } from './useSettings';

// 기기 시간대가 서버 값과 다르면 PATCH한다(product.md 푸시, D-048). 푸시 토큰과 상관없이 올린다.
// 설정을 다시 받을 때마다(앱 복귀 포함) 비교하고, 같은 시간대는 한 번만 보낸다(실패해도 되풀이하지 않음).
export function TimezoneSync() {
  const settings = useSettings();
  const { mutate } = useUpdateSettings();
  const sent = useRef<string | null>(null);
  const serverTimezone = settings.data?.timezone;

  useEffect(() => {
    if (serverTimezone === undefined) return;
    const timezone = getCalendars()[0]?.timeZone;
    if (!timezone || timezone === serverTimezone || timezone === sent.current) return;
    if (!settingsPatchSchema.safeParse({ timezone }).success) return;
    sent.current = timezone;
    mutate({ timezone });
  }, [serverTimezone, settings.dataUpdatedAt, mutate]);

  return null;
}
