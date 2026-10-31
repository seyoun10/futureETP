import { Group, Path, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { useDerivedValue } from 'react-native-reanimated';
import { getTransformComponents } from 'victory-native';
import type { ChartBounds, Scale } from 'victory-native';
import type { ChartTransform } from './CrosshairLayer';
import { lineSample } from './lineSampling';

// 봉 순번마다 값 하나. 값이 없는 날(null)은 선을 끊는다
export type ChartLine = {
  key: string;
  values: readonly (number | null)[];
  color: string;
  strokeWidth: number;
};

type LineLayerProps = {
  lines: readonly ChartLine[];
  xScale: Scale;
  yScale: Scale;
  chartBounds: ChartBounds;
  transform: ChartTransform;
};

// 이평선·rare-level 밴드. 변환 그룹 안에서 그리면 배율만큼 선이 굵어지므로, 행렬은 UI 스레드에서
// 점마다 곱해 화면 좌표로 경로를 만든다(D-087, D-106). 선 굵기는 확대해도 그대로다.
export function LineLayer({ lines, xScale, yScale, chartBounds, transform }: LineLayerProps) {
  const clip = useMemo(
    () =>
      Skia.XYWHRect(
        chartBounds.left,
        chartBounds.top,
        chartBounds.right - chartBounds.left,
        chartBounds.bottom - chartBounds.top,
      ),
    [chartBounds],
  );
  return (
    <Group clip={clip}>
      {lines.map((line) => (
        <TransformedLine
          key={line.key}
          values={line.values}
          xScale={xScale}
          yScale={yScale}
          chartBounds={chartBounds}
          color={line.color}
          strokeWidth={line.strokeWidth}
          transform={transform}
        />
      ))}
    </Group>
  );
}

// 변환 전 y 좌표. 값이 없는 날(null·0 이하)은 NaN으로 둬 선을 끊는다
function baseYs(values: readonly (number | null)[], yScale: Scale): number[] {
  return values.map((v) => (v === null || v <= 0 ? NaN : yScale(v)));
}

type TransformedLineProps = {
  values: readonly (number | null)[];
  xScale: Scale;
  yScale: Scale;
  chartBounds: ChartBounds;
  color: string;
  strokeWidth: number;
  transform: ChartTransform;
};

function TransformedLine({
  values,
  xScale,
  yScale,
  chartBounds,
  color,
  strokeWidth,
  transform,
}: TransformedLineProps) {
  const ys = useMemo(() => baseYs(values, yScale), [values, yScale]);
  const x0 = xScale(0);
  const dx = xScale(1) - x0;
  const { left, right } = chartBounds;
  // 보이는 구간만, 화면 1px에 점 하나 이하로 경로를 만든다(lineSample, D-106).
  // 전체 경로를 매 프레임 복사·변환·획 그리기하면 봉이 수천 개일 때 축소에서 프레임이 떨어졌다
  const screenPath = useDerivedValue(() => {
    const c = getTransformComponents(transform.matrix.get());
    const builder = Skia.PathBuilder.Make();
    const sample = lineSample(ys.length, x0, dx, c.scaleX, c.translateX, left, right);
    if (!sample) return builder.detach();
    let drawing = false;
    for (let i = sample.first; ; i += sample.step) {
      const j = Math.min(i, sample.last);
      const y = ys[j];
      if (Number.isNaN(y)) {
        drawing = false;
      } else {
        const sx = c.scaleX * (x0 + j * dx) + c.translateX;
        const sy = c.scaleY * y + c.translateY;
        if (drawing) builder.lineTo(sx, sy);
        else builder.moveTo(sx, sy);
        drawing = true;
      }
      if (j === sample.last) break;
    }
    return builder.detach();
  });
  return (
    <Path
      path={screenPath}
      color={color}
      style="stroke"
      strokeWidth={strokeWidth}
      strokeJoin="round"
    />
  );
}
