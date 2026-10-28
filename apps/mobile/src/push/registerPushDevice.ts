import type { AndroidChannel, Platform as DevicePlatform } from '@futureetp/shared';
import Constants from 'expo-constants';
import {
  AndroidImportance,
  getDevicePushTokenAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  setNotificationChannelAsync,
} from 'expo-notifications';
import { Platform } from 'react-native';
import { registerDevice } from '@/api/devices';

// 서버가 보내는 Android 채널(shared ANDROID_CHANNELS). 운영 알림은 따로 끌 수 있게 나눈다(D-045).
// 이미 있는 채널에 다시 부르면 이름만 바뀐다(중요도는 OS 설정이 우선).
const CHANNEL_IMPORTANCE: Record<AndroidChannel, AndroidImportance> = {
  alerts: AndroidImportance.HIGH,
  ops: AndroidImportance.DEFAULT,
};

export async function setupAndroidChannels(names: Record<AndroidChannel, string>) {
  if (Platform.OS !== 'android') return;
  for (const [id, importance] of Object.entries(CHANNEL_IMPORTANCE)) {
    await setNotificationChannelAsync(id, { name: names[id as AndroidChannel], importance });
  }
}

// Android 13+는 채널이 있어야 권한 창이 뜬다. 거부돼도 토큰은 받아 등록한다(권한을 나중에 켜면 바로 받음).
async function ensurePermission() {
  const current = await getPermissionsAsync();
  if (current.granted || !current.canAskAgain) return;
  await requestPermissionsAsync();
}

const PLATFORM: Partial<Record<typeof Platform.OS, DevicePlatform>> = {
  android: 'ANDROID',
  ios: 'IOS',
};

// 앱 실행 때 네이티브 토큰(FCM·APNs)을 받아 PUT /v1/devices로 등록한다(D-037, D-048).
// 토큰을 못 받으면(Apple 가입 전 iOS 등) 등록하지 않는다. 등록한 토큰을 돌려준다.
export async function registerPushDevice(): Promise<string | null> {
  const platform = PLATFORM[Platform.OS];
  if (platform === undefined) return null;
  await ensurePermission();
  // data는 웹에서만 객체라 any로 선언돼 있다
  const data: unknown = (await getDevicePushTokenAsync()).data;
  if (typeof data !== 'string' || data === '') return null;
  await registerDevice({
    pushToken: data,
    platform,
    appVersion: Constants.expoConfig?.version ?? null,
  });
  return data;
}
