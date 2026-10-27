import type { Settings } from '@futureetp/shared';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { useAccessKeyStore } from '@/api/accessToken';
import { AppError } from '@/api/AppError';
import { queryClient } from '@/api/queryClient';
import { queryKeys } from '@/api/queryKeys';
import { getSettings, patchSettings } from '@/api/settings';
import { useDisplaySettings } from '@/stores/displaySettings';

jest.mock('@/api/settings', () => ({ getSettings: jest.fn(), patchSettings: jest.fn() }));
const mockGet = jest.mocked(getSettings);
const mockPatch = jest.mocked(patchSettings);

const SETTINGS: Settings = {
  locale: 'ko',
  timezone: 'Asia/Seoul',
  basis: 'FRONT',
  maPeriod: 100,
  window: 'Y10',
  rareLevels: [5, 10, 15, 20, 25],
  alertCommodity: 'CL',
  quietTime: null,
};

beforeEach(() => {
  useDisplaySettings.setState({ language: 'ko', upDownStyle: 'KR' });
  useAccessKeyStore.setState({ key: 'key', rejected: false });
  queryClient.clear();
  mockGet.mockReset().mockResolvedValue(SETTINGS);
  // 서버처럼 바꾼 값을 쌓아 둔다
  let saved = SETTINGS;
  mockPatch.mockReset().mockImplementation((patch) => {
    saved = { ...saved, ...patch };
    return Promise.resolve(saved);
  });
});

const renderSettings = () => renderRouter('src/app', { initialUrl: '/settings' });

describe('B 설정', () => {
  it('서버 설정을 고른 상태로 보여 주고, 알림 행에 대상 원자재를 쓴다', async () => {
    await renderSettings();

    expect(await screen.findByRole('radio', { name: '대표월물', checked: true })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: '100', checked: true })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: '10', checked: true })).toBeOnTheScreen();
    expect(screen.getByText('원유')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: '한국어', checked: true })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: '한국식', checked: true })).toBeOnTheScreen();
  });

  it('알림이 꺼져 있으면 끔이다', async () => {
    mockGet.mockResolvedValue({ ...SETTINGS, alertCommodity: null });
    await renderSettings();

    expect(await screen.findByText('끔')).toBeOnTheScreen();
  });

  it('이격도차트 설정을 바꾸면 그 필드만 PATCH하고 바로 고른 상태가 된다', async () => {
    await renderSettings();
    await fireEvent.press(await screen.findByRole('radio', { name: '한국형' }));
    await fireEvent.press(screen.getByRole('radio', { name: '200' }));
    await fireEvent.press(screen.getByRole('radio', { name: '전체' }));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(3));
    expect(mockPatch.mock.calls.map(([patch]) => patch)).toEqual([
      { basis: 'KR' },
      { maPeriod: 200 },
      { window: 'ALL' },
    ]);
    expect(await screen.findByRole('radio', { name: '한국형', checked: true })).toBeOnTheScreen();
    expect(queryClient.getQueryData(queryKeys.settings)).toMatchObject({
      basis: 'KR',
      maPeriod: 200,
      window: 'ALL',
    });
  });

  it('저장에 실패하면 되돌리고 오류 줄을 보여 준다', async () => {
    mockPatch.mockRejectedValue(new AppError('NETWORK'));
    await renderSettings();
    await fireEvent.press(await screen.findByRole('radio', { name: '50' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '저장하지 못했습니다. 네트워크에 연결할 수 없습니다.',
    );
    expect(screen.getByRole('radio', { name: '100', checked: true })).toBeOnTheScreen();
  });

  it('언어는 기기에서 바로 바꾸고 서버에도 보낸다. 등락 색은 기기에만 둔다', async () => {
    await renderSettings();
    await screen.findByRole('radio', { name: '대표월물', checked: true });
    await fireEvent.press(screen.getByRole('radio', { name: '미국식' }));
    expect(useDisplaySettings.getState().upDownStyle).toBe('US');
    expect(mockPatch).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('radio', { name: 'English' }));
    expect(useDisplaySettings.getState().language).toBe('en');
    expect(mockPatch).toHaveBeenCalledWith({ locale: 'en' });
    expect(await screen.findByRole('header', { name: 'Settings' })).toBeOnTheScreen();
  });

  it('처음 조회가 실패하면 이격도차트 자리에 오류와 [다시 시도]를 보여 주고, 표시 설정은 쓸 수 있다', async () => {
    mockGet.mockRejectedValue(new AppError('NOT_FOUND'));
    await renderSettings();

    expect(await screen.findByText('데이터를 찾을 수 없습니다.')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: '한국어', checked: true })).toBeOnTheScreen();

    mockGet.mockResolvedValue(SETTINGS);
    await fireEvent.press(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByRole('radio', { name: '대표월물', checked: true })).toBeOnTheScreen();
  });
});

describe('B rare-level 입력', () => {
  const field = (index: number) => screen.getByLabelText(`rare-level ${index}`);
  const edit = async (index: number, text: string) => {
    await fireEvent.changeText(field(index), text);
    await fireEvent(field(index), 'endEditing');
  };

  it('서버 값을 칸에 보여 주고 범위를 안내한다', async () => {
    await renderSettings();

    expect(await screen.findByDisplayValue('25')).toBeOnTheScreen();
    expect(field(1)).toHaveDisplayValue('5');
    expect(screen.getByText('0.1~49.9, 소수 첫째 자리, 서로 다른 5개')).toBeOnTheScreen();
  });

  it('칸을 벗어날 때 맞는 값이면 정렬해 저장한다', async () => {
    await renderSettings();
    await screen.findByDisplayValue('25');
    await edit(1, '30,5');

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith({ rareLevels: [10, 15, 20, 25, 30.5] }),
    );
    await waitFor(() => expect(field(1)).toHaveDisplayValue('10'));
    expect(field(5)).toHaveDisplayValue('30.5');
  });

  it.each([
    ['범위 밖', '50', '0.1~49.9 사이 값을 소수 첫째 자리까지 입력해 주세요.'],
    ['소수 둘째 자리', '5.05', '0.1~49.9 사이 값을 소수 첫째 자리까지 입력해 주세요.'],
    ['빈 칸', '', '0.1~49.9 사이 값을 소수 첫째 자리까지 입력해 주세요.'],
    ['중복', '10', '서로 다른 값 5개를 입력해 주세요.'],
  ])('%s이면 오류를 보여 주고 저장하지 않는다', async (_case, text, message) => {
    await renderSettings();
    await screen.findByDisplayValue('25');
    await edit(1, text);

    expect(screen.getByText(message)).toBeOnTheScreen();
    expect(field(1)).toHaveDisplayValue(text);
    expect(mockPatch).not.toHaveBeenCalled();

    // 고치면 오류가 사라지고 저장된다
    await edit(1, '1');
    expect(screen.queryByText(message)).not.toBeOnTheScreen();
    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith({ rareLevels: [1, 10, 15, 20, 25] }),
    );
  });

  it('값이 그대로면 저장하지 않는다', async () => {
    await renderSettings();
    await screen.findByDisplayValue('25');
    await edit(1, '5.0');

    expect(mockPatch).not.toHaveBeenCalled();
    expect(field(1)).toHaveDisplayValue('5');
  });
});
