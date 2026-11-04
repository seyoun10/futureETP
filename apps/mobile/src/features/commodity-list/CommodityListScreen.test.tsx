import type { Commodities, ContractQuote, Settings } from '@futureetp/shared';
import type { ReactElement } from 'react';
import type { RefreshControlProps } from 'react-native';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { useAccessKeyStore } from '@/api/accessToken';
import { AppError } from '@/api/AppError';
import { getCommodities } from '@/api/commodities';
import { queryClient } from '@/api/queryClient';
import { queryKeys } from '@/api/queryKeys';
import { getSettings, patchSettings } from '@/api/settings';
import { useDisplaySettings } from '@/stores/displaySettings';
import { UP_DOWN_PALETTES } from '@/theme/upDownColor';

jest.mock('@/api/commodities', () => ({ getCommodities: jest.fn() }));
// 루트 레이아웃의 시간대 동기화가 설정을 조회한다
jest.mock('@/api/settings', () => ({ getSettings: jest.fn(), patchSettings: jest.fn() }));
const mockGet = jest.mocked(getCommodities);

const quote = (overrides: Partial<ContractQuote>): ContractQuote => ({
  symbol: 'GCZ26',
  contractMonth: '2026-12',
  price: 2418.2,
  change: 12.1,
  changePct: 0.5,
  noTrade: false,
  isFront: false,
  ...overrides,
});

const DATA: Commodities = {
  freshness: {
    asOf: '2026-10-22T14:45:00Z',
    tradeDate: '2026-10-22',
    delayed: true,
    marketState: 'OPEN',
    nextUpdateAt: '2026-10-22T15:05:00Z',
  },
  commodities: [
    {
      code: 'GC',
      priceDecimals: 1,
      alert: false,
      contracts: [
        quote({ isFront: true }),
        quote({
          symbol: 'GCG27',
          contractMonth: '2027-02',
          price: 2431.7,
          change: -1.2,
          changePct: -0.05,
        }),
      ],
    },
    {
      code: 'CL',
      priceDecimals: 2,
      alert: true,
      contracts: [
        quote({ symbol: 'CLZ26', price: 82, change: 2, changePct: 2.5, isFront: true }),
        quote({
          symbol: 'CLF27',
          contractMonth: '2027-01',
          price: 79,
          change: null,
          noTrade: true,
        }),
      ],
    },
  ],
};

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
  mockGet.mockReset().mockResolvedValue(DATA);
  jest
    .mocked(getSettings)
    .mockReset()
    .mockReturnValue(new Promise(() => {}));
});

const renderList = () => renderRouter('src/app', { initialUrl: '/' });

