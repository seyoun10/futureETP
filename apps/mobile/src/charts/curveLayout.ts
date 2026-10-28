// C-b 커브 차트 좌표 계산(순수 함수). 확대·이동이 없어 Skia 캔버스에 직접 그린다.

// 1·2·5 × 10^n 간격으로 [min, max] 안에 놓는 눈금. 간격은 d3 ticks처럼 개수가 count에 가깝게 고른다
export function niceTicks(min: number, max: number, count: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) return [min];
  const raw = (max - min) / Math.max(count, 1);
  const power = 10 ** Math.floor(Math.log10(raw));
  const ratio = raw / power;
  const step =
    (ratio >= Math.sqrt(50) ? 10 : ratio >= Math.sqrt(10) ? 5 : ratio >= Math.SQRT2 ? 2 : 1) *
    power;
  const ticks: number[] = [];
  // 부동소수 오차로 끝 눈금이 빠지지 않게 반올림해 쌓는다
  for (let i = Math.ceil(min / step); i * step <= max + step * 1e-9; i++) {
    ticks.push(Number((i * step).toPrecision(12)));
  }
  return ticks;
}

// 눈금 간격에 맞춘 소수 자릿수. 가격 자릿수를 넘지 않는다
export function tickDecimals(ticks: readonly number[], max: number): number {
  const step = ticks.length > 1 ? ticks[1] - ticks[0] : 0;
  if (!(step > 0)) return max;
  return Math.min(max, Math.max(0, -Math.floor(Math.log10(step) + 1e-9)));
}

// 라벨이 겹치지 않게 몇 개마다 하나씩 그릴지(1 = 모두)
export const labelStride = (slotWidth: number, labelWidth: number): number =>
  slotWidth <= 0 ? 1 : Math.max(1, Math.ceil(labelWidth / slotWidth));

// 누른 x가 속한 월물 칸. 칸 밖이면 null
export function slotAt(x: number, left: number, slotWidth: number, count: number): number | null {
  if (slotWidth <= 0) return null;
  const index = Math.floor((x - left) / slotWidth);
  return index >= 0 && index < count ? index : null;
}
