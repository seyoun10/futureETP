import { z } from 'zod';

export const errorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export const envelopeSchema = <T extends z.ZodType>(data: T) =>
  z.discriminatedUnion('success', [
    z.object({ success: z.literal(true), data }),
    z.object({ success: z.literal(false), error: errorSchema }),
  ]);

export type ApiError = z.infer<typeof errorSchema>;
