import { DashPathEffect, Group, Line, Rect, Text as SkText, vec } from '@shopify/react-native-skia';
import type { SkFont } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { getTransformComponents } from 'victory-native';

import { formatPrice } from '@/lib/formatNumber';
import { colors } from '@/theme/tokens';
import type { ChartBounds, ChartPressState, useChartTransformState } from 'victory-native';

export type ChartTransform = ReturnType<typeof useChartTransformState>['state'];

// 십자선은 close 값을 따라간다. 차트마다 y 키가 더 있어도 된다(C-a 봉, C-c 선)
export type CrosshairPress = ChartPressState<{ x: number; y: { close: number } }>;

// 십자선 화면 좌표. 축 레이어도 이 값으로 겹치는 기본 눈금을 숨긴다.
export type Crosshair = {
  x: SharedValue<number>;
  y: SharedValue<number>;
  // 손을 떼도 남는 표시 여부. press.isActive는 손을 떼면 false가 된다.
  visible: SharedValue<boolean>;
};

export const CROSSHAIR_LABEL_PAD = 3;
const DATE_SAMPLE = '0000-00-00';

// 십자선 날짜 라벨 박스 너비(겹침 판정에도 쓴다)
export function crosshairDateWidth(font: SkFont): number {
  return font.measureText(DATE_SAMPLE).width + CROSSHAIR_LABEL_PAD * 2;
}

// 라벨 박스 높이(겹침 판정에도 쓴다)
export function crosshairLabelHeight(font: SkFont): number {
  return font.getSize() + CROSSHAIR_LABEL_PAD * 2;
}

// press 위치는 변환 전 좌표라 행렬로 화면 좌표로 바꾼다. UI 스레드 파생값이다.
export function useCrosshairPosition(
  press: CrosshairPress,
  transform: ChartTransform,
  visible: SharedValue<boolean>,
): Crosshair {
  const x = useDerivedValue(() => {
    const c = getTransformComponents(transform.matrix.get());
    return c.scaleX * press.x.position.get() + c.translateX;
  });
  const y = useDerivedValue(() => {
    const c = getTransformComponents(transform.matrix.get());
    return c.scaleY * press.y.close.position.get() + c.translateY;
  });
  return { x, y, visible };
}

type CrosshairLayerProps = {
  press: CrosshairPress;
  crosshair: Crosshair;
  chartBounds: ChartBounds;
  canvasWidth: number;
  dates: readonly string[];
  priceDecimals: number;
  font: SkFont | null;
};

// 길게 누르기 십자선(D-056). 모두 UI 스레드 파생값이라 움직여도 React 렌더가 없다.
export function CrosshairLayer({
  press,
  crosshair,
  chartBounds,
  canvasWidth,
  dates,
  priceDecimals,
  font,
}: CrosshairLayerProps) {
  // 점선과 라벨 박스는 흰색이라 기본 눈금(회색)과 구분된다(D-056)
  const color = colors.chart.crosshair;
  const labelTextColor = colors.chart.crosshairText;
  const { x, y, visible } = crosshair;
  const fontSize = font?.getSize() ?? 0;
  const labelHeight = fontSize + CROSSHAIR_LABEL_PAD * 2;
  const dateWidth = font ? crosshairDateWidth(font) : 0;

  const opacity = useDerivedValue(() => (visible.get() ? 1 : 0));
  const vTop = useDerivedValue(() => vec(x.get(), chartBounds.top));
  const vBottom = useDerivedValue(() => vec(x.get(), chartBounds.bottom));
  const hLeft = useDerivedValue(() => vec(chartBounds.left, y.get()));
  const hRight = useDerivedValue(() => vec(chartBounds.right, y.get()));
  const priceText = useDerivedValue(() => formatPrice(press.y.close.value.get(), priceDecimals));
  const dateText = useDerivedValue(() => dates[press.matchedIndex.get()] ?? '');

  // y축 가격 라벨: 우측 축 영역 전체 너비의 박스
  const priceBoxY = useDerivedValue(() => y.get() - labelHeight / 2);
  const priceTextY = useDerivedValue(() => y.get() + fontSize / 2 - 1);
  // x축 날짜 라벨: 십자선 중앙, 차트 좌우 끝을 넘지 않게
  const dateBoxX = useDerivedValue(() =>
    Math.min(Math.max(x.get() - dateWidth / 2, chartBounds.left), chartBounds.right - dateWidth),
  );
  const dateTextX = useDerivedValue(() => dateBoxX.get() + CROSSHAIR_LABEL_PAD);

  if (!font) return null;
  const dateBoxY = chartBounds.bottom + 2;

  return (
    <Group opacity={opacity}>
      <Line p1={vTop} p2={vBottom} color={color} strokeWidth={1}>
        <DashPathEffect intervals={[4, 4]} />
      </Line>
      <Line p1={hLeft} p2={hRight} color={color} strokeWidth={1}>
        <DashPathEffect intervals={[4, 4]} />
      </Line>
      <Rect
        x={chartBounds.right + 1}
        y={priceBoxY}
        width={canvasWidth - chartBounds.right - 1}
        height={labelHeight}
        color={color}
      />
      <SkText
        x={chartBounds.right + 1 + CROSSHAIR_LABEL_PAD}
        y={priceTextY}
        text={priceText}
        font={font}
        color={labelTextColor}
      />
      <Rect x={dateBoxX} y={dateBoxY} width={dateWidth} height={labelHeight} color={color} />
      <SkText
        x={dateTextX}
        y={dateBoxY + CROSSHAIR_LABEL_PAD + fontSize - 1}
        text={dateText}
        font={font}
        color={labelTextColor}
      />
    </Group>
  );
}
