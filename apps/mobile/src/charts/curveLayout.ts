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

// x에 가장 가까운 칸 순번. 그림 영역 밖이면 양끝 칸(십자선을 끌 때)
export function nearestSlot(
  x: number,
  left: number,
  slotWidth: number,
  count: number,
): number | null {
  if (slotWidth <= 0 || count === 0) return null;
  return Math.min(Math.max(Math.floor((x - left) / slotWidth), 0), count - 1);
}

// 점 위 변화율 라벨 하나. x는 글자 왼쪽, top·bottom은 그 칸 점들의 가장 위·아래 y.
// below면 점 아래를 먼저 고른다(하락)
export type PctLabelInput = {
  x: number;
  width: number;
  top: number;
  bottom: number;
  below?: boolean;
};

// 변화율 라벨을 모두 그리되 겹치지 않게 놓을 글자 기준선 y. 오르면 점 위, 내리면(below) 점 아래에만 둔다.
// 앞 라벨부터 놓고, 이미 놓은 라벨과 겹치면 그 라벨 바깥(위쪽 라벨은 더 위, 아래쪽 라벨은 더 아래)으로 밀어낸다.
// 밀려서 [minY, maxY]를 벗어나면 그 끝에 붙인다
export function placePctLabels(
  labels: readonly PctLabelInput[],
  options: { height: number; gap: number; minY: number; maxY: number },
): number[] {
  const { height, gap, minY, maxY } = options;
  const placed: { left: number; right: number; y: number }[] = [];
  return labels.map((l) => {
    let y = l.below ? l.bottom + gap + height : l.top - gap;
    // 밀 때마다 y가 한쪽으로만 움직여 놓은 라벨 수만큼 안에 끝난다
    for (;;) {
      const hit = placed.find(
        (p) =>
          l.x < p.right + gap &&
          p.left < l.x + l.width + gap &&
          y > p.y - height &&
          p.y > y - height,
      );
      if (!hit) break;
      y = l.below ? hit.y + height + gap : hit.y - height - gap;
    }
    y = Math.min(Math.max(y, minY + height), maxY);
    placed.push({ left: l.x, right: l.x + l.width, y });
    return y;
  });
}
