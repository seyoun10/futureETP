import type { Freshness } from '@futureetp/shared';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { router } from 'expo-router';
import { AppState, Pressable, Text } from 'react-native';
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
