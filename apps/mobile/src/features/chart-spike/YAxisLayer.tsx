import { Line, Text as SkText, vec } from '@shopify/react-native-skia';
import type { SkFont } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { useCartesianTransformContext } from 'victory-native';
import type { ChartBounds, Scale } from 'victory-native';

import { crosshairLabelHeight } from './CrosshairLayer';
import type { Crosshair } from './CrosshairLayer';

const TICK_COUNT = 6;

type YAxisLayerProps = {
  // 변환 전 y 스케일(log)
  yScale: Scale;
  chartBounds: ChartBounds;
  font: SkFont | null;
  labelColor: string;
  gridColor: string;
  crosshair: Crosshair;
};

// 소수 자릿수는 눈금 간격에 맞춘다(최대 3자리).
function decimalsFor(ticks: number[]): number {
  let step = Infinity;
  for (let i = 1; i < ticks.length; i++) step = Math.min(step, ticks[i] - ticks[i - 1]);
  if (!Number.isFinite(step) || step <= 0) return 2;
  return Math.min(3, Math.max(0, -Math.floor(Math.log10(step))));
}

// 우측 y축을 직접 그린다. 라벨마다 십자선 가격 라벨과 겹치는지 따로 판정해야 해서
// 라이브러리 y축 대신 쓴다(D-032 커스텀 레이어).
export function YAxisLayer({
  yScale,
  chartBounds,
  font,
  labelColor,
  gridColor,
  crosshair,
}: YAxisLayerProps) {
  const { ky, ty } = useCartesianTransformContext();
  if (!font) return null;

  const toScreen = (price: number) => ky * yScale(price) + ty;
  const priceAt = (screenY: number) => yScale.invert((screenY - ty) / ky);
  const ticks = yScale
    .copy()
    .domain([priceAt(chartBounds.bottom), priceAt(chartBounds.top)])
    .ticks(TICK_COUNT);
  const decimals = decimalsFor(ticks);
  const fontSize = font.getSize();

  return ticks.map((t) => {
    const y = toScreen(t);
    if (y < chartBounds.top || y > chartBounds.bottom) return null;
    return [
      <Line
        key={`g${t}`}
        p1={vec(chartBounds.left, y)}
        p2={vec(chartBounds.right, y)}
        color={gridColor}
        strokeWidth={0}
      />,
      <TickLabel
        key={`l${t}`}
        x={chartBounds.right + 4}
        y={y}
        baseline={y + fontSize / 2 - 1}
        text={t.toFixed(decimals)}
        font={font}
        color={labelColor}
        crosshair={crosshair}
      />,
    ];
  });
}

type TickLabelProps = {
  x: number;
  y: number;
  baseline: number;
  text: string;
  font: SkFont;
  color: string;
  crosshair: Crosshair;
};

// 십자선 가격 라벨과 겹치면 숨긴다(UI 스레드 판정).
function TickLabel({ x, y, baseline, text, font, color, crosshair }: TickLabelProps) {
  const height = crosshairLabelHeight(font);
  const opacity = useDerivedValue(() => {
    if (!crosshair.visible.get()) return 1;
    return Math.abs(y - crosshair.y.get()) < height ? 0 : 1;
  });
  return <SkText x={x} y={baseline} text={text} font={font} color={color} opacity={opacity} />;
}
