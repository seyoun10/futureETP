import { setNotificationHandler } from 'expo-notifications';

// 앱을 보고 있을 때 온 알림도 배너·알림 목록·소리로 띄운다. 기본은 아무것도 안 보여서 놓친다.
// Android는 소리를 끄면 배너도 안 뜬다(expo-notifications 문서). 배지는 쓰지 않는다
export function setupForegroundNotifications() {
  setNotificationHandler({
    handleNotification: () =>
      Promise.resolve({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
  });
}
