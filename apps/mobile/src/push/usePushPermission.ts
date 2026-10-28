import { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';

type PushPermission = { granted: boolean; canAskAgain: boolean };

// 알림 권한 상태. OS 설정에서 바꾸고 돌아올 수 있으므로 앱이 다시 활성화될 때마다 새로 읽는다.
// 다시 물을 수 있으면 권한 창을 띄우고, 아니면(영구 거부) 앱 설정 화면을 연다.
export function usePushPermission() {
  const [permission, setPermission] = useState<PushPermission | null>(null);

  useEffect(() => {
    const refresh = () =>
      void getPermissionsAsync().then(({ granted, canAskAgain }) =>
        setPermission({ granted, canAskAgain }),
      );
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, []);

  const request = useCallback(async () => {
    if (permission?.canAskAgain) {
      const { granted, canAskAgain } = await requestPermissionsAsync();
      setPermission({ granted, canAskAgain });
    } else {
      await Linking.openSettings();
    }
  }, [permission]);

  return { permission, request };
}
