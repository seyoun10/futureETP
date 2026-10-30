import { useCallback } from 'react';
import type { Freshness } from '@futureetp/shared';
import type { UseQueryResult } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { AppState } from 'react-native';

// 배치 완료 예상 시각 뒤 여유(architecture.md freshness)
export const AUTO_REFRESH_MARGIN_MS = 60 * 1000;
// 마지막 조회(성공·실패)부터 다음 자동 조회까지의 최소 간격. 예상 시각이 지났거나 조회가 계속 실패할 때 반복을 막는다.
export const AUTO_REFRESH_MIN_INTERVAL_MS = 60 * 1000;

// 일반·무한 조회 결과 모두 받는다(refetch 반환 타입만 다르다)
type FreshnessQuery = Pick<
  UseQueryResult<{ freshness: Freshness }>,
  'data' | 'dataUpdatedAt' | 'errorUpdatedAt'
> & { refetch: () => Promise<unknown> };

// 화면이 보이는 동안 `nextUpdateAt` + 1분에 다시 조회한다(D-042, D-048, D-075). null이면 자동 새로고침하지 않는다.
// 조회가 끝날 때마다(성공·실패) 다시 예약해, 새로고침이 실패해도 1분 뒤 다시 시도한다.
export function useAutoRefresh({ data, refetch, dataUpdatedAt, errorUpdatedAt }: FreshnessQuery) {
  const nextUpdateAt = data?.freshness.nextUpdateAt ?? null;
  const lastFetchedAt = Math.max(dataUpdatedAt, errorUpdatedAt);

  useFocusEffect(
    useCallback(() => {
      if (nextUpdateAt === null) return;
      const runAt = Math.max(
        Date.parse(nextUpdateAt) + AUTO_REFRESH_MARGIN_MS,
        lastFetchedAt + AUTO_REFRESH_MIN_INTERVAL_MS,
      );
      const timer = setTimeout(() => {
        // 백그라운드에서는 부르지 않는다. 앱 복귀 재조회는 focusManager가 맡는다.
        if (AppState.currentState === 'active') void refetch();
      }, runAt - Date.now());
      return () => clearTimeout(timer);
    }, [nextUpdateAt, lastFetchedAt, refetch]),
  );
}
