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

type Range = readonly [number, number] | null;
// 차트가 알리는 보이는 범위. 알릴 때마다 새 배열이다
const at = (first: number): Range => [first, first + 50];

const render = (query: ReturnType<typeof deferredQuery>['query'], range: Range = at(3)) =>
  renderHook(({ range }: { range: Range }) => useOlderPages(range, query), {
    initialProps: { range },
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

    await hook.rerender({ range: at(0) });
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
    const hook = await renderHook(() => useOlderPages(at(0), { ...query, hasNextPage: false }));
    expect(query.fetchNextPage).not.toHaveBeenCalled();
    expect(hook.result.current.loading).toBe(false);
  });

  it('5초 안에 끝나지 않으면 loading을 거두고 실패 Alert를 띄운다. 늦은 응답은 상태·Alert를 바꾸지 않는다', async () => {
    const { query, pending } = deferredQuery();
    const hook = await render(query, at(0));

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
    const hook = await render(query, at(0));

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
    const hook = await render(query, at(0));
    await act(() => jest.advanceTimersByTimeAsync(OLDER_TIMEOUT_MS));

    await hook.rerender({ range: at(2) });
    await hook.rerender({ range: at(0) });
    expect(query.fetchNextPage).toHaveBeenCalledTimes(2);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(2);
    expect(hook.result.current.loading).toBe(true);
  });

  it('실패 뒤 가장 과거 끝에서 범위가 그대로인 채 다시 끌어도 다시 받는다', async () => {
    const { query, pending } = deferredQuery();
    const edge = at(0);
    const hook = await render(query, edge);
    await act(() => {
      pending[0]!({ isError: true });
      return Promise.resolve();
    });
    // 다시 그려지기만 하면(같은 범위 배열) 받지 않는다
    await hook.rerender({ range: edge });
    expect(query.fetchNextPage).toHaveBeenCalledTimes(1);
    // 제스처가 끝나 같은 범위를 새로 알리면 다시 받는다
    await hook.rerender({ range: at(0) });
    expect(query.fetchNextPage).toHaveBeenCalledTimes(2);
    expect(hook.result.current.loading).toBe(true);
  });

  it('받는 중에는 첫 봉이 다시 보여도 겹쳐 받지 않는다', async () => {
    const { query } = deferredQuery();
    const hook = await render(query, at(0));
    await hook.rerender({ range: at(1) });
    await hook.rerender({ range: at(0) });
    expect(query.fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('화면이 사라지면 타이머를 지워 Alert를 띄우지 않는다', async () => {
    const { query } = deferredQuery();
    const hook = await render(query, at(0));
    await hook.unmount();
    await act(() => jest.advanceTimersByTimeAsync(OLDER_TIMEOUT_MS));
    expect(mockAlert).not.toHaveBeenCalled();
  });
});
