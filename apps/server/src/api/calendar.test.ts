import { calendarSchema } from '@futureetp/shared';
import type { CalendarException } from '@futureetp/shared';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import type { CalendarApiStore } from './calendar.ts';
import {
  UNUSED_COMMODITIES,
  UNUSED_CONTRACTS,
  UNUSED_CURVE,
  UNUSED_DEVICES,
  UNUSED_DISPARITY,
  UNUSED_ETPS,
} from './commodities.fixtures.ts';

const TOKEN = 'test-token-0123456789abcdef0123456789';

const EXCEPTIONS: CalendarException[] = [
  { market: 'CME', date: '2026-11-26', kind: 'HALT', at: '13:30', note: 'Thanksgiving Day' },
  { market: 'NYSE', date: '2026-11-26', kind: 'CLOSED', at: null, note: 'Thanksgiving Day' },
  { market: 'KRX', date: '2026-12-31', kind: 'CLOSED', at: null, note: '연말 휴장' },
];

function setup(loaded: Awaited<ReturnType<CalendarApiStore['loadedYears']>>) {
  const calls: unknown[][] = [];
  const calendar: CalendarApiStore = {
    exceptions: (from, to) => {
      calls.push(['exceptions', from, to]);
      return Promise.resolve(EXCEPTIONS);
    },
    loadedYears: (fromYear, toYear) => {
      calls.push(['loadedYears', fromYear, toYear]);
      return Promise.resolve(loaded);
    },
  };
  const app = createApp({
    token: TOKEN,
    checkDb: async () => {},
    settings: {
      get: () => Promise.reject(new Error('unused')),
      update: () => Promise.reject(new Error('unused')),
    },
    commodities: UNUSED_COMMODITIES,
    disparity: UNUSED_DISPARITY,
    curve: UNUSED_CURVE,
    contracts: UNUSED_CONTRACTS,
    devices: UNUSED_DEVICES,
    etps: UNUSED_ETPS,
    calendar,
  });
  const request = (query: string) =>
    app.request(`/v1/calendar${query}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  return { request, calls };
}

const ALL_LOADED = (['CME', 'KRX', 'NYSE'] as const).flatMap((market) =>
  [2026, 2027].map((year) => ({ market, year })),
);

describe('GET /v1/calendar', () => {
  it('범위의 예외 일정을 그대로 준다', async () => {
    const { request, calls } = setup(ALL_LOADED);
    const res = await request('?from=2026-11-01&to=2027-01-31');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown };
    expect(calendarSchema.parse(body.data)).toEqual({
      from: '2026-11-01',
      to: '2027-01-31',
      exceptions: EXCEPTIONS,
      missing: [],
    });
    expect(calls).toEqual([
      ['exceptions', '2026-11-01', '2027-01-31'],
      ['loadedYears', 2026, 2027],
    ]);
  });

  it('입력되지 않은 (시장, 연도)를 시장 순으로 알린다', async () => {
    const { request } = setup([
      { market: 'CME', year: 2026 },
      { market: 'CME', year: 2027 },
      { market: 'KRX', year: 2026 },
      { market: 'NYSE', year: 2026 },
    ]);
    const res = await request('?from=2026-12-01&to=2027-02-28');
    const body = (await res.json()) as { data: { missing: unknown } };
    expect(body.data.missing).toEqual([
      { market: 'KRX', year: 2027 },
      { market: 'NYSE', year: 2027 },
    ]);
  });

  it.each([
    ['from 없음', '?to=2026-12-31'],
    ['날짜 형식', '?from=2026-11&to=2026-12-31'],
    ['역순', '?from=2026-12-01&to=2026-11-01'],
    ['366일 초과', '?from=2026-01-01&to=2027-01-02'],
  ])('%s이면 400 VALIDATION_FAILED다', async (_, query) => {
    const { request, calls } = setup(ALL_LOADED);
    const res = await request(query);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_FAILED' },
    });
    expect(calls).toEqual([]);
  });

  it('하루 범위도 받는다', async () => {
    const { request } = setup(ALL_LOADED);
    expect((await request('?from=2026-12-31&to=2026-12-31')).status).toBe(200);
  });
});
