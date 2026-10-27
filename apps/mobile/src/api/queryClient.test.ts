import { AppError, isRetryable } from './AppError';
import { createQueryClient } from './queryClient';
import { queryKeys } from './queryKeys';

describe('isRetryable', () => {
  it('NETWORK·TIMEOUT·INTERNAL만 재시도한다', () => {
    expect(isRetryable(new AppError('NETWORK'))).toBe(true);
    expect(isRetryable(new AppError('TIMEOUT'))).toBe(true);
    expect(isRetryable(new AppError('INTERNAL'))).toBe(true);
    expect(isRetryable(new AppError('UNAUTHORIZED'))).toBe(false);
    expect(isRetryable(new AppError('SCHEMA_MISMATCH'))).toBe(false);
    expect(isRetryable(new Error('bug'))).toBe(false);
  });
});

describe('createQueryClient', () => {
  const fetchCount = async (error: Error) => {
    const client = createQueryClient();
    const queryFn = jest.fn().mockRejectedValue(error);
    await expect(client.fetchQuery({ queryKey: ['t'], queryFn, retryDelay: 0 })).rejects.toBe(
      error,
    );
    client.clear();
    return queryFn.mock.calls.length;
  };

  it('재시도 대상은 최대 2회 더 부른다', async () => {
    expect(await fetchCount(new AppError('INTERNAL'))).toBe(3);
  });

  it('4xx·SCHEMA_MISMATCH는 재시도하지 않는다', async () => {
    expect(await fetchCount(new AppError('VALIDATION_FAILED'))).toBe(1);
    expect(await fetchCount(new AppError('SCHEMA_MISMATCH'))).toBe(1);
  });

  it('mutation은 재시도하지 않는다', () => {
    expect(createQueryClient().getDefaultOptions().mutations?.retry).toBe(false);
  });
});

describe('queryKeys', () => {
  it('원자재 조회는 원자재 key를 접두로 공유한다', () => {
    const prefix = queryKeys.commodities.detail('GC');
    for (const key of [
      queryKeys.commodities.disparity('GC', { basis: 'KR', ma: 200, window: 'Y10' }),
      queryKeys.commodities.curve('GC', null),
      queryKeys.commodities.contracts('GC'),
      queryKeys.commodities.etps('GC'),
    ]) {
      expect(key.slice(0, prefix.length)).toEqual(prefix);
    }
  });
});
