import { envelopeSchema } from '@futureetp/shared';
import { z } from 'zod';

const parsed = envelopeSchema(z.object({ ok: z.boolean() })).parse({ success: true, data: { ok: true } });
console.log(JSON.stringify(parsed));
