import type { UseQueryResult } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AppError } from '@/api/AppError';
import { setupI18n } from '@/i18n';
import { useDisplaySettings } from '@/stores/displaySettings';
import { QueryStateView } from './QueryStateView';

setupI18n();

// 분기에 쓰는 필드만 채운 query 결과
const query = (state: Partial<UseQueryResult<string>>) =>
  ({
    data: undefined,
    error: null,
    isError: false,
    isFetching: false,
    refetch: jest.fn(),
    ...state,
  }) as unknown as UseQueryResult<string>;

const renderView = (state: Partial<UseQueryResult<string>>) =>
  render(<QueryStateView query={query(state)}>{(data) => <Text>{data}</Text>}</QueryStateView>);

describe('QueryStateView', () => {
  beforeEach(() => {
    useDisplaySettings.getState().setLanguage('ko');
  });

  it('처음 로딩 중에는 스켈레톤을 보여 준다', async () => {
    await renderView({ isFetching: true });
    expect(screen.getByLabelText('불러오는 중')).toBeOnTheScreen();
  });

  it('처음 로딩이 실패하면 code 문구와 [다시 시도]를 보여 주고, 누르면 다시 조회한다', async () => {
    const refetch = jest.fn();
    await renderView({ isError: true, error: new AppError('NETWORK'), refetch });

    expect(screen.getByText('네트워크에 연결할 수 없습니다.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: '다시 시도' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('다시 시도 중에는 오류 대신 스켈레톤이다', async () => {
    await renderView({ isError: true, error: new AppError('NETWORK'), isFetching: true });
    expect(screen.getByLabelText('불러오는 중')).toBeOnTheScreen();
    expect(screen.queryByText('다시 시도')).not.toBeOnTheScreen();
  });

  it('AppError가 아닌 오류는 서버 오류 문구다', async () => {
    await renderView({ isError: true, error: new Error('boom') });
    expect(screen.getByText(/서버에 문제가 생겼습니다/)).toBeOnTheScreen();
  });

  it('데이터가 있으면 새로고침이 실패해도 데이터를 보여 준다', async () => {
    await renderView({ data: '이전 값', isError: true, error: new AppError('TIMEOUT') });
    expect(screen.getByText('이전 값')).toBeOnTheScreen();
    expect(screen.queryByText('다시 시도')).not.toBeOnTheScreen();
  });
});
