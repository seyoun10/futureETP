import type { Freshness } from '@futureetp/shared';
import {
  QueryClientProvider,
  useInfiniteQuery,
  type FetchNextPageOptions,
  type InfiniteData,
  type InfiniteQueryObserverResult,
} from '@tanstack/react-query';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { router } from 'expo-router';
import { AppState, Pressable, Text } from 'react-native';
import { createQueryClient } from './queryClient';
import { useAutoRefresh } from './useAutoRefresh';

const NOW = new Date('2026-10-22T14:00:00Z');
const MINUTE = 60 * 1000;

const freshness = (nextUpdateAt: string | null): Freshness => ({
  asOf: '2026-10-22T13:50:00Z',
  tradeDate: '2026-10-22',
  delayed: true,
  marketState: 'OPEN',
  nextUpdateAt,
});

const renderWith = (
  nextUpdateAt: string | null,
  refetch: jest.Mock,
  { dataUpdatedAt = NOW.getTime(), errorUpdatedAt = 0 } = {},
) => {
  function Screen() {
    useAutoRefresh({
      data: { freshness: freshness(nextUpdateAt) },
      refetch,
      dataUpdatedAt,
      errorUpdatedAt,
    });
    return (
      <Pressable onPress={() => router.push('/settings')}>
        <Text>go</Text>
      </Pressable>
    );
  }
  return renderRouter({ index: Screen, settings: () => null });
};

// RN Jest mock의 currentState는 값이 아니라 jest.fn이라 값으로 덮어쓴다
const setAppState = (state: string) =>
  Object.defineProperty(AppState, 'currentState', { value: state, configurable: true });

const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));

describe('useAutoRefresh', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    setAppState('active');
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('nextUpdateAt + 1분에 다시 조회한다', async () => {
    const refetch = jest.fn();
    await renderWith('2026-10-22T14:05:00Z', refetch);

    await advance(6 * MINUTE - 1);
    expect(refetch).not.toHaveBeenCalled();
    await advance(1);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('진행 중인 조회(과거 받기 등)를 취소하지 않도록 cancelRefetch: false로 부른다', async () => {
    const refetch = jest.fn();
    await renderWith('2026-10-22T14:05:00Z', refetch);

    await advance(6 * MINUTE);
    expect(refetch).toHaveBeenCalledWith({ cancelRefetch: false });
  });

  it('nextUpdateAt이 이미 지났으면 마지막 조회 1분 뒤에 다시 조회한다', async () => {
    const refetch = jest.fn();
    await renderWith('2026-10-22T13:00:00Z', refetch);

    await advance(MINUTE - 1);
    expect(refetch).not.toHaveBeenCalled();
    await advance(1);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('마지막 조회가 오래전이고 nextUpdateAt이 지났으면 바로 다시 조회한다', async () => {
    const refetch = jest.fn();
    await renderWith('2026-10-22T13:00:00Z', refetch, {
      dataUpdatedAt: NOW.getTime() - 30 * MINUTE,
    });

    await advance(0);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('조회가 실패한 시각도 마지막 조회로 친다', async () => {
    const refetch = jest.fn();
    await renderWith('2026-10-22T13:00:00Z', refetch, {
      dataUpdatedAt: NOW.getTime() - 30 * MINUTE,
      errorUpdatedAt: NOW.getTime(),
    });

    await advance(MINUTE - 1);
    expect(refetch).not.toHaveBeenCalled();
    await advance(1);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('nextUpdateAt이 null이면 자동 새로고침하지 않는다', async () => {
    const refetch = jest.fn();
    await renderWith(null, refetch);

    await advance(24 * 60 * MINUTE);
    expect(refetch).not.toHaveBeenCalled();
  });

  it('앱이 백그라운드면 부르지 않는다', async () => {
    const refetch = jest.fn();
    await renderWith('2026-10-22T14:05:00Z', refetch);
    setAppState('background');

    await advance(6 * MINUTE);
    expect(refetch).not.toHaveBeenCalled();
  });

  it('다른 화면으로 가면 예약을 취소한다', async () => {
    const refetch = jest.fn();
    await renderWith('2026-10-22T14:05:00Z', refetch);
    await fireEvent.press(screen.getByText('go'));

    await advance(10 * MINUTE);
    expect(refetch).not.toHaveBeenCalled();
  });
});

// 실제 QueryClient의 무한 조회에서, 과거 받기 중에 자동 새로고침 시각이 와도 받은 페이지가 살아남는지 본다
describe('useAutoRefresh + useInfiniteQuery', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    setAppState('active');
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  type Page = { freshness: Freshness; page: number };
  type OlderResult = InfiniteQueryObserverResult<InfiniteData<Page>>;

  it('진행 중인 과거 받기를 취소하지 않고, 받은 페이지가 붙는다', async () => {
    const client = createQueryClient();
    const resolveOlder: ((page: Page) => void)[] = [];
    const queryFn = jest.fn(({ pageParam }: { pageParam: number }) =>
      pageParam === 0
        ? Promise.resolve({ freshness: freshness('2026-10-22T14:05:00Z'), page: 0 })
        : new Promise<Page>((resolve) => resolveOlder.push(resolve)),
    );
    let fetchNextPage: ((o?: FetchNextPageOptions) => Promise<OlderResult>) | null = null;
    let pages: number[] = [];

    function Screen() {
      const query = useInfiniteQuery({
        queryKey: ['auto-refresh-older'],
        queryFn,
        initialPageParam: 0,
        getNextPageParam: (last: Page) => last.page + 1,
      });
      useAutoRefresh({
        data: query.data?.pages[0],
        refetch: query.refetch,
        dataUpdatedAt: query.dataUpdatedAt,
        errorUpdatedAt: query.errorUpdatedAt,
      });
      fetchNextPage = query.fetchNextPage;
      pages = query.data?.pages.map((p) => p.page) ?? [];
      return null;
    }
    const view = await renderRouter(
      {
        index: () => (
          <QueryClientProvider client={client}>
            <Screen />
          </QueryClientProvider>
        ),
      },
      {},
    );
    await act(() => jest.advanceTimersByTimeAsync(0));
    expect(pages).toEqual([0]);

    // 과거 받기를 시작한 채로 자동 새로고침 시각(nextUpdateAt + 1분)을 넘긴다
    let older: Promise<OlderResult> | undefined;
    await act(() => {
      older = fetchNextPage!();
      return Promise.resolve();
    });
    await act(() => jest.advanceTimersByTimeAsync(6 * MINUTE));

    await act(async () => {
      resolveOlder[0]!({ freshness: freshness('2026-10-22T14:05:00Z'), page: 1 });
      await older;
    });
    // 취소됐다면 받은 페이지를 버리고 첫 페이지만 남는다
    const result = await older!;
    expect(result.isError).toBe(false);
    expect(result.data?.pages.map((p) => p.page)).toEqual([0, 1]);
    expect(queryFn).toHaveBeenCalledTimes(2);
    // 가짜 타이머일 때 내려야 gc 타이머가 실제 타이머로 남아 Jest 종료를 막지 않는다
    await view.unmount();
    client.clear();
  });
});
