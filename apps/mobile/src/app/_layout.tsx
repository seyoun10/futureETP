import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { queryClient, setupFocusManager } from '@/api/queryClient';
import { setupI18n } from '@/i18n';
import { lockPortrait } from '@/lib/orientation';
import { colors } from '@/theme/tokens';

setupFocusManager();
setupI18n();
// app config는 가로도 허용하므로(iOS 잠금 조건) 시작할 때 세로로 잠근다(D-076).
void lockPortrait();

// 알림 탭 등으로 C에 바로 들어와도 스택을 A → C로 만들어 [←]가 A로 가게 한다(screens.md X).
export const unstable_settings = { anchor: 'index' };

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={styles.root}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
