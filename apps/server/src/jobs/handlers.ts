import type { JobHandlers } from './runner.ts';

// 구현된 작업만 등록한다. 스케줄러는 여기 있는 작업만 돌리고, CLI는 없는 작업이면 종료한다.
export const JOB_HANDLERS: JobHandlers = {};
