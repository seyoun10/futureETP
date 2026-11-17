import { Alert } from 'react-native';
import type { AlertButton, AlertOptions } from 'react-native';
import { showFailedAlert } from './failedAlert';

const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

const lastCall = () => {
  const call = alertSpy.mock.calls.at(-1)!;
  return { buttons: call[2] as AlertButton[], options: call[3] as AlertOptions };
};

describe('showFailedAlert', () => {
  beforeEach(() => alertSpy.mockClear());

  it('제목·본문과 [확인] 하나로 띄운다', () => {
    showFailedAlert('제목', '본문', '확인');
    expect(alertSpy).toHaveBeenCalledWith(
      '제목',
      '본문',
      [expect.objectContaining({ text: '확인' })],
      expect.objectContaining({ cancelable: true }),
    );
    lastCall().buttons[0]!.onPress!();
  });

  it('떠 있는 동안 다시 부르면 겹쳐 띄우지 않고, [확인]으로 닫으면 다시 띄운다', () => {
    showFailedAlert('제목', '본문', '확인');
    showFailedAlert('제목', '본문', '확인');
    expect(alertSpy).toHaveBeenCalledTimes(1);

    lastCall().buttons[0]!.onPress!();
    showFailedAlert('제목', '본문', '확인');
    expect(alertSpy).toHaveBeenCalledTimes(2);
    lastCall().buttons[0]!.onPress!();
  });

  it('Android 바깥 눌러 닫기(onDismiss)도 닫힘으로 본다', () => {
    showFailedAlert('제목', '본문', '확인');
    lastCall().options.onDismiss!();
    showFailedAlert('제목', '본문', '확인');
    expect(alertSpy).toHaveBeenCalledTimes(2);
    lastCall().buttons[0]!.onPress!();
  });
});
