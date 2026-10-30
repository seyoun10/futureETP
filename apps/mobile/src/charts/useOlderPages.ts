import { useEffect, useEffectEvent } from 'react';
import { perfStart } from '@/lib/perfLog';

export type OlderPagesQuery = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
};

// 가장 과거 봉(순번 0)이 화면에 보이면 이전 3년을 더 받는다(D-104). 보이는 범위가 바뀔 때만 확인해,
// 받기가 실패해도 같은 자리에서 반복 요청하지 않는다(다시 끌거나 축소하면 다시 시도한다)
export function useOlderPages(firstVisible: number | null, query: OlderPagesQuery) {
  const { hasNextPage } = query;
  const fetchOlder = useEffectEvent(() => {
    if (query.isFetchingNextPage) return;
    // 요청 → 응답 → 모델 → 좌표 반영 → 보던 범위 보정까지 잰다(useChartViewport가 끝낸다)
    perfStart('older pages');
    void query.fetchNextPage();
  });
  useEffect(() => {
    if (firstVisible === 0 && hasNextPage) fetchOlder();
  }, [firstVisible, hasNextPage]);
}
