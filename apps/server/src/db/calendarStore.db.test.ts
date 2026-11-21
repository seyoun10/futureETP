import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createCalendarStore } from './calendarStore.ts';
import { db } from './client.ts';
import { calendarException } from './schema.ts';
import { resetDb } from './testDb.ts';

const store = createCalendarStore(db);

beforeEach(async () => {
  await resetDb(db);
  await db.insert(calendarException).values([
    { market: 'NYSE', date: '2026-11-26', kind: 'CLOSED', at: null, note: 'Thanksgiving Day' },
    { market: 'CME', date: '2026-11-26', kind: 'HALT', at: '13:30', note: 'Thanksgiving Day' },
    { market: 'KRX', date: '2026-12-31', kind: 'CLOSED', at: null, note: '연말 휴장' },
    { market: 'CME', date: '2027-01-01', kind: 'CLOSED', at: null, note: "New Year's Day" },
    { market: 'CME', date: '2027-03-26', kind: 'CLOSED', at: null, note: 'Good Friday' },
  ]);
});
afterAll(() => db.$client.end());

describe('calendar store', () => {
  it('exceptions는 범위 안 행을 날짜·시장 순으로 준다', async () => {
    expect(await store.exceptions('2026-11-26', '2027-01-01')).toEqual([
      { market: 'CME', date: '2026-11-26', kind: 'HALT', at: '13:30', note: 'Thanksgiving Day' },
      { market: 'NYSE', date: '2026-11-26', kind: 'CLOSED', at: null, note: 'Thanksgiving Day' },
      { market: 'KRX', date: '2026-12-31', kind: 'CLOSED', at: null, note: '연말 휴장' },
      { market: 'CME', date: '2027-01-01', kind: 'CLOSED', at: null, note: "New Year's Day" },
    ]);
  });

  it('loadedYears는 행이 있는 (시장, 연도)만 준다', async () => {
    const loaded = await store.loadedYears(2026, 2027);
    expect(loaded).toHaveLength(4);
    expect(loaded).toEqual(
      expect.arrayContaining([
        { market: 'CME', year: 2026 },
        { market: 'NYSE', year: 2026 },
        { market: 'KRX', year: 2026 },
        { market: 'CME', year: 2027 },
      ]),
    );
  });
});
