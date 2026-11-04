import type { Settings, SettingsPatch } from '@futureetp/shared';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import { getSettings, patchSettings } from '@/api/settings';

export const settingsQuery = queryOptions({
  queryKey: queryKeys.settings,
  queryFn: ({ signal }) => getSettings(signal),
});

export const useSettings = () => useQuery(settingsQuery);

// 바꾼 값을 바로 보여 주고(낙관적 갱신) 서버 응답으로 덮는다. 실패하면 되돌린다.
// 같은 scope라 연달아 바꿔도 PATCH가 보낸 순서대로 하나씩 간다(마지막 응답 = 마지막 변경).
// 알림 대상을 바꾸면 A 목록의 🔔(응답의 `alert`)도 바뀌므로 목록을 다시 조회한다(D-124).
export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: SettingsPatch) => patchSettings(patch),
    scope: { id: 'settings' },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.settings });
      const previous = queryClient.getQueryData<Settings>(queryKeys.settings);
      if (previous)
        queryClient.setQueryData<Settings>(queryKeys.settings, { ...previous, ...patch });
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.settings, context.previous);
    },
    onSuccess: (settings, patch) => {
      queryClient.setQueryData(queryKeys.settings, settings);
      if ('alertCommodity' in patch)
        void queryClient.invalidateQueries({ queryKey: queryKeys.commodities.list() });
    },
  });
}
