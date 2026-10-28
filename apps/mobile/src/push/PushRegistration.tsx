import { addPushTokenListener } from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { registerPushDevice, setupAndroidChannels } from './registerPushDevice';

// 접근 키가 있을 때 루트 레이아웃에 붙는다. 키를 처음 저장한 직후에도 마운트되어 등록한다(architecture.md).
// 채널 이름은 표시 언어를 따르고, 등록은 마운트 때 한 번만 한다. 실패는 다음 실행 때 다시 시도한다.
export function PushRegistration() {
  const { t, i18n } = useTranslation();
  const registered = useRef(false);

  useEffect(() => {
    void (async () => {
      try {
        await setupAndroidChannels({
          alerts: t('push.channels.alerts'),
          ops: t('push.channels.ops'),
        });
        if (registered.current) return;
        registered.current = true;
        await registerPushDevice();
      } catch (error) {
        console.warn('[push] registration failed', error);
      }
    })();
  }, [i18n.language, t]);

  // FCM이 토큰을 바꾸면 새 토큰을 다시 등록한다. 옛 토큰은 발송 때 UNREGISTERED로 지워진다(D-023).
  useEffect(() => {
    const subscription = addPushTokenListener(() => {
      registerPushDevice().catch((error: unknown) => {
        console.warn('[push] re-registration failed', error);
      });
    });
    return () => subscription.remove();
  }, []);

  return null;
}
