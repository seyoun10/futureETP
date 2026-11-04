import {
  Canvas,
  Circle,
  DashPathEffect,
  Line,
  Path,
  Rect,
  Skia,
  Text as SkText,
  vec,
} from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import {
  GestureDetector,
  useCompetingGestures,
  usePanGesture,
  useTapGesture,
} from 'react-native-gesture-handler';

import { formatPrice } from '@/lib/formatNumber';
import { colors, spacing } from '@/theme/tokens';
import { changeColor, useUpDownPalette } from '@/theme/upDownColor';
import { GUIDE_DASH, X_LABEL_HEIGHT } from './chartLayout';
import { ChartResetButton } from './ChartResetButton';
import { ChartOverlay } from './ChartOverlay';
import type { OverlayInsets } from './ChartOverlay';
import { CHART_FONT_SIZE, numberFont } from './chartText';
import { CROSSHAIR_LABEL_PAD, crosshairLabelHeight } from './CrosshairLayer';
import { labelStride, nearestSlot, niceTicks, placePctLabels, tickDecimals } from './curveLayout';
import { cornerRect, leastCoveredCorner } from './detailCorner';
import { LONG_PRESS_MS } from './useChartViewport';

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
  // 점 위 변화율 글자와 그 소수 자릿수(반올림해 0이면 방향 없는 색)
  formatPct: (pct: number) => string;
  pctDecimals: number;
  // 십자선이 붙은 월물의 상세 박스 내용. 위치는 차트가 점·선을 가장 적게 가리는 귀퉁이로 정한다
  renderDetail: (index: number) => ReactNode;
  // 차트 안 위쪽에 겹치는 정보 줄과 x축 라벨 위에 띄우는 안내(ChartOverlay). 선·점은 줄을 비켜 그린다
  overlayTop?: ReactNode;
  floating?: ReactNode;
  // 있으면 floating 아래(x축 라벨 위)에 되돌리기 버튼을 띄운다. 누르면 십자선·상세 박스도 지운다
  onResetView?: () => void;
  resetLabel?: string;
};

const TICK_COUNT = 5;
const TOP = CHART_FONT_SIZE + spacing.sm;
// x축 라벨 자리는 C-a·C-c와 같게 둔다(되돌리기 버튼·하단 줄 위치를 세 탭이 맞춘다)
const BOTTOM = X_LABEL_HEIGHT;
// y축 눈금은 다른 탭처럼 그림 영역 오른쪽(YAxisLayer와 같은 간격)
const Y_LABEL_GAP = 4;
const DOT = 3;
const LABEL_GAP = 4;

type Size = { width: number; height: number };