describe('A 원자재 목록', () => {
  it('기준 시각 줄과 원자재별 월물 줄을 서버 순서대로 보여 준다', async () => {
    await renderList();

    expect(await screen.findByText(/기준 · 거래일 10\/22 · 지연 · 장중$/)).toBeOnTheScreen();
    const names = screen.getAllByText(/\s\((GC|CL)\)$/).map((n) => n.props.children as string);
    expect(names).toEqual(['금\n(GC)', '원유\n(CL)']);
    const gcRow = screen.getByRole('button', { name: /금\s\(GC\)/ });
    expect(within(gcRow).getByText('DEC26●')).toBeOnTheScreen();
    expect(within(gcRow).getByText('FEB27')).toBeOnTheScreen();
    expect(within(gcRow).getByText('2,418.2')).toBeOnTheScreen();
    expect(within(gcRow).getByText('+12.1')).toBeOnTheScreen();
    expect(within(gcRow).getByText('+0.50%')).toBeOnTheScreen();
    expect(screen.getByText('82.00')).toBeOnTheScreen();
  });

  it('등락 색은 표시 설정을 따른다', async () => {
    await renderList();

    expect(await screen.findByText('+12.1')).toHaveStyle({ color: UP_DOWN_PALETTES.KR.up });
    expect(screen.getByText('-1.2')).toHaveStyle({ color: UP_DOWN_PALETTES.KR.down });
  });

  it('🔔는 알림 대상 원자재에만, 거래 없는 월물은 마지막 정산가와 거래 없음을 보여 준다', async () => {
    await renderList();

    const bells = await screen.findAllByLabelText('알림 대상');
    expect(bells).toHaveLength(1);
    const clRow = screen.getByRole('button', { name: /원유\s\(CL\)/ });
    expect(within(clRow).getByLabelText('알림 대상')).toBeOnTheScreen();
    expect(within(clRow).getByText('79.00')).toBeOnTheScreen();
    expect(within(clRow).getByText('거래 없음')).toBeOnTheScreen();
  });

  it('알림 대상 원자재가 없으면 [⚙]에 빨간 점을 띄운다', async () => {
    jest.mocked(getSettings).mockResolvedValue({ ...SETTINGS, alertCommodity: null });
    await renderList();

    expect(await screen.findByTestId('header-badge')).toBeOnTheScreen();
    expect(screen.getByLabelText('설정')).toHaveProp('accessibilityHint', '알림 꺼짐');
  });

  it('알림 대상 원자재가 있으면 [⚙]에 점이 없다', async () => {
    jest.mocked(getSettings).mockResolvedValue(SETTINGS);
    await renderList();

    await waitFor(() => expect(queryClient.getQueryData(queryKeys.settings)).toBeDefined());
    expect(screen.queryByTestId('header-badge')).not.toBeOnTheScreen();
  });

  it('B-a에서 알림 대상을 바꾸고 돌아오면 목록을 다시 조회해 🔔와 [⚙] 점이 바뀐다', async () => {
    let saved: Settings = { ...SETTINGS, alertCommodity: null };
    jest.mocked(getSettings).mockImplementation(() => Promise.resolve(saved));
    jest.mocked(patchSettings).mockImplementation((patch) => {
      saved = { ...saved, ...patch };
      return Promise.resolve(saved);
    });
    // 서버처럼 설정의 알림 대상에만 🔔를 단다
    mockGet.mockImplementation(() =>
      Promise.resolve({
        ...DATA,
        commodities: DATA.commodities.map((c) => ({
          ...c,
          alert: c.code === saved.alertCommodity,
        })),
      }),
    );
    await renderList();
    expect(await screen.findByTestId('header-badge')).toBeOnTheScreen();
    expect(screen.queryByLabelText('알림 대상')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText('설정'));
    await fireEvent.press(await screen.findByText('알림'));
    await fireEvent.press(await screen.findByRole('radio', { name: '금' }));
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
    await fireEvent.press(screen.getByLabelText('뒤로'));
    await fireEvent.press(screen.getByLabelText('뒤로'));

    expect(screen).toHavePathname('/');
    const gcRow = screen.getByRole('button', { name: /금\s\(GC\)/ });
    expect(await within(gcRow).findByLabelText('알림 대상')).toBeOnTheScreen();
    expect(screen.queryByTestId('header-badge')).not.toBeOnTheScreen();
  });

  it('원자재를 누르면 C-a로 간다', async () => {
    await renderList();
    await fireEvent.press(await screen.findByText('원유\n(CL)'));

    expect(screen).toHavePathname('/commodity/CL');
  });

  it('처음 조회가 실패하면 오류 문구와 다시 시도를 보여 주고, 다시 시도하면 목록이 뜬다', async () => {
    // 재시도하지 않는 오류
    mockGet.mockRejectedValueOnce(new AppError('SCHEMA_MISMATCH'));
    await renderList();

    expect(await screen.findByText(/앱과 서버 버전이 맞지 않습니다/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('금\n(GC)')).toBeOnTheScreen();
  });

  it('당겨서 새로고침하면 다시 조회한다', async () => {
    await renderList();
    await screen.findByText('금\n(GC)');
    // 목록 호스트 요소가 refreshControl 요소를 그대로 받는다
    const { refreshControl } = screen.getByTestId('commodity-list').props as {
      refreshControl: ReactElement<RefreshControlProps>;
    };
    await act(async () => refreshControl.props.onRefresh?.());

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
  });
});
