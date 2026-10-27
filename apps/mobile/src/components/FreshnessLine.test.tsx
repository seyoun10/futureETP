import type { Freshness } from '@futureetp/shared';
import { render, screen } from '@testing-library/react-native';
import { setupI18n } from '@/i18n';
import { useDisplaySettings } from '@/stores/displaySettings';
import { FreshnessLine } from './FreshnessLine';

setupI18n();

const freshness: Freshness = {
  asOf: '2026-10-22T14:00:00Z',
  tradeDate: '2026-10-22',
  delayed: true,
  marketState: 'OPEN',
  nextUpdateAt: null,
};

describe('FreshnessLine', () => {
  beforeEach(() => {
    useDisplaySettings.getState().setLanguage('ko');
  });

  it('기준 시각·거래일·지연·장 상태를 한 줄로 보여 준다', async () => {
    await render(<FreshnessLine freshness={freshness} />);
    expect(
      screen.getByText(/^\d{2}\/\d{2} \d{2}:\d{2} 기준 · 거래일 10\/22 · 지연 · 장중$/),
    ).toBeOnTheScreen();
  });

  it('지연이 아니면 지연을 빼고, 정산 대기를 보여 준다', async () => {
    await render(
      <FreshnessLine
        freshness={{ ...freshness, delayed: false, marketState: 'SETTLEMENT_PENDING' }}
      />,
    );
    expect(screen.getByText(/ · 거래일 10\/22 · 정산 대기$/)).toBeOnTheScreen();
  });

  it('영어 문구로 바꿀 수 있다', async () => {
    useDisplaySettings.getState().setLanguage('en');
    await render(<FreshnessLine freshness={{ ...freshness, marketState: 'CLOSED' }} />);
    expect(screen.getByText(/^As of .+ · Trade date 10\/22 · Delayed · Closed$/)).toBeOnTheScreen();
  });
});
