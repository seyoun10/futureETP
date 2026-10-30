import {
  Canvas,
  Circle,
  DashPathEffect,
  Line,
  Path,
  Skia,
  Text as SkText,
  vec,
} from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { memo, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';

import { formatPrice } from '@/lib/formatNumber';
import { colors, spacing } from '@/theme/tokens';
import { changeColor, useUpDownPalette } from '@/theme/upDownColor';
import { ChartOverlay } from './ChartOverlay';
import type { OverlayInsets } from './ChartOverlay';
import { CHART_FONT_SIZE, numberFont } from './chartText';
import { labelStride, niceTicks, slotAt, tickDecimals } from './curveLayout';

// 만기순 월물 하나. 그 커브에 없으면 null
export type CurvePoint = {
  label: string;
  base: number | null;
  current: number | null;
  changePct: number | null;
};

type CurveChartProps = {
  points: readonly CurvePoint[];
  priceDecimals: number;
  // 점 위 변화율 글자
  formatPct: (pct: number) => string;
  // 점을 누르면 여는 툴팁 내용. 위치는 차트가 누른 점 반대편으로 정한다
  renderDetail: (index: number) => ReactNode;
  // 차트 안 위·아래에 겹치는 정보 줄과 아래 줄 위에 띄우는 안내(ChartOverlay). 선·점은 줄을 비켜 그린다
  overlayTop?: ReactNode;
  overlayBottom?: ReactNode;
  floating?: ReactNode;
};

const TICK_COUNT = 5;
const TOP = CHART_FONT_SIZE + spacing.sm;
const BOTTOM = CHART_FONT_SIZE + spacing.sm;
// y축 눈금은 다른 탭처럼 그림 영역 오른쪽(YAxisLayer와 같은 간격)
const Y_LABEL_GAP = 4;
const DOT = 3;
const LABEL_GAP = 4;

type Selected = { index: number; side: 'left' | 'right' };

// C-b 월물커브 선차트(screens.md C-b). 기준일은 점선 + 빈 점, 현재는 실선 + 찬 점, 점 위 변화율은 등락 색.
// 확대·이동이 없어 victory 없이 Skia 캔버스에 직접 그린다. 칸을 누르면 툴팁, 한 번 더 누르면 닫는다.
export const CurveChart = memo(function CurveChart({
  points,
  priceDecimals,
  formatPct,
  renderDetail,
  overlayTop,
  overlayBottom,
  floating,
}: CurveChartProps) {
  const palette = useUpDownPalette();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [overlay, setOverlay] = useState<OverlayInsets>({ top: 0, bottom: 0 });
  const [selected, setSelected] = useState<Selected | null>(null);

  const layout = useMemo(() => {
    const prices = points.flatMap((p) => [p.base, p.current]).filter((v) => v !== null);
    if (prices.length === 0 || size.width === 0) return null;
    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    // 위아래 여백. 모두 같은 값이면 값의 1%를 둔다
    const pad = (hi - lo || Math.abs(hi) * 0.02 || 1) * 0.08;
    const yMin = lo - pad;
    const yMax = hi + pad;
    const left = 0;
    const plotBottom = size.height - BOTTOM;
    // 선·점은 정보 줄 사이(dataTop~dataBottom)에 맞추고, 격자·눈금은 그림 영역 전체(TOP~plotBottom)에 그린다
    const dataTop = TOP + overlay.top;
    const dataBottom = plotBottom - overlay.bottom;
    const perPx = (yMax - yMin) / Math.max(dataBottom - dataTop, 1);
    const fullTicks = niceTicks(
      yMin - (plotBottom - dataBottom) * perPx,
      yMax + (dataTop - TOP) * perPx,
      TICK_COUNT,
    );
    const fullDecimals = tickDecimals(fullTicks, priceDecimals);
    const tickLabels = fullTicks.map((t) => formatPrice(t, fullDecimals));
    const right =
      size.width - Math.max(...tickLabels.map((l) => numberFont.measureText(l).width)) - 10;
    const slot = (right - left) / points.length;
    const x = (i: number) => left + slot * (i + 0.5);
    const y = (v: number) => dataTop + (yMax - v) / perPx;
    // 점 가운데에 맞춘 글자. 첫·끝 칸에서 칸 반폭보다 넓으면 그림 영역 안으로 민다
    const textX = (i: number, width: number) =>
      Math.min(Math.max(x(i) - width / 2, left), right - width);
    return {
      ticks: fullTicks,
      tickLabels,
      left,
      right,
      plotBottom,
      slot,
      x,
      y,
      textX,
    };
  }, [points, priceDecimals, size, overlay]);

  const paths = useMemo(() => {
    if (!layout) return null;
    const build = (key: 'base' | 'current') => {
      const builder = Skia.PathBuilder.Make();
      let drawing = false;
      points.forEach((p, i) => {
        const v = p[key];
        if (v === null) {
          drawing = false;
          return;
        }
        if (drawing) builder.lineTo(layout.x(i), layout.y(v));
        else builder.moveTo(layout.x(i), layout.y(v));
        drawing = true;
      });
      return builder.detach();
    };
    return { base: build('base'), current: build('current') };
  }, [layout, points]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  const onPress = (e: GestureResponderEvent) => {
    if (!layout) return;
    const index = slotAt(e.nativeEvent.locationX, layout.left, layout.slot, points.length);
    if (index === null || index === selected?.index) {
      setSelected(null);
      return;
    }
    setSelected({ index, side: layout.x(index) < size.width / 2 ? 'right' : 'left' });
    void Haptics.selectionAsync();
  };

  const monthStride = labelStride(
    layout?.slot ?? 0,
    numberFont.measureText('DEC26').width + LABEL_GAP,
  );
  const pctStride = labelStride(
    layout?.slot ?? 0,
    numberFont.measureText('-00.0%').width + LABEL_GAP,
  );

  return (
    <View style={styles.container} onLayout={onLayout}>
      <Pressable style={styles.container} onPress={onPress} testID="curve-chart">
        {layout && paths && (
          <Canvas style={styles.container}>
            {layout.ticks.map((t, i) => {
              const ty = layout.y(t);
              if (ty < TOP || ty > layout.plotBottom) return null;
              return [
                <Line
                  key={`g${t}`}
                  p1={vec(layout.left, ty)}
                  p2={vec(layout.right, ty)}
                  color={colors.chart.grid}
                  strokeWidth={0}
                />,
                <SkText
                  key={`l${t}`}
                  x={layout.right + Y_LABEL_GAP}
                  y={ty + CHART_FONT_SIZE / 2 - 1}
                  text={layout.tickLabels[i]}
                  font={numberFont}
                  color={colors.chart.tick}
                />,
              ];
            })}
            {selected !== null && (
              <Line
                p1={vec(layout.x(selected.index), TOP)}
                p2={vec(layout.x(selected.index), layout.plotBottom)}
                color={colors.chart.crosshair}
                strokeWidth={0}
              />
            )}
            <Path path={paths.base} color={colors.chart.curveBase} style="stroke" strokeWidth={1.5}>
              <DashPathEffect intervals={[4, 3]} />
            </Path>
            <Path
              path={paths.current}
              color={colors.chart.curveCurrent}
              style="stroke"
              strokeWidth={1.5}
              strokeJoin="round"
            />
            {points.map((p, i) => {
              const px = layout.x(i);
              const top = Math.min(
                ...[p.base, p.current].filter((v) => v !== null).map((v) => layout.y(v)),
              );
              const pct =
                p.changePct === null || i % pctStride !== 0
                  ? null
                  : { text: formatPct(p.changePct), color: changeColor(p.changePct, palette) };
              return [
                p.base !== null && (
                  <Circle
                    key={`b${p.label}`}
                    cx={px}
                    cy={layout.y(p.base)}
                    r={DOT}
                    color={colors.chart.curveBase}
                    style="stroke"
                    strokeWidth={1.5}
                  />
                ),
                p.current !== null && (
                  <Circle
                    key={`c${p.label}`}
                    cx={px}
                    cy={layout.y(p.current)}
                    r={DOT}
                    color={colors.chart.curveCurrent}
                  />
                ),
                pct !== null && (
                  <SkText
                    key={`p${p.label}`}
                    x={layout.textX(i, numberFont.measureText(pct.text).width)}
                    y={top - DOT - LABEL_GAP}
                    text={pct.text}
                    font={numberFont}
                    color={pct.color}
                  />
                ),
                i % monthStride === 0 && (
                  <SkText
                    key={`m${p.label}`}
                    x={layout.textX(i, numberFont.measureText(p.label).width)}
                    y={size.height - spacing.xs}
                    text={p.label}
                    font={numberFont}
                    color={colors.chart.tick}
                  />
                ),
              ];
            })}
          </Canvas>
        )}
      </Pressable>
      <ChartOverlay
        top={overlayTop}
        bottom={overlayBottom}
        bottomOffset={BOTTOM}
        floating={floating}
        onInsets={setOverlay}
      />
      {selected !== null && points[selected.index] && (
        <View
          pointerEvents="none"
          style={[
            styles.detail,
            { top: styles.detail.top + overlay.top },
            selected.side === 'left'
              ? { left: layout?.left ?? 0 }
              : { right: size.width - (layout?.right ?? size.width) },
          ]}
        >
          {renderDetail(selected.index)}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  detail: {
    position: 'absolute',
    top: spacing.sm,
  },
});
