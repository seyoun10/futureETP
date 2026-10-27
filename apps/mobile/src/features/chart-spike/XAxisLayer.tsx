import { Line, Text as SkText, vec } from '@shopify/react-native-skia';
import type { SkFont } from '@shopify/react-native-skia';
import { useCartesianTransformContext } from 'victory-native';
import type { ChartBounds } from 'victory-native';

import { monthTicks } from './monthTicks';

type XAxisLayerProps = {
  dates: string[];
  chartBounds: ChartBounds;
  // 변환 전 첫 봉의 x와 봉 간격
  x0: number;
  dx: number;
  font: SkFont | null;
  labelColor: string;
  gridColor: string;
};

// 라이브러리 x축은 y 재맞춤 뒤 라벨이 화면 밖으로 밀려서 직접 그린다(D-032 커스텀 레이어).
export function XAxisLayer({
  dates,
  chartBounds,
  x0,
  dx,
  font,
  labelColor,
  gridColor,
}: XAxisLayerProps) {
  const { k, tx } = useCartesianTransformContext();
  if (!font || dx <= 0) return null;

  const toScreen = (i: number) => k * (x0 + i * dx) + tx;
  const i0 = Math.max(0, Math.floor(((chartBounds.left - tx) / k - x0) / dx));
  const i1 = Math.min(dates.length - 1, Math.ceil(((chartBounds.right - tx) / k - x0) / dx));
  const labelY = chartBounds.bottom + font.getSize() + 6;

  return monthTicks(dates, i0, i1).map((t) => {
    const x = toScreen(t.index);
    const width = font.measureText(t.label).width;
    return [
      <Line
        key={`g${t.index}`}
        p1={vec(x, chartBounds.top)}
        p2={vec(x, chartBounds.bottom)}
        color={gridColor}
        strokeWidth={0}
      />,
      <SkText
        key={`l${t.index}`}
        x={Math.min(Math.max(x - width / 2, chartBounds.left), chartBounds.right - width)}
        y={labelY}
        text={t.label}
        font={font}
        color={labelColor}
      />,
    ];
  });
}
