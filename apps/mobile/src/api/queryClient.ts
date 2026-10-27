import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';
import { isRetryable } from './AppError';

const MAX_RETRIES = 2;

// 재시도 규칙(D-042): NETWORK·TIMEOUT·INTERNAL만 최대 2회, mutation은 자동 재시도하지 않는다.
// 오프라인을 지원하지 않아 캐시를 기기에 저장하지 않는다(D-030).
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => failureCount < MAX_RETRIES && isRetryable(error),
      },
      mutations: { retry: false },
    },
  });
}

export const queryClient = createQueryClient();

// 앱 복귀 때 오래된 query를 다시 조회한다(D-030). 앱 시작 때 한 번 부른다.
export function setupFocusManager() {
  if (Platform.OS === 'web') return;
  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener('change', (state) => {
      handleFocus(state === 'active');
    });
    return () => subscription.remove();
  });
}
