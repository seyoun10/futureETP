// 십자선 상세 박스를 둘 차트 귀퉁이 고르기(screens.md C-a 길게 누르기). 순수 함수다.

export type DetailCorner = { vertical: 'top' | 'bottom'; horizontal: 'left' | 'right' };

type Rect = { left: number; top: number; right: number; bottom: number };

type CornerInput = {
  // 박스를 놓을 수 있는 영역(화면 좌표). 박스는 이 영역의 귀퉁이에 붙는다
  area: Rect;
  box: { width: number; height: number };
  // 십자선 x. 이 x를 덮는 귀퉁이는 다른 곳이 없을 때만 고른다
  crosshairX: number;
  // 화면 x 범위 [x0, x1]에 그려진 표시(봉·선)의 세로 구간 [y0, y1](화면 좌표, y0 <= y1). 봉 하나마다 구간 여러 개
  marksIn: (x0: number, x1: number) => Iterable<readonly [number, number]>;
};

// 박스 영역과 겹치는 표시의 세로 길이 합(대략 가리는 픽셀 수)이 가장 작은 귀퉁이.
// 같으면 손가락 반대편, 위쪽 순이다
export function leastCoveredCorner({ area, box, crosshairX, marksIn }: CornerInput): DetailCorner {
  const opposite = crosshairX < (area.left + area.right) / 2 ? 'right' : 'left';
  const near = opposite === 'right' ? 'left' : 'right';
  const corners: DetailCorner[] = [
    { vertical: 'top', horizontal: opposite },
    { vertical: 'bottom', horizontal: opposite },
    { vertical: 'top', horizontal: near },
    { vertical: 'bottom', horizontal: near },
  ];
  let best = corners[0];
  let bestScore = Infinity;
  for (const corner of corners) {
    const r = cornerRect(area, box, corner);
    const coversCrosshair = crosshairX >= r.left && crosshairX <= r.right;
    let score = coversCrosshair ? 1e9 : 0;
    for (const [y0, y1] of marksIn(r.left, r.right)) {
      score += Math.max(0, Math.min(y1, r.bottom) - Math.max(y0, r.top));
    }
    if (score < bestScore) {
      best = corner;
      bestScore = score;
    }
  }
  return best;
}

export function cornerRect(
  area: Rect,
  box: { width: number; height: number },
  corner: DetailCorner,
): Rect {
  const left = corner.horizontal === 'left' ? area.left : area.right - box.width;
  const top = corner.vertical === 'top' ? area.top : area.bottom - box.height;
  return { left, top, right: left + box.width, bottom: top + box.height };
}
