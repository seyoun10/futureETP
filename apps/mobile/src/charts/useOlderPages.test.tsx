import * as Haptics from 'expo-haptics';
import { act, renderHook } from '@testing-library/react-native';
import { setupI18n } from '@/i18n';
import { showFailedAlert } from '@/lib/failedAlert';
import { useDisplaySettings } from '@/stores/displaySettings';
import { OLDER_TIMEOUT_MS, useOlderPages } from './useOlderPages';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('@/lib/failedAlert', () => ({ showFailedAlert: jest.fn() }));
const mockAlert = jest.mocked(showFailedAlert);

useDisplaySettings.setState({ language: 'ko' });
setupI18n();

// 응답을 테스트가 정하는 fetchNextPage
const deferredQuery = () => {
  const pending: ((r: { isError: boolean }) => void)[] = [];
  const fetchNextPage = jest.fn(
    () => new Promise<{ isError: boolean }>((resolve) => pending.push(resolve)),
  );
  return { query: { hasNextPage: true, fetchNextPage }, pending };
};

const render = (query: ReturnType<typeof deferredQuery>['query'], first: number | null = 3) =>
  renderHook(({ first }: { first: number | null }) => useOlderPages(first, query), {
    initialProps: { first },
  });

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(Haptics.impactAsync).mockClear();
  mockAlert.mockClear();
});
afterEach(() => jest.useRealTimers());

describe('useOlderPages', () => {
  it('가장 과거 봉이 보이면 햅틱과 함께 받기 시작해, 끝날 때까지 loading이다', async () => {
    const { query, pending } = deferredQuery();
    const hook = await render(query);
    expect(query.fetchNextPage).not.toHaveBeenCalled();

    await hook.rerender({ first: 0 });
    expect(query.fetchNextPage).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(hook.result.current.loading).toBe(true);

    await act(() => {
      pending[0]!({ isError: false });
      return Promise.resolve();
    });
    expect(hook.result.current.loading).toBe(false);
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('받을 게 없으면 받지 않는다', async () => {
    const { query } = deferredQuery();
    const hook = await renderHook(() => useOlderPages(0, { ...query, hasNextPage: false }));
    expect(query.fetchNextPage).not.toHaveBeenCalled();
    expect(hook.result.current.loading).toBe(false);
  });

  it('5초 안에 끝나지 않으면 loading을 거두고 실패 Alert를 띄운다. 늦은 응답은 상태·Alert를 바꾸지 않는다', async () => {
    const { query, pending } = deferredQuery();
    const hook = await render(query, 0);

    await act(() => jest.advanceTimersByTimeAsync(OLDER_TIMEOUT_MS - 1));
    expect(hook.result.current.loading).toBe(true);
    await act(() => jest.advanceTimersByTimeAsync(1));
    expect(hook.result.current.loading).toBe(false);
    expect(mockAlert).toHaveBeenCalledWith(
      '과거 데이터를 불러오지 못했습니다',
      '잠시 뒤 차트를 다시 끌어 주세요.',
      '확인',
    );

    await act(() => {
      pending[0]!({ isError: true });
      return Promise.resolve();
    });
    expect(hook.result.current.loading).toBe(false);
    expect(mockAlert).toHaveBeenCalledTimes(1);
  });

  it('받기가 실패하면 loading을 거두고 실패 Alert를 띄운다', async () => {
    const { query, pending } = deferredQuery();
    const hook = await render(query, 0);

    await act(() => {
      pending[0]!({ isError: true });
      return Promise.resolve();
    });
    expect(hook.result.current.loading).toBe(false);
    expect(mockAlert).toHaveBeenCalledTimes(1);
    // 끝난 회차의 타이머는 남지 않는다
    await act(() => jest.advanceTimersByTimeAsync(OLDER_TIMEOUT_MS));
    expect(mockAlert).toHaveBeenCalledTimes(1);
  });

  it('시간 초과 뒤 차트를 다시 끌어 첫 봉이 보이면 다시 받는다', async () => {
    const { query } = deferredQuery();
    const hook = await render(query, 0);
    await act(() => jest.advanceTimersByTimeAsync(OLDER_TIMEOUT_MS));

    await hook.rerender({ first: 2 });
    await hook.rerender({ first: 0 });
    expect(query.fetchNextPage).toHaveBeenCalledTimes(2);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(2);
    expect(hook.result.current.loading).toBe(true);
  });

  it('받는 중에는 첫 봉이 다시 보여도 겹쳐 받지 않는다', async () => {
    const { query } = deferredQuery();
    const hook = await render(query, 0);
    await hook.rerender({ first: 1 });
    await hook.rerender({ first: 0 });
    expect(query.fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('화면이 사라지면 타이머를 지워 Alert를 띄우지 않는다', async () => {
    const { query } = deferredQuery();
    const hook = await render(query, 0);
    await hook.unmount();
    await act(() => jest.advanceTimersByTimeAsync(OLDER_TIMEOUT_MS));
    expect(mockAlert).not.toHaveBeenCalled();
  });
});
