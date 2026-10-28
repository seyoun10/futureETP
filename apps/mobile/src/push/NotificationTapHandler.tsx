import {
  addNotificationResponseReceivedListener,
  clearLastNotificationResponse,
  DEFAULT_ACTION_IDENTIFIER,
  getLastNotificationResponse,
  type NotificationResponse,
} from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { notificationHref } from './notificationHref';

// 알림을 누르면 해당 화면으로 간다(screens.md X). 앱이 꺼져 있었으면 마지막 응답을 읽고,
// 처리한 응답은 지워서 다시 마운트돼도(접근 키 재저장 등) 또 이동하지 않게 한다.
// C로 바로 들어와도 루트 anchor가 A를 아래에 둬서 [←]가 A로 간다.
// 전역 router는 상위 effect에서 연결돼 이 effect보다 늦으므로 useRouter를 쓴다.
export function NotificationTapHandler() {
  const router = useRouter();

  useEffect(() => {
    const open = (response: NotificationResponse) => {
      if (response.actionIdentifier !== DEFAULT_ACTION_IDENTIFIER) return;
      clearLastNotificationResponse();
      router.navigate(notificationHref(response.notification.request.content.data));
    };
    const last = getLastNotificationResponse();
    if (last) open(last);
    const subscription = addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [router]);

  return null;
}
