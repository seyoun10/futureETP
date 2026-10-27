import { Group, Path, Skia } from '@shopify/react-native-skia';
import type { SkPath } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { useDerivedValue } from 'react-native-reanimated';
import type { ChartBounds, Scale } from 'victory-native';
import type { ChartTransform } from './CrosshairLayer';

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

// 이평선·rare-level 밴드. 변환 그룹 안에서 그리면 배율만큼 선이 굵어지므로, 변환 전 좌표로 경로를 한 번 만들고
// 행렬은 UI 스레드에서 경로 점에 곱한다(D-087). 선 굵기는 확대해도 그대로다.
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
          color={line.color}
          strokeWidth={line.strokeWidth}
          transform={transform}
        />
      ))}
    </Group>
  );
}

function basePath(values: readonly (number | null)[], xScale: Scale, yScale: Scale): SkPath {
  const builder = Skia.PathBuilder.Make();
  let drawing = false;
  values.forEach((v, i) => {
    if (v === null || v <= 0) {
      drawing = false;
      return;
    }
    const x = xScale(i);
    const y = yScale(v);
    if (drawing) builder.lineTo(x, y);
    else builder.moveTo(x, y);
    drawing = true;
  });
  return builder.detach();
}

type TransformedLineProps = {
  values: readonly (number | null)[];
  xScale: Scale;
  yScale: Scale;
  color: string;
  strokeWidth: number;
  transform: ChartTransform;
};

function TransformedLine({
  values,
  xScale,
  yScale,
  color,
  strokeWidth,
  transform,
}: TransformedLineProps) {
  const path = useMemo(() => basePath(values, xScale, yScale), [values, xScale, yScale]);
  const screenPath = useDerivedValue(() =>
    Skia.PathBuilder.MakeFromPath(path).transform(transform.matrix.get()).detach(),
  );
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
