import type { EtpList, EtpSummary } from '@futureetp/shared';
import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { useAccessKeyStore } from '@/api/accessToken';
import { getCommodities } from '@/api/commodities';
import { getEtp, getEtps } from '@/api/etps';
import { queryClient } from '@/api/queryClient';
import { useDisplaySettings } from '@/stores/displaySettings';
import { EMPTY_COMMODITIES } from '../commodities.fixtures';

jest.mock('@/api/commodities', () => ({ getCommodities: jest.fn() }));
jest.mock('@/api/etps', () => ({ getEtps: jest.fn(), getEtp: jest.fn() }));
const mockGet = jest.mocked(getEtps);

const etp = (id: string, fields: Partial<EtpSummary>): EtpSummary => ({
  id,
  market: 'KRX',
  type: 'ETF',
  leverage: 1,
  fxHedge: 'HEDGED',
  name: id,
  tickers: [],
  aum: null,
  avgTradingValue: null,
  ...fields,
});

const DATA: EtpList = {
  asOf: '2026-10-28T10:56:05Z',
  etps: [
    etp('ung', {
      market: 'US',
      fxHedge: 'NA',
      name: 'United States Natural Gas',
      tickers: ['UNG'],
      aum: 1_234_567_890,
      avgTradingValue: 12_345_678,
    }),
    etp('etn', {
      type: 'ETN',
      leverage: 2,
      fxHedge: 'UNHEDGED',
      name: '삼성 레버리지 천연가스 선물 ETN',
      tickers: ['530031', '530032'],
      aum: 155_501_500_000,
    }),
    etp('kodex', {
      name: 'KODEX 천연가스선물(H)',
      tickers: ['271060'],
      aum: 35_893_665_344,
      avgTradingValue: 867_291_785,
    }),
  ],
};

beforeEach(() => {
  jest.mocked(getCommodities).mockResolvedValue(EMPTY_COMMODITIES);
  jest.mocked(getEtp).mockReturnValue(new Promise(() => {}));
  useDisplaySettings.setState({ language: 'ko', upDownStyle: 'KR' });
  useAccessKeyStore.setState({ key: 'key', rejected: false });
  queryClient.clear();
  mockGet.mockReset().mockResolvedValue(DATA);
});

const renderScreen = async () => {
  await renderRouter('src/app', { initialUrl: '/commodity/NG/etps' });
  await screen.findByText('KODEX 천연가스선물(H)');
};

// 행 제목 순서
const titles = () =>
  within(screen.getByTestId('etp-list'))
    .getAllByRole('button')
    .map((row) => within(row).getAllByText(/./)[0].props.children as string);

describe('C-d ETP 목록', () => {
  it('기본 정렬(시장 → 배수 → 이름)로 행과 속성 줄을 보여 준다', async () => {
    await renderScreen();

    expect(mockGet).toHaveBeenCalledWith('NG', expect.anything());
    // 수집 시각은 목록 안이 아니라 tab-bar 아래 기준 시각 줄에 있다
    expect(screen.getByText(/기준$/)).toBeOnTheScreen();
    expect(within(screen.getByTestId('etp-list')).queryByText(/기준$/)).not.toBeOnTheScreen();
    expect(titles()).toEqual([
      'KODEX 천연가스선물(H)',
      '삼성 레버리지 천연가스 선물 ETN',
      'UNG  United States Natural Gas',
    ]);
    expect(screen.getByText('KRX · ETF · 1x · 환헤지')).toBeOnTheScreen();
    expect(screen.getByText('KRX · ETN · 2x · 환노출')).toBeOnTheScreen();
    expect(screen.getByText('US · ETF · 1x · 해당 없음')).toBeOnTheScreen();
  });

  it('순자산·거래대금 정렬은 시장 안에서 큰 순서이고 값을 줄 끝에 붙인다', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByRole('radio', { name: '순자산' }));
    expect(titles()[0]).toBe('삼성 레버리지 천연가스 선물 ETN');
    expect(screen.getByText('KRX · ETN · 2x · 환노출 · 순자산 1,555억 원')).toBeOnTheScreen();
    expect(screen.getByText('US · ETF · 1x · 해당 없음 · 순자산 $1.2B')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: '거래대금' }));
    expect(titles()[0]).toBe('KODEX 천연가스선물(H)');
    expect(screen.getByText('KRX · ETF · 1x · 환헤지 · 거래대금 9억 원')).toBeOnTheScreen();
    expect(screen.getByText('KRX · ETN · 2x · 환노출 · 거래대금 —')).toBeOnTheScreen();
    expect(screen.getByText('US · ETF · 1x · 해당 없음 · 거래대금 $12.3M')).toBeOnTheScreen();
  });

  it('필터를 고르면 맞는 상품만, 없으면 안내 문구를 보여 준다', async () => {
    await renderScreen();

    const market = screen.getByLabelText('시장');
    await fireEvent.press(within(market).getByRole('radio', { name: 'US' }));
    expect(titles()).toEqual(['UNG  United States Natural Gas']);

    const leverage = screen.getByLabelText('배수');
    await fireEvent.press(within(leverage).getByRole('radio', { name: '2x' }));
    expect(screen.getByText('조건에 맞는 상품이 없습니다.')).toBeOnTheScreen();

    await fireEvent.press(within(market).getByRole('radio', { name: '전체' }));
    expect(titles()).toEqual(['삼성 레버리지 천연가스 선물 ETN']);
  });

  it('행을 누르면 C-d-a로 간다', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByText('KODEX 천연가스선물(H)'));

    expect(screen).toHavePathname('/commodity/NG/etp/kodex');
  });

  it('상품이 없으면 안내 문구를 보여 준다', async () => {
    mockGet.mockResolvedValue({ asOf: null, etps: [] });
    await renderRouter('src/app', { initialUrl: '/commodity/NG/etps' });

    expect(await screen.findByText('이 원자재의 ETP가 없습니다.')).toBeOnTheScreen();
  });
});
