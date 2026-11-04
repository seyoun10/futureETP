import { DashPathEffect, Line, Text as SkText, vec } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { useCartesianTransformContext } from 'victory-native';
import type { ChartBounds, Scale } from 'victory-native';

import { formatPrice } from '@/lib/formatNumber';
import { colors } from '@/theme/tokens';
import { GUIDE_DASH } from './chartLayout';
import { numberFont } from './chartText';
import { crosshairLabelHeight } from './CrosshairLayer';
import type { Crosshair } from './CrosshairLayer';
import { clampLabelY, overlapsAny, stackLabels } from './priceLabels';

const TICK_COUNT = 6;

// y축 특수 라벨(현재가·이평선·rare-level·C-c 월물 끝값 등)
export type PriceLabel = { key: string; price: number; color: string };

type YAxisLayerProps = {
  // 변환 전 y 스케일(C-a·C-c log, C-c에 0 이하 값이 있으면 선형)
  yScale: Scale;
  chartBounds: ChartBounds;
  priceDecimals: number;
  // 겹치면 모두 남긴 채 위·아래로 민다
  labels: readonly PriceLabel[];
  // 수평 점선(뒤에 둔 것이 위에 그려진다)
  guides: readonly { price: number; color: string }[];
  crosshair: Crosshair;
};

// 소수 자릿수는 눈금 간격에 맞추되 가격 자릿수를 넘지 않는다.
function decimalsFor(ticks: number[], max: number): number {
  let step = Infinity;
  for (let i = 1; i < ticks.length; i++) step = Math.min(step, ticks[i] - ticks[i - 1]);
  if (!Number.isFinite(step) || step <= 0) return max;
  return Math.min(max, Math.max(0, -Math.floor(Math.log10(step))));
}

// 우측 y축을 직접 그린다(D-056). 특수 라벨은 선 색으로 쓰고 서로 겹치지 않게 밀며, 특수 라벨과
// 겹치는 기본 눈금 텍스트는 숨긴다(격자선은 유지). 십자선 가격 라벨과 겹치는 글자도 숨긴다.
export function YAxisLayer({
  yScale,
  chartBounds,
  priceDecimals,
  labels,
  guides,
  crosshair,
}: YAxisLayerProps) {
  const { ky, ty } = useCartesianTransformContext();

  const toScreen = (price: number) => ky * yScale(price) + ty;
  const priceAt = (screenY: number) => yScale.invert((screenY - ty) / ky);
  const ticks = yScale
    .copy()
    .domain([priceAt(chartBounds.bottom), priceAt(chartBounds.top)])
    .ticks(TICK_COUNT);
  const decimals = decimalsFor(ticks, priceDecimals);
  const height = crosshairLabelHeight(numberFont);
  const special = stackLabels(
    labels.map((l) => ({ ...l, y: toScreen(l.price) })),
    height,
    chartBounds.top,
    chartBounds.bottom,
  );
  const x = chartBounds.right + 4;

  return (
    <>
      {ticks.map((t) => {
        const y = toScreen(t);
        if (y < chartBounds.top || y > chartBounds.bottom) return null;
        // 끝에 붙은 눈금 글자는 잘리므로 격자선만 그린다
        const clipped = y !== clampLabelY(y, height, chartBounds.top, chartBounds.bottom);
        return [
          <Line
            key={`g${t}`}
            p1={vec(chartBounds.left, y)}
            p2={vec(chartBounds.right, y)}
            color={colors.chart.grid}
            strokeWidth={0}
          />,
          clipped || overlapsAny(y, special, height) ? null : (
            <AxisLabel
              key={`l${t}`}
              x={x}
              y={y}
              text={formatPrice(t, decimals)}
              color={colors.chart.tick}
              crosshair={crosshair}
            />
          ),
        ];
      })}
      {guides.map((g) => {
        const y = toScreen(g.price);
        if (y < chartBounds.top || y > chartBounds.bottom) return null;
        return (
          <Line
            key={`d${g.color}`}
            p1={vec(chartBounds.left, y)}
            p2={vec(chartBounds.right, y)}
            color={g.color}
            strokeWidth={1}
          >
            <DashPathEffect intervals={GUIDE_DASH} />
          </Line>
        );
      })}
      {special.map((l) => (
        <AxisLabel
          key={`s${l.key}`}
          x={x}
          y={l.y}
          text={formatPrice(l.price, priceDecimals)}
          color={l.color}
          crosshair={crosshair}
        />
      ))}
    </>
  );
}

type AxisLabelProps = {
  x: number;
  y: number;
  text: string;
  color: string;
  crosshair: Crosshair;
};

// 십자선 가격 라벨과 겹치면 숨긴다(UI 스레드 판정).
function AxisLabel({ x, y, text, color, crosshair }: AxisLabelProps) {
  const height = crosshairLabelHeight(numberFont);
  const opacity = useDerivedValue(() => {
    if (!crosshair.visible.get()) return 1;
    return Math.abs(y - crosshair.y.get()) < height ? 0 : 1;
  });
  return (
    <SkText
      x={x}
      y={y + numberFont.getSize() / 2 - 1}
      text={text}
      font={numberFont}
      color={color}
      opacity={opacity}
    />
  );
}
