import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { setupI18n } from '@/i18n';
import { openAndroidBaseDatePicker } from './BaseDatePicker';
import { formatWeekday, fromPickerDate, toPickerDate } from './curveModel';

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: { open: jest.fn() },
}));
const mockOpen = jest.mocked(DateTimePickerAndroid.open);
const i18n = setupI18n();

describe('기준일 피커', () => {
  it('날짜 문자열과 기기 시간대 Date를 오간다', () => {
    expect(toPickerDate('2026-01-05')).toEqual(new Date(2026, 0, 5));
    expect(fromPickerDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(fromPickerDate(toPickerDate('2010-06-07'))).toBe('2010-06-07');
  });

  it('요일은 언어를 따른다', () => {
    expect(formatWeekday('2026-10-16', 'ko')).toBe('금');
    expect(formatWeekday('2026-10-16', 'en')).toBe('Fri');
  });

  it('Android는 범위를 건 spinner 다이얼로그를 열고 확인·취소를 넘긴다', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    openAndroidBaseDatePicker(
      i18n.t,
      { value: '2026-10-21', minBaseDate: '2010-06-07', maxBaseDate: '2026-10-21' },
      { onConfirm, onCancel },
    );

    const args = mockOpen.mock.lastCall?.[0];
    expect(args).toMatchObject({
      value: new Date(2026, 9, 21),
      mode: 'date',
      display: 'spinner',
      minimumDate: new Date(2010, 5, 7),
      maximumDate: new Date(2026, 9, 21),
    });
    args?.onValueChange?.({ nativeEvent: { timestamp: 0, utcOffset: 0 } }, new Date(2026, 9, 16));
    expect(onConfirm).toHaveBeenCalledWith('2026-10-16');
    args?.onDismiss?.();
    expect(onCancel).toHaveBeenCalled();
  });
});
