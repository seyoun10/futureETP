import { useCartesianTransformContext } from 'victory-native';
import type { ChartBounds } from 'victory-native';

import { clampX } from './fitTransform';

// 레이어(x축 라벨·롤 표시·꼬리표)용 변환 값. 라이브러리 값은 제스처가 쓴 제한 전 행렬이라,
// 끝에서 더 밀면 봉은 제한으로 멈춰 있어도 레이어만 따라 움직인다. 봉과 같은 제한을 건다(D-056)
export function useClampedTransform(n: number, chartBounds: ChartBounds) {
  const { k, tx, ky, ty } = useCartesianTransformContext();
  return { ...clampX(n, chartBounds.left, chartBounds.right, k, tx), ky, ty };
}
