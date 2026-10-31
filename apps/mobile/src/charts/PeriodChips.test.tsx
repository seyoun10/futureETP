import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { setupI18n } from '@/i18n';
import { useDisplaySettings } from '@/stores/displaySettings';
import { PeriodChips } from './PeriodChips';

jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn() }));

setupI18n();

describe('PeriodChips', () => {
  beforeEach(() => {
    useDisplaySettings.getState().setLanguage('ko');
    jest.mocked(Haptics.selectionAsync).mockClear();
  });

  it('다른 기간을 고를 때만 햅틱을 준다', async () => {
    const onSelect = jest.fn();
    await render(<PeriodChips selected="6M" onSelect={onSelect} />);
    const radios = screen.getAllByRole('radio');

    await fireEvent.press(radios[2]); // 6M(이미 선택)
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenLastCalledWith('6M');

    await fireEvent.press(radios[5]); // 12M
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenLastCalledWith('12M');
  });
});
