import * as Haptics from 'expo-haptics';

// 주요 사용자 액션(원자재·ETP 선택, 탭·기간·설정 값 변경, 설정 진입, 회전, 뒤로 가기)의 햅틱(D-109).
// 같은 값을 다시 누르는 것처럼 아무것도 바뀌지 않으면 부르지 않는다
export function tapHaptic() {
  void Haptics.selectionAsync();
}

// 당겨서 새로고침이 걸린 순간. 선택보다 또렷한 가벼운 충격으로 "놓아도 된다"를 알린다
export function refreshHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}
