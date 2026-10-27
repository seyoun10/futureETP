import { useMutation, useQueryClient } from '@tanstack/react-query';
import { saveAccessToken } from '@/api/accessToken';
import { verifyAccessKey } from '@/api/verifyAccessKey';

// 서버가 받은 키만 저장한다. 저장 뒤에는 옛 키로 실패한 조회를 다시 불러온다(D-044).
// 다시 불러오기는 기다리지 않는다. 기다리면 느린 조회(최대 timeout 15초)가 끝날 때까지 저장 중으로 남는다.
export function useSaveAccessKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (key: string) => {
      await verifyAccessKey(key);
      await saveAccessToken(key);
    },
    // 새 키의 거절은 B-b 안의 오류 줄로만 보여 준다(캐시 onError의 B-b 이동 제외).
    meta: { checksNewKey: true },
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
}
