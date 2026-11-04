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

// 점 위 변화율 라벨 하나. x는 글자 왼쪽(점 가운데 기준), anchor는 점 x, top·bottom은 그 칸 점들의 가장 위·아래 y.
// below면 점 아래에 둔다(하락)
export type PctLabelInput = {
  x: number;
  anchor: number;
  width: number;
  top: number;
  bottom: number;
  below?: boolean;
};

// 커브 선분 하나
export type Segment = { x0: number; y0: number; x1: number; y1: number };

// 선분이 [left, right] × [top, bottom] 상자를 지나는지
export function segmentHitsBox(
  s: Segment,
  left: number,
  right: number,
  top: number,
  bottom: number,
): boolean {
  const a = Math.max(Math.min(s.x0, s.x1), left);
  const b = Math.min(Math.max(s.x0, s.x1), right);
  if (a > b) return false;
  const at = (x: number) =>
    s.x1 === s.x0 ? s.y0 : s.y0 + ((s.y1 - s.y0) * (x - s.x0)) / (s.x1 - s.x0);
  const ys = s.x1 === s.x0 ? [s.y0, s.y1] : [at(a), at(b)];
  return Math.max(...ys) >= top && Math.min(...ys) <= bottom;
}

// 변화율 라벨을 모두 그리되 겹치지 않게 놓을 글자 왼쪽 x와 기준선 y. 오르면 점 위, 내리면(below) 점 아래에만 둔다.
// 앞 라벨부터 놓고, 이미 놓은 라벨과 겹치면 그 라벨 바깥(위쪽 라벨은 더 위, 아래쪽 라벨은 더 아래)으로 밀어낸다.
// 밀려서 [minY, maxY]를 벗어나면 그 끝에 붙인다. 그 높이에서 선과 겹치면 좌우로 가장 덜 밀어 선·라벨과 겹치지 않는
// 자리로 옮긴다. 점 x가 글자 폭 안에 남고 [minX, maxX]를 넘지 않는 만큼만 밀고, 그런 자리가 없으면 그대로 둔다
export function placePctLabels(
  labels: readonly PctLabelInput[],
  options: {
    height: number;
    gap: number;
    minY: number;
    maxY: number;
    minX?: number;
    maxX?: number;
    segments?: readonly Segment[];
  },
): { x: number; y: number }[] {
  const { height, gap, minY, maxY, minX = -Infinity, maxX = Infinity, segments = [] } = options;
  const placed: { left: number; right: number; y: number }[] = [];
  const hitsLabel = (x: number, width: number, y: number) =>
    placed.find(
      (p) => x < p.right + gap && p.left < x + width + gap && y > p.y - height && p.y > y - height,
    );
  const hitsLine = (x: number, width: number, y: number) =>
    segments.some((s) => segmentHitsBox(s, x, x + width, y - height, y));
  return labels.map((l) => {
    let y = l.below ? l.bottom + gap + height : l.top - gap;
    // 밀 때마다 y가 한쪽으로만 움직여 놓은 라벨 수만큼 안에 끝난다
    for (;;) {
      const hit = hitsLabel(l.x, l.width, y);
      if (!hit) break;
      y = l.below ? hit.y + height + gap : hit.y - height - gap;
    }
    y = Math.min(Math.max(y, minY + height), maxY);
    let x = l.x;
    if (hitsLine(x, l.width, y)) {
      const lo = Math.max(l.anchor - l.width, minX);
      const hi = Math.min(l.anchor, maxX - l.width);
      // 1pt씩 오른쪽·왼쪽을 번갈아 본다
      for (let d = 1; l.x - d >= lo || l.x + d <= hi; d++) {
        const found = [l.x + d, l.x - d].find(
          (c) => c >= lo && c <= hi && !hitsLine(c, l.width, y) && !hitsLabel(c, l.width, y),
        );
        if (found !== undefined) {
          x = found;
          break;
        }
      }
    }
    placed.push({ left: x, right: x + l.width, y });
    return { x, y };
  });
}
