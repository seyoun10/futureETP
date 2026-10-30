import { QueryClientProvider } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAccessKeyStore, useHasAccessKey } from '@/api/accessToken';
import { queryClient, setupFocusManager } from '@/api/queryClient';
import { AccessKeyScreen } from '@/features/access-key/AccessKeyScreen';
import { TimezoneSync } from '@/features/settings/TimezoneSync';
import { setupI18n } from '@/i18n';
import { lockPortrait } from '@/lib/orientation';
import { setupForegroundNotifications } from '@/push/foregroundNotifications';
import { NotificationTapHandler } from '@/push/NotificationTapHandler';
import { PushRegistration } from '@/push/PushRegistration';
import { colors } from '@/theme/tokens';

setupFocusManager();
setupI18n();
setupForegroundNotifications();
// app config는 가로도 허용하므로(iOS 잠금 조건) 시작할 때 세로로 잠근다(D-076).
void lockPortrait();

// 알림 탭 등으로 C에 바로 들어와도 스택을 A → C로 만들어 [←]가 A로 가게 한다(screens.md X).
export const unstable_settings = { anchor: 'index' };

export default function RootLayout() {
  // 접근 키가 없으면 A 대신 B-b만 띄운다. 저장하면 스택으로 바뀐다(screens.md B-b, D-044).
  const hasKey = useHasAccessKey();
  // 저장된 키를 서버가 거절하면 어느 화면에서든 B-b로 보낸다(screens.md B-b, D-044).
  const rejected = useAccessKeyStore((state) => state.rejected);
  useEffect(() => {
    if (hasKey && rejected) router.navigate('/settings/access-key');
  }, [hasKey, rejected]);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={styles.root}>
        <StatusBar style="light" />
        {hasKey && <TimezoneSync />}
        {hasKey && <PushRegistration />}
        {hasKey ? (
          <>
            <Stack
              screenOptions={{
                headerShown: false,
                // iOS 26+ 기본 push 전환은 화면 가장자리에 밝은 테두리가 비친다. 그림자·모서리 효과 없는 전환을 쓴다.
                animation: 'simple_push',
                contentStyle: { backgroundColor: colors.background },
              }}
            />
            <NotificationTapHandler />
          </>
        ) : (
          <AccessKeyScreen />
        )}
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
