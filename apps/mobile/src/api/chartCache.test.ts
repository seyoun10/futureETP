import { staleUntilNextUpdate } from './chartCache';

const NOW = Date.parse('2026-10-30T08:00:00.000Z');

const query = (nextUpdateAt: string | null | undefined) => ({
  state: {
    data:
      nextUpdateAt === undefined
        ? undefined
        : {
            freshness: {
              asOf: '2026-10-30T07:45:00.000Z',
              tradeDate: '2026-10-30',
              delayed: true,
              marketState: 'OPEN' as const,
              nextUpdateAt,
            },
          },
  },
});

describe('staleUntilNextUpdate', () => {
  it('nextUpdateAt까지 남은 시간을 staleTime으로 쓴다', () => {
    expect(staleUntilNextUpdate(query('2026-10-30T08:16:00.000Z'), NOW)).toBe(16 * 60 * 1000);
  });

  it('시각이 지났거나 null이거나 데이터가 없으면 0', () => {
    expect(staleUntilNextUpdate(query('2026-10-30T07:59:00.000Z'), NOW)).toBe(0);
    expect(staleUntilNextUpdate(query(null), NOW)).toBe(0);
    expect(staleUntilNextUpdate(query(undefined), NOW)).toBe(0);
  });
});
