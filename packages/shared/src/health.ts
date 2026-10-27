import { z } from 'zod';

// GET /v1/health 응답 data(D-059). 인증 없이 부르는 배포 확인용이다.
export const healthSchema = z.object({ status: z.literal('ok') });
export type Health = z.infer<typeof healthSchema>;
