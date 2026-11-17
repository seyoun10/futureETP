import { Alert } from 'react-native';

let open = false;

// 로딩이 실패하거나 시간 안에 끝나지 않았을 때의 공통 안내(D-138, D-139). [확인]으로 닫기만 하고,
// 다시 하는 방법(다시 당기기, 차트 다시 끌기)은 본문에 적는다. 떠 있는 동안 또 부르면 겹쳐 띄우지 않는다.
// 문구는 호출부가 번역해 넘긴다
export function showFailedAlert(title: string, message: string, confirmText: string) {
  if (open) return;
  open = true;
  const close = () => {
    open = false;
  };
  Alert.alert(title, message, [{ text: confirmText, onPress: close }], {
    cancelable: true,
    onDismiss: close,
  });
}
