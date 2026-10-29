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
