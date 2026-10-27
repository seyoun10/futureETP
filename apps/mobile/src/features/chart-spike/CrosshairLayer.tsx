import { DashPathEffect, Group, Line, Text as SkText, vec } from '@shopify/react-native-skia';
import type { SkFont } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { getTransformComponents } from 'victory-native';
import type { ChartBounds, ChartPressState, useChartTransformState } from 'victory-native';

type ChartTransform = ReturnType<typeof useChartTransformState>['state'];

export type CrosshairPress = ChartPressState<{
  x: number;
  y: { open: number; high: number; low: number; close: number };
}>;

type CrosshairLayerProps = {
  press: CrosshairPress;
  transform: ChartTransform;
  chartBounds: ChartBounds;
  dates: string[];
  font: SkFont | null;
  color: string;
};

// 길게 누르기 십자선(D-032 스파이크). press 위치는 변환 전 좌표라 행렬로 화면 좌표로 바꾼다.
// 모두 UI 스레드 파생값이라 십자선을 움직여도 React 렌더가 없다.
export function CrosshairLayer({
  press,
  transform,
  chartBounds,
  dates,
  font,
  color,
}: CrosshairLayerProps) {
  const x = useDerivedValue(() => {
    const c = getTransformComponents(transform.matrix.get());
    return c.scaleX * press.x.position.get() + c.translateX;
  });
  const y = useDerivedValue(() => {
    const c = getTransformComponents(transform.matrix.get());
    return c.scaleY * press.y.close.position.get() + c.translateY;
  });
  const opacity = useDerivedValue(() => (press.isActive.get() ? 1 : 0));
  const vTop = useDerivedValue(() => vec(x.get(), chartBounds.top));
  const vBottom = useDerivedValue(() => vec(x.get(), chartBounds.bottom));
  const hLeft = useDerivedValue(() => vec(chartBounds.left, y.get()));
  const hRight = useDerivedValue(() => vec(chartBounds.right, y.get()));
  const priceText = useDerivedValue(() => press.y.close.value.get().toFixed(3));
  const dateText = useDerivedValue(() => dates[press.matchedIndex.get()] ?? '');
  const priceY = useDerivedValue(() => y.get() + 4);
  const dateX = useDerivedValue(() => x.get() - 30);

  if (!font) return null;

  return (
    <Group opacity={opacity}>
      <Line p1={vTop} p2={vBottom} color={color} strokeWidth={1}>
        <DashPathEffect intervals={[4, 4]} />
      </Line>
      <Line p1={hLeft} p2={hRight} color={color} strokeWidth={1}>
        <DashPathEffect intervals={[4, 4]} />
      </Line>
      <SkText x={chartBounds.right + 4} y={priceY} text={priceText} font={font} color={color} />
      <SkText
        x={dateX}
        y={chartBounds.bottom + font.getSize() + 6}
        text={dateText}
        font={font}
        color={color}
      />
    </Group>
  );
}
