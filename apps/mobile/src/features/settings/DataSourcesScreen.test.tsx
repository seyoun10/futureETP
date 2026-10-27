import { renderRouter, screen } from 'expo-router/testing-library';
import { useAccessKeyStore } from '@/api/accessToken';
import { queryClient } from '@/api/queryClient';
import { getSettings } from '@/api/settings';
import { useDisplaySettings } from '@/stores/displaySettings';

// 루트 레이아웃의 시간대 동기화가 설정을 조회한다
jest.mock('@/api/settings', () => ({ getSettings: jest.fn(), patchSettings: jest.fn() }));

beforeEach(() => {
  useAccessKeyStore.setState({ key: 'key', rejected: false });
  queryClient.clear();
  jest.mocked(getSettings).mockReturnValue(new Promise(() => {}));
});

const renderDataSources = () => renderRouter('src/app', { initialUrl: '/settings/data-sources' });

describe('데이터 출처', () => {
  it('출처 줄과 안내 문구를 보여 준다', async () => {
    useDisplaySettings.setState({ language: 'ko' });
    await renderDataSources();

    expect(screen.getByRole('header', { name: '데이터 출처' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: '선물 시세' })).toBeOnTheScreen();
    expect(screen.getByText('정산가·거래량')).toBeOnTheScreen();
    expect(screen.getByText('Yahoo Finance · 약 10분 지연')).toBeOnTheScreen();
    expect(screen.getByText('Databento (2010-06~)')).toBeOnTheScreen();
    expect(screen.getByText('네이버 증권, KRX')).toBeOnTheScreen();
    expect(screen.getByText(/투자 권유가 아닙니다/)).toBeOnTheScreen();
  });

  it('영어로 바꾸면 영어 문구를 보여 준다', async () => {
    useDisplaySettings.setState({ language: 'en' });
    await renderDataSources();

    expect(screen.getByRole('header', { name: 'Data sources' })).toBeOnTheScreen();
    expect(screen.getByText('Massive, after close')).toBeOnTheScreen();
    expect(screen.getByText(/not investment advice/)).toBeOnTheScreen();
  });
});
