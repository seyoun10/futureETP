import { z } from 'zod';

// GET /v1/health 응답 data(D-059, D-132). 인증 없이 배포 확인용으로 부른다
export const healthSchema = z.object({
  status: z.literal('ok'),
  // 배포 커밋. dev는 null
  commit: z.string().nullable(),
});
export type Health = z.infer<typeof healthSchema>;
