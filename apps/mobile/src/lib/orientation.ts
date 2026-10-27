import { lockAsync, OrientationLock } from 'expo-screen-orientation';
import { useWindowDimensions } from 'react-native';

// 앱은 세로로 고정하고, C-a~C-c에서만 [⟲]로 가로를 잠근다(screens.md C, D-076).
// 기기가 잠금을 거부해도(iPad 크기 조절 등) 화면은 창 모양을 따르므로 실패는 무시한다.
const lock = async (orientation: OrientationLock) => {
  try {
    await lockAsync(orientation);
  } catch {
    // 무시
  }
};

export const lockPortrait = () => lock(OrientationLock.PORTRAIT_UP);
export const lockLandscape = () => lock(OrientationLock.LANDSCAPE);

// 레이아웃은 잠금 상태가 아니라 실제 창 모양으로 정한다.
export const useIsLandscape = () => {
  const { width, height } = useWindowDimensions();
  return width > height;
};
