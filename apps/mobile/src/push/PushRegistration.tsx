import { addPushTokenListener } from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { registerPushDevice, registerPushToken, setupAndroidChannels } from './registerPushDevice';

// 접근 키가 있을 때 루트 레이아웃에 붙는다. 키를 처음 저장한 직후에도 마운트되어 등록한다(architecture.md).
// 채널 이름은 표시 언어를 따르고, 등록은 마운트 때 한 번만 한다. 실패는 다음 실행 때 다시 시도한다.
export function PushRegistration() {
  const { t, i18n } = useTranslation();
  const registered = useRef(false);
  // 마지막으로 등록한(또는 등록 중인) 토큰. 같은 토큰 이벤트는 다시 등록하지 않는다
  const lastToken = useRef<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        await setupAndroidChannels({
          alerts: t('push.channels.alerts'),
          ops: t('push.channels.ops'),
        });
        if (registered.current) return;
        registered.current = true;
        lastToken.current = await registerPushDevice();
      } catch (error) {
        console.warn('[push] registration failed', error);
      }
    })();
  }, [i18n.language, t]);

  // FCM이 토큰을 바꾸면 새 토큰을 다시 등록한다. 옛 토큰은 발송 때 UNREGISTERED로 지워진다(D-023).
  // 토큰을 다시 조회하지 않고 이벤트의 토큰을 쓴다(registerPushToken 주석). 첫 등록과 겹치면 한 번 더 등록될 수 있다(PUT이라 무해).
  useEffect(() => {
    const subscription = addPushTokenListener(({ data }) => {
      if (typeof data !== 'string' || data === '' || data === lastToken.current) return;
      lastToken.current = data;
      registerPushToken(data).catch((error: unknown) => {
        lastToken.current = null;
        console.warn('[push] re-registration failed', error);
      });
    });
    return () => subscription.remove();
  }, []);

  return null;
}
