import * as Haptics from 'expo-haptics';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { showFailedAlert } from '@/lib/failedAlert';
import { perfStart } from '@/lib/perfLog';

export type OlderPagesQuery = {
  hasNextPage: boolean;
  fetchNextPage: () => Promise<{ isError: boolean }>;
};

// 이전 3년 받기가 이 시간 안에 끝나지 않으면 로딩·차단을 거두고 실패 Alert를 띄운다(D-139)
export const OLDER_TIMEOUT_MS = 5000;

// 가장 과거 봉(순번 0)이 화면에 보이면 이전 3년을 더 받는다(D-104). 보이는 범위가 바뀔 때만 확인해,
// 받기가 실패해도 같은 자리에서 반복 요청하지 않는다(다시 끌거나 축소하면 다시 시도한다).
// 받기 시작에 햅틱을 주고, 이번 회차가 끝나거나 5초가 지날 때까지 loading이다(D-108, D-139).
// 실패·시간 초과면 공통 실패 Alert. 시간 초과로 거둔 회차의 늦은 응답은 데이터만 붙이고 상태는 바꾸지 않는다
export function useOlderPages(firstVisible: number | null, query: OlderPagesQuery) {
  const { t } = useTranslation();
  const { hasNextPage } = query;
  const [loading, setLoading] = useState(false);
  // 지금 회차 번호. 시간 초과·언마운트로 거둔 회차를 무효화한다
  const run = useRef(0);
  const active = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const finish = (failed: boolean) => {
    clearTimeout(timer.current);
    run.current++;
    active.current = false;
    setLoading(false);
    if (failed) {
      showFailedAlert(
        t('chart.olderFailedTitle'),
        t('chart.olderFailedMessage'),
        t('common.confirm'),
      );
    }
  };

  const fetchOlder = useEffectEvent(async () => {
    if (active.current) return;
    const id = ++run.current;
    active.current = true;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    timer.current = setTimeout(() => {
      if (run.current === id) finish(true);
    }, OLDER_TIMEOUT_MS);
    // 요청 → 응답 → 모델 → 좌표 반영 → 보던 범위 보정까지 잰다(useChartViewport가 끝낸다).
    // 시간 초과 뒤 남은 요청이 있으면 fetchNextPage 기본값(cancelRefetch)이 그것을 버리고 새로 받는다
    perfStart('older pages');
    const result = await query.fetchNextPage();
    if (run.current === id) finish(result.isError);
  });

  useEffect(() => {
    if (firstVisible === 0 && hasNextPage) void fetchOlder();
  }, [firstVisible, hasNextPage]);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      run.current++;
    },
    [],
  );

  return { loading };
}
