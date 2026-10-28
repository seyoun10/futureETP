// y축 특수 라벨(현재가·이평선·rare-level 등) 배치(screens.md C-a y축 라벨, D-056).
// 선은 모두 그리고, 라벨은 우선순위 순으로 겹치지 않는 것만 남긴다.

// 위에서 아래로 픽셀 y. 라벨 높이가 같다고 보고 가운데 y 사이 거리로 겹침을 판정한다.
export function placeLabels<T extends { y: number }>(
  ordered: readonly T[],
  height: number,
  top: number,
  bottom: number,
): T[] {
  const shown: T[] = [];
  for (const label of ordered) {
    if (label.y < top || label.y > bottom) continue;
    if (overlapsAny(label.y, shown, height)) continue;
    shown.push(label);
  }
  return shown;
}

export const overlapsAny = (y: number, labels: readonly { y: number }[], height: number) =>
  labels.some((l) => Math.abs(l.y - y) < height);

// 모든 라벨을 남겨야 할 때(C-c 끝값 라벨은 범례 역할). 위에서부터 겹치지 않게 아래로 밀고,
// 아래 끝을 넘으면 위로 되민다. 차트 위·아래 밖 라벨은 뺀다.
export function stackLabels<T extends { y: number }>(
  labels: readonly T[],
  height: number,
  top: number,
  bottom: number,
): T[] {
  const sorted = labels
    .filter((l) => l.y >= top && l.y <= bottom)
    .map((l) => ({ ...l }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i++) {
    sorted[i].y = Math.max(sorted[i].y, sorted[i - 1].y + height);
  }
  for (let i = sorted.length - 1; i >= 0; i--) {
    const limit = i === sorted.length - 1 ? bottom : sorted[i + 1].y - height;
    sorted[i].y = Math.min(sorted[i].y, limit);
  }
  return sorted;
}
