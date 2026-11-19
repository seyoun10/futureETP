import type { SettingsPatch } from '@futureetp/shared';
import { settingsPatchSchema } from '@futureetp/shared';
import { getCalendars } from 'expo-localization';
import { useEffect, useRef } from 'react';
import { useDisplaySettings } from '@/stores/displaySettings';
import { useSettings, useUpdateSettings } from '@/api/useSettings';

// 기기 시간대와 앱 언어가 서버 값과 다르면 PATCH한다(product.md 푸시, D-048, D-137). 푸시 토큰과 상관없이 올린다.
// 서버 언어는 푸시 문구용 사본이라(D-082), 새 기기 행의 기본값(ko)이 앱 언어와 다르면 여기서 맞춘다.
// 설정을 다시 받을 때마다(앱 복귀 포함) 비교하고, 같은 값은 한 번만 보낸다(실패해도 되풀이하지 않음).
export function DeviceSettingsSync() {
  const settings = useSettings();
  const { mutate } = useUpdateSettings();
  const language = useDisplaySettings((s) => s.language);
  const sentTimezone = useRef<string | null>(null);
  const sentLocale = useRef<string | null>(null);
  const serverTimezone = settings.data?.timezone;
  const serverLocale = settings.data?.locale;

  useEffect(() => {
    if (serverTimezone === undefined || serverLocale === undefined) return;
    const patch: SettingsPatch = {};
    const timezone = getCalendars()[0]?.timeZone;
    if (
      timezone &&
      timezone !== serverTimezone &&
      timezone !== sentTimezone.current &&
      settingsPatchSchema.safeParse({ timezone }).success
    ) {
      sentTimezone.current = timezone;
      patch.timezone = timezone;
    }
    if (language !== serverLocale && language !== sentLocale.current) {
      sentLocale.current = language;
      patch.locale = language;
    }
    if (Object.keys(patch).length > 0) mutate(patch);
  }, [serverTimezone, serverLocale, language, settings.dataUpdatedAt, mutate]);

  return null;
}
