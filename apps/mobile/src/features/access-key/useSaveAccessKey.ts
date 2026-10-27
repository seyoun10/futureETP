import { useMutation, useQueryClient } from '@tanstack/react-query';
import { saveAccessToken } from '@/api/accessToken';
import { verifyAccessKey } from '@/api/verifyAccessKey';

// 서버가 받은 키만 저장한다. 저장 뒤에는 옛 키로 실패한 조회를 다시 불러온다(D-044).
export function useSaveAccessKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (key: string) => {
      await verifyAccessKey(key);
      await saveAccessToken(key);
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