// C-b 월물커브 선차트(screens.md C-b). 기준일은 점선 + 빈 점, 현재는 실선 + 찬 점, 점 위 변화율은 등락 색.
// 확대·이동이 없어 victory 없이 Skia 캔버스에 직접 그린다. 십자선은 C-a와 같다(D-056): 길게 누르면 나타나
// 끄는 대로 월물에 붙고(햅틱), 손을 떼도 남아 있는 동안은 길게 누르지 않고 끌어도 따라오며, 한 번 더 누르면 사라진다.
export const CurveChart = memo(function CurveChart({
  points,
  priceDecimals,
  formatPct,
  pctDecimals,
  renderDetail,
  overlayTop,
  floating,
  onResetView,
  resetLabel,
}: CurveChartProps) {
  const palette = useUpDownPalette();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [overlay, setOverlay] = useState<OverlayInsets>({ top: 0, bottom: 0 });
  // 십자선이 붙은 월물. null이면 십자선이 없다
  const [selected, setSelected] = useState<number | null>(null);
  const selectedRef = useRef<number | null>(null);
  const [boxSize, setBoxSize] = useState<Size | null>(null);

  const layout = useMemo(() => {
    const prices = points.flatMap((p) => [p.base, p.current]).filter((v) => v !== null);
    if (prices.length === 0 || size.width === 0) return null;
    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    // y축은 C-a처럼 log(값의 비율이 같은 높이). 0 이하 값이 있으면(2020-04 CL 음수 정산) 선형
    const log = lo > 0;
    const toAxis = log ? Math.log : (v: number) => v;
    const fromAxis = log ? Math.exp : (v: number) => v;
    // 위아래 여백(축 공간). 모두 같은 값이면 값의 2% 폭을 기준으로 둔다
    const span = toAxis(hi) - toAxis(lo);
    const pad = (span || (log ? 0.02 : Math.abs(hi) * 0.02) || 1) * 0.08;
    const yMin = toAxis(lo) - pad;
    const yMax = toAxis(hi) + pad;
    const left = 0;
    const plotBottom = size.height - BOTTOM;
    // 선·점은 정보 줄 사이(dataTop~dataBottom)에 맞추고, 격자·눈금은 그림 영역 전체(TOP~plotBottom)에 그린다
    const dataTop = TOP + overlay.top;
    const dataBottom = plotBottom - overlay.bottom;
    const perPx = (yMax - yMin) / Math.max(dataBottom - dataTop, 1);
    // 눈금 값은 1·2·5 간격(커브는 한 자릿수 배 안쪽이라 log 눈금 대신 C-a처럼 고른 값)
    const fullTicks = niceTicks(
      fromAxis(yMin - (plotBottom - dataBottom) * perPx),
      fromAxis(yMax + (dataTop - TOP) * perPx),
      TICK_COUNT,
    );
    const fullDecimals = tickDecimals(fullTicks, priceDecimals);
    const tickLabels = fullTicks.map((t) => formatPrice(t, fullDecimals));
    // 축 폭은 눈금 글자와 십자선 가격 라벨(가격 자릿수 전부) 중 넓은 쪽. 눈금만 보면 `86.85`가 잘린다
    const tickWidth = Math.max(...tickLabels.map((l) => numberFont.measureText(l).width)) + 10;
    const crosshairWidth =
      Math.max(
        ...points
          .map((p) => p.current ?? p.base ?? null)
          .filter((v) => v !== null)
          .map((v) => numberFont.measureText(formatPrice(v, priceDecimals)).width),
      ) +
      CROSSHAIR_LABEL_PAD * 2 +
      1;
    const right = size.width - Math.max(tickWidth, crosshairWidth);
    const slot = (right - left) / points.length;
    const x = (i: number) => left + slot * (i + 0.5);
    const y = (v: number) => dataTop + (yMax - toAxis(v)) / perPx;
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

  // 손가락 x에 가장 가까운 월물에 십자선을 붙인다. 다른 월물로 옮겨 붙을 때마다 햅틱
  const snapTo = (x: number) => {
    if (!layout) return;
    const index = nearestSlot(x, layout.left, layout.slot, points.length);
    if (index === null || index === selectedRef.current) return;
    selectedRef.current = index;
    setSelected(index);
    void Haptics.selectionAsync();
  };
  const hideCrosshair = () => {
    selectedRef.current = null;
    setSelected(null);
  };
  // 콜백은 점 몇 개뿐인 React 상태만 바꿔 JS 스레드에서 돌린다
  const pan = usePanGesture({
    runOnJS: true,
    enabled: layout !== null,
    // 십자선이 있으면 길게 누르지 않고 끌어도 바로 따라온다(C-a pressConfig와 같다)
    activateAfterLongPress: selected === null ? LONG_PRESS_MS : undefined,
    onActivate: (e) => snapTo(e.x),
    onUpdate: (e) => snapTo(e.x),
  });
  const tap = useTapGesture({ runOnJS: true, onActivate: hideCrosshair });
  const gesture = useCompetingGestures(tap, pan);

  const onBoxLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBoxSize((prev) =>
      prev?.width === width && prev.height === height ? prev : { width, height },
    );
  }, []);

  const monthStride = labelStride(
    layout?.slot ?? 0,
    numberFont.measureText('0000').width + LABEL_GAP,
  );
  // 변화율은 모든 월물에 붙이고, 이웃과 겹치면 점 아래나 한 줄 위·아래로 옮긴다
  const pctLabels = useMemo(() => {
    if (!layout) return [];
    const items = points.flatMap((p, i) => {
      if (p.changePct === null) return [];
      const ys = [p.base, p.current].filter((v) => v !== null).map((v) => layout.y(v));
      const text = formatPct(p.changePct);
      const width = numberFont.measureText(text).width;
      return [
        {
          key: p.label,
          text,
          color: changeColor(p.changePct, palette, pctDecimals),
          x: layout.textX(i, width),
          width,
          top: Math.min(...ys) - DOT,
          bottom: Math.max(...ys) + DOT,
        },
      ];
    });
    const ys = placePctLabels(items, {
      height: CHART_FONT_SIZE,
      gap: LABEL_GAP,
      minY: TOP + overlay.top,
      maxY: layout.plotBottom - overlay.bottom,
    });
    return items.map((item, i) => ({ ...item, y: ys[i] }));
  }, [layout, points, formatPct, pctDecimals, palette, overlay]);

  // 상세 박스: 정보 줄 사이 그림 영역의 네 귀퉁이 중 점·선·변화율을 가장 적게 가리는 곳(C-a와 같다)
  const detailPos = useMemo(() => {
    if (!layout || selected === null || !boxSize) return null;
    const area = {
      left: layout.left + spacing.sm,
      right: layout.right - spacing.sm,
      top: TOP + overlay.top + spacing.sm,
      bottom: layout.plotBottom - overlay.bottom - spacing.sm,
    };
    const corner = leastCoveredCorner({
      area,
      box: boxSize,
      crosshairX: layout.x(selected),
      *marksIn(x0, x1) {
        for (const key of ['base', 'current'] as const) {
          for (let i = 0; i < points.length; i++) {
            const v = points[i][key];
            if (v === null) continue;
            const px = layout.x(i);
            const py = layout.y(v);
            if (px >= x0 - DOT && px <= x1 + DOT) yield [py - DOT, py + DOT] as const;
            // 다음 점까지의 선분 중 [x0, x1] 안 부분의 세로 구간
            const next = points[i + 1]?.[key];
            if (next === null || next === undefined) continue;
            const nx = layout.x(i + 1);
            const a = Math.max(px, x0);
            const b = Math.min(nx, x1);
            if (a > b) continue;
            const ny = layout.y(next);
            const at = (x: number) => py + ((ny - py) * (x - px)) / (nx - px);
            yield [Math.min(at(a), at(b)), Math.max(at(a), at(b))] as const;
          }
        }
        for (const l of pctLabels) {
          if (l.x + l.width >= x0 && l.x <= x1) yield [l.y - CHART_FONT_SIZE, l.y] as const;
        }
      },
    });
    const { left, top } = cornerRect(area, boxSize, corner);
    return { left, top };
  }, [layout, selected, boxSize, overlay, points, pctLabels]);

  // 십자선 가로선·가격 라벨은 현재가(없으면 기준일 값)를 따라간다
  const crosshair = useMemo(() => {
    if (!layout || selected === null) return null;
    const p = points[selected];
    const value = p?.current ?? p?.base ?? null;
    if (!p || value === null) return null;
    const x = layout.x(selected);
    const y = layout.y(value);
    const monthWidth = numberFont.measureText(p.label).width + CROSSHAIR_LABEL_PAD * 2;
    return {
      x,
      y,
      price: formatPrice(value, priceDecimals),
      month: p.label,
      monthX: Math.min(Math.max(x - monthWidth / 2, layout.left), layout.right - monthWidth),
      monthWidth,
    };
  }, [layout, selected, points, priceDecimals]);
  const labelHeight = crosshairLabelHeight(numberFont);

  return (
    <View style={styles.container} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        <View style={styles.container} testID="curve-chart">
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
              <Path
                path={paths.base}
                color={colors.chart.curveBase}
                style="stroke"
                strokeWidth={1.5}
              >
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
              {pctLabels.map((l) => (
                <SkText
                  key={`p${l.key}`}
                  x={l.x}
                  y={l.y}
                  text={l.text}
                  font={numberFont}
                  color={l.color}
                />
              ))}
              {crosshair && [
                <Line
                  key="cv"
                  p1={vec(crosshair.x, TOP)}
                  p2={vec(crosshair.x, layout.plotBottom)}
                  color={colors.chart.crosshairLine}
                  strokeWidth={1}
                >
                  <DashPathEffect intervals={GUIDE_DASH} />
                </Line>,
                <Line
                  key="ch"
                  p1={vec(layout.left, crosshair.y)}
                  p2={vec(layout.right, crosshair.y)}
                  color={colors.chart.crosshairLine}
                  strokeWidth={1}
                >
                  <DashPathEffect intervals={GUIDE_DASH} />
                </Line>,
                <Rect
                  key="pb"
                  x={layout.right + 1}
                  y={crosshair.y - labelHeight / 2}
                  width={size.width - layout.right - 1}
                  height={labelHeight}
                  color={colors.chart.crosshair}
                />,
                <SkText
                  key="pt"
                  x={layout.right + 1 + CROSSHAIR_LABEL_PAD}
                  y={crosshair.y + CHART_FONT_SIZE / 2 - 1}
                  text={crosshair.price}
                  font={numberFont}
                  color={colors.chart.crosshairText}
                />,
                <Rect
                  key="mb"
                  x={crosshair.monthX}
                  y={layout.plotBottom + 2}
                  width={crosshair.monthWidth}
                  height={labelHeight}
                  color={colors.chart.crosshair}
                />,
                <SkText
                  key="mt"
                  x={crosshair.monthX + CROSSHAIR_LABEL_PAD}
                  y={layout.plotBottom + 2 + CROSSHAIR_LABEL_PAD + CHART_FONT_SIZE - 1}
                  text={crosshair.month}
                  font={numberFont}
                  color={colors.chart.crosshairText}
                />,
              ]}
            </Canvas>
          )}
        </View>
      </GestureDetector>
      <ChartOverlay
        top={overlayTop}
        bottomOffset={BOTTOM}
        floating={
          onResetView ? (
            <View style={styles.floating} pointerEvents="box-none">
              {floating}
              <ChartResetButton
                accessibilityLabel={resetLabel}
                onPress={() => {
                  hideCrosshair();
                  onResetView();
                }}
              />
            </View>
          ) : (
            floating
          )
        }
        onInsets={setOverlay}
      />
      {selected !== null && points[selected] && (
        <View
          pointerEvents="none"
          onLayout={onBoxLayout}
          // 귀퉁이를 정하기 전(첫 측정)에는 감춘다
          style={[styles.detail, detailPos ?? { opacity: 0 }]}
        >
          {renderDetail(selected)}
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
  },
  floating: {
    alignItems: 'center',
    gap: spacing.sm,
  },
});
