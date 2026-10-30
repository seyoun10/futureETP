// 선 레이어가 프레임마다 그릴 봉 순번(D-106). 화면 밖은 앞뒤 1봉만 남기고, 봉 간격이 1px보다 좁으면
// 2의 거듭제곱 간격으로 건너뛰어 화면 1px에 점이 하나 이하가 되게 한다. 간격이 같으면 같은 순번
// (간격의 배수)을 고르므로 드래그 중에 선 모양이 흔들리지 않는다
export type LineSample = { first: number; last: number; step: number };

export function lineSample(
  count: number,
  // 변환 전 첫 봉 x와 봉 간격
  x0: number,
  dx: number,
  // 행렬의 x 배율·이동
  k: number,
  tx: number,
  left: number,
  right: number,
): LineSample | null {
  'worklet';
  if (count === 0) return null;
  // 화면 x = k * (x0 + i * dx) + tx
  const px = k * dx;
  if (!(px > 0)) return { first: 0, last: count - 1, step: 1 };
  const start = k * x0 + tx;
  const lo = Math.max(0, Math.floor((left - start) / px) - 1);
  const hi = Math.min(count - 1, Math.ceil((right - start) / px) + 1);
  if (hi < lo) return null;
  const step = px >= 1 ? 1 : 2 ** Math.floor(Math.log2(1 / px));
  return { first: Math.floor(lo / step) * step, last: hi, step };
}
