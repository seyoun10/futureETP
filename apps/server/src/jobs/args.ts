import { z } from 'zod';
import { JOB_NAMES, type JobName } from '../constants.ts';

const USAGE = `Usage: npm run job -- <${JOB_NAMES.join('|')}> [as-of ISO time with offset]`;

const argsSchema = z.union([
  z.tuple([z.enum(JOB_NAMES)]),
  z.tuple([z.enum(JOB_NAMES), z.iso.datetime({ offset: true })]),
]);

// `npm run job -- <작업 이름> [기준 시각]`. 기준 시각 예: 2026-10-27T18:30:00-05:00
export function parseJobArgs(argv: readonly string[]): { job: JobName; asOf?: Date } {
  const result = argsSchema.safeParse(argv);
  if (!result.success) throw new Error(`Invalid arguments: ${argv.join(' ')}\n${USAGE}`);
  const [job, asOf] = result.data;
  return asOf ? { job, asOf: new Date(asOf) } : { job };
}
