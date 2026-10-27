import { describe, expect, it } from 'vitest';
import { settingsPatchSchema } from './settings.ts';

const rejects = (body: unknown) => expect(settingsPatchSchema.safeParse(body).success).toBe(false);

describe('settingsPatchSchema', () => {
  it('보낸 필드만 남기고, rare 레벨은 오름차순으로 정렬한다', () => {
    expect(settingsPatchSchema.parse({ rareLevels: [25, 0.1, 49.9, 10.5, 3] })).toEqual({
      rareLevels: [0.1, 3, 10.5, 25, 49.9],
    });
    expect(settingsPatchSchema.parse({})).toEqual({});
  });

  it('rare 레벨은 0.1~49.9, 소수 첫째 자리까지, 서로 다른 5개', () => {
    expect(settingsPatchSchema.safeParse({ rareLevels: [0.3, 0.7, 1.1, 2.2, 33.3] }).success).toBe(
      true,
    );
    rejects({ rareLevels: [5, 10, 15, 20] });
    rejects({ rareLevels: [5, 10, 15, 20, 50] });
    rejects({ rareLevels: [0, 10, 15, 20, 25] });
    rejects({ rareLevels: [5.05, 10, 15, 20, 25] });
    rejects({ rareLevels: [5, 5, 15, 20, 25] });
  });

  it('거부 시간은 null 또는 0~1410의 30분 단위, 시작≠종료(자정 넘김 허용)', () => {
    expect(settingsPatchSchema.parse({ quietTime: null })).toEqual({ quietTime: null });
    expect(settingsPatchSchema.parse({ quietTime: { startMin: 1380, endMin: 420 } })).toEqual({
      quietTime: { startMin: 1380, endMin: 420 },
    });
    rejects({ quietTime: { startMin: 60, endMin: 60 } });
    rejects({ quietTime: { startMin: 45, endMin: 60 } });
    rejects({ quietTime: { startMin: 0, endMin: 1440 } });
    rejects({ quietTime: { startMin: 0 } });
  });

  it('시간대는 IANA 이름만, 모르는 필드·값은 거절한다', () => {
    expect(settingsPatchSchema.parse({ timezone: 'America/Chicago' })).toEqual({
      timezone: 'America/Chicago',
    });
    rejects({ timezone: 'Mars/Olympus' });
    rejects({ maPeriod: 30 });
    rejects({ alertCommodity: 'HG' });
    rejects({ theme: 'light' });
  });
});
