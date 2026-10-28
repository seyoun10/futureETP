import type { EtpDetail } from '@futureetp/shared';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Linking } from 'react-native';
import { useAccessKeyStore } from '@/api/accessToken';
import { getCommodities } from '@/api/commodities';
import { getEtp, getEtps } from '@/api/etps';
import { queryClient } from '@/api/queryClient';
import { useDisplaySettings } from '@/stores/displaySettings';
import { EMPTY_COMMODITIES } from '../commodities.fixtures';

jest.mock('@/api/commodities', () => ({ getCommodities: jest.fn() }));
jest.mock('@/api/etps', () => ({ getEtps: jest.fn(), getEtp: jest.fn() }));
const mockGet = jest.mocked(getEtp);

const ID = '0b9a8f7e-6d5c-4b4a-9f3e-2d1c0b9a8f7e';
const DETAIL: EtpDetail = {
  id: ID,
  market: 'KRX',
  type: 'ETN',
  leverage: 2,
  fxHedge: 'UNHEDGED',
  name: '삼성 레버리지 WTI원유 선물 ETN',
  tickers: ['530031', '530032'],
  aum: null,
  avgTradingValue: null,
  commodityCode: 'CL',
  nameLang: 'ko',
  issuer: '삼성',
  underlyingIndex: 'S&P GSCI Crude Oil 2X Leveraged ER',
  expenseRatio: 0.65,
  issuerUrl: 'https://www.samsungetn.com/',
  listedDate: '2016-06-01',
  series: [
    { ticker: '530031', seriesCode: 'B', maturityDate: null },
    { ticker: '530032', seriesCode: 'C', maturityDate: '2031-03-15' },
  ],
  collectedAt: '2026-10-28T23:30:00.000Z',
};

beforeEach(() => {
  jest.mocked(getCommodities).mockResolvedValue(EMPTY_COMMODITIES);
  jest.mocked(getEtps).mockReturnValue(new Promise(() => {}));
  useDisplaySettings.setState({ language: 'ko', upDownStyle: 'KR' });
  useAccessKeyStore.setState({ key: 'key', rejected: false });
  queryClient.clear();
  mockGet.mockReset().mockResolvedValue(DETAIL);
});

const renderScreen = () => renderRouter('src/app', { initialUrl: `/commodity/CL/etp/${ID}` });

describe('C-d-a ETP 상세', () => {
  it('제목은 상품명이고 속성과 시리즈 줄을 보여 준다', async () => {
    await renderScreen();

    expect(await screen.findByText('0.65%')).toBeOnTheScreen();
    expect(screen.getByRole('header')).toHaveTextContent('삼성 레버리지 WTI원유 선물 ETN');
    expect(mockGet).toHaveBeenCalledWith(ID, expect.anything());
    for (const text of ['원유', 'KRX', 'ETN', '2x', '환노출', '삼성', '0.65%', '2016-06-01'])
      expect(screen.getByText(text)).toBeOnTheScreen();
    expect(
      screen.getByText('B 시리즈 · 530031\nC 시리즈 · 530032 · 만기 2031-03-15'),
    ).toBeOnTheScreen();
    expect(screen.getByText('자동 수집 정보 · 원문 언어로 표시')).toBeOnTheScreen();
  });

  it('운용사 페이지를 열고, 주소가 없으면 버튼과 빈 값은 —로 둔다', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue();
    await renderScreen();
    await fireEvent.press(await screen.findByRole('link', { name: '운용사 페이지 열기 ↗' }));
    expect(open).toHaveBeenCalledWith('https://www.samsungetn.com/');

    queryClient.clear();
    mockGet.mockResolvedValue({
      ...DETAIL,
      issuer: null,
      expenseRatio: null,
      issuerUrl: 'javascript:alert(1)',
      series: [{ ticker: '261220', seriesCode: null, maturityDate: null }],
    });
    await renderScreen();
    expect(await screen.findByText('261220')).toBeOnTheScreen();
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.queryByRole('link')).not.toBeOnTheScreen();
  });
});
