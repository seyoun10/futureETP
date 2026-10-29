import { setNotificationHandler, type Notification } from 'expo-notifications';
import { setupForegroundNotifications } from './foregroundNotifications';

describe('setupForegroundNotifications', () => {
  it('앱을 보고 있을 때도 배너·목록·소리로 띄우고 배지는 바꾸지 않는다', async () => {
    setupForegroundNotifications();
    const handler = jest.mocked(setNotificationHandler).mock.lastCall?.[0];
    await expect(handler?.handleNotification({} as Notification)).resolves.toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    });
  });
});
