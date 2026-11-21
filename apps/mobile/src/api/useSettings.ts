import type { Settings, SettingsPatch } from '@futureetp/shared';
import {
  queryOptions,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import { queryKeys } from './queryKeys';
import { getSettings, patchSettings } from './settings';

export const settingsQuery = queryOptions({
  queryKey: queryKeys.settings,
  queryFn: ({ signal }) => getSettings(signal),
});

const updateSettingsKey = [...queryKeys.settings, 'update'] as const;

// 서버 값(캐시) 위에 아직 끝나지 않은 변경을 보낸 순서대로 얹어 보여 준다(낙관적 갱신).
// 캐시에는 서버가 확인한 값만 두므로, 연달아 바꾸다 일부가 실패해도 되돌릴 값을 따로 기억하지 않는다.
export function useSettings(): Omit<UseQueryResult<Settings>, 'data'> & {
  data: Settings | undefined;
} {
  const query = useQuery(settingsQuery);
  const pending = useMutationState({
    filters: { mutationKey: updateSettingsKey, status: 'pending' },
    select: (mutation) => mutation.state.variables as SettingsPatch,
  });
  const data = useMemo(
    () =>
      query.data && pending.length > 0
        ? pending.reduce<Settings>((acc, patch) => ({ ...acc, ...patch }), query.data)
        : query.data,
    [query.data, pending],
  );
  return { ...query, data };
}

// 같은 scope라 연달아 바꿔도 PATCH가 보낸 순서대로 하나씩 간다. 응답은 그 시점의 서버 값이라 받는 대로 캐시에 넣고,
// 실패하면 그 변경만 빠진다(useSettings). 알림 대상을 바꾸면 A 목록의 🔔(응답의 `alert`)도 바뀌므로 목록을 다시 조회한다(D-124).
export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: updateSettingsKey,
    mutationFn: (patch: SettingsPatch) => patchSettings(patch),
    scope: { id: 'settings' },
    // 진행 중인 설정 조회가 PATCH보다 늦게 끝나 옛 값으로 덮지 않게 끊는다
    onMutate: () => queryClient.cancelQueries({ queryKey: queryKeys.settings }),
    // 그사이 시작된 조회(마운트 재조회 등)는 PATCH 반영 전 값을 읽었을 수 있어 끊고 응답 값을 넣는다
    onSuccess: async (settings, patch) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.settings });
      queryClient.setQueryData(queryKeys.settings, settings);
      if ('alertCommodity' in patch)
        void queryClient.invalidateQueries({ queryKey: queryKeys.commodities.list() });
    },
    // onMutate가 끊은 첫 조회는 다시 시작할 계기가 없어 실패하면 다시 조회한다.
    // 응답을 못 받았을 뿐 서버에는 반영됐을 수도 있어 첫 조회가 아니어도 서버 값을 다시 맞춘다.
    // 기다리면 조회가 끝날 때까지 실패한 변경이 화면에 남고 다음 PATCH도 밀려서 기다리지 않는다
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    },
  });
}
