// 꼬리표 세로 위치. 봉 위(고가)·아래(저가)에 두고 차트 위·아래 끝 안으로 민다.
// 현재가 점선이 글자를 지나가면 점선 바깥(봉 반대쪽)으로 옮기고, 그쪽이 차트를 넘으면 봉 쪽으로 옮긴다
export function extremeTagTop(
  kind: 'high' | 'low',
  y: number,
  height: number,
  gap: number,
  lineY: number | null,
  top: number,
  bottom: number,
): number {
  const clamp = (v: number) => Math.min(Math.max(v, top), bottom - height);
  const placed = clamp(kind === 'high' ? y - height - gap : y + gap);
  if (lineY === null || lineY < placed - gap || lineY > placed + height + gap) return placed;
  const above = lineY - height - gap;
  const below = lineY + gap;
  const [first, second] = kind === 'high' ? [above, below] : [below, above];
  if (first >= top && first <= bottom - height) return first;
  return clamp(second);
}

// 꼬리표 가로 위치. 화살표 글자 가운데가 봉 x에 오게 둔다. 화살표는 고가면 글자 뒤, 저가면 앞이 기본이고,
// 그쪽으로 두면 차트 끝을 넘을 때 반대쪽에 붙인다. 양쪽 다 넘으면 기본 쪽으로 두고 차트 안으로 민다
export function extremeTagLeft(
  kind: 'high' | 'low',
  x: number,
  width: number,
  arrowWidth: number,
  left: number,
  right: number,
): { left: number; arrowFirst: boolean } {
  const fits = (v: number) => v >= left && v + width <= right;
  const arrowFirst = kind === 'low';
  const at = (first: boolean) => (first ? x - arrowWidth / 2 : x + arrowWidth / 2 - width);
  if (fits(at(arrowFirst))) return { left: at(arrowFirst), arrowFirst };
  if (fits(at(!arrowFirst))) return { left: at(!arrowFirst), arrowFirst: !arrowFirst };
  return { left: Math.min(Math.max(at(arrowFirst), left), right - width), arrowFirst };
}
