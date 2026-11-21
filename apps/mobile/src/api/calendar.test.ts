import { calendarSchema } from '@futureetp/shared';
import { getCalendar } from './calendar';
import { apiRequest } from './client';

jest.mock('./client', () => ({ apiRequest: jest.fn() }));
const mockRequest = jest.mocked(apiRequest);

describe('getCalendar', () => {
  it('기간을 query로 붙여 달력 스키마로 검증하고 취소 신호를 넘긴다', async () => {
    const data = { from: '2026-11-01', to: '2027-01-31', exceptions: [], missing: [] };
    mockRequest.mockResolvedValueOnce(data);
    const signal = new AbortController().signal;

    await expect(getCalendar('2026-11-01', '2027-01-31', signal)).resolves.toBe(data);
    expect(mockRequest).toHaveBeenCalledWith(
      '/calendar?from=2026-11-01&to=2027-01-31',
      calendarSchema,
      { signal },
    );
  });
});
