import { Group, Line, Paragraph, vec } from '@shopify/react-native-skia';
import { useTranslation } from 'react-i18next';
import { useDerivedValue } from 'react-native-reanimated';
import type { ChartBounds } from 'victory-native';

import { colors } from '@/theme/tokens';
import { chartParagraph, numberFont } from './chartText';
import { crosshairDateWidth } from './CrosshairLayer';
import type { Crosshair } from './CrosshairLayer';
import { monthTicks } from './monthTicks';
import { useClampedTransform } from './useClampedTransform';

type XAxisLayerProps = {
  dates: readonly string[];
  chartBounds: ChartBounds;
  // 변환 전 첫 봉의 x와 봉 간격
  x0: number;
  dx: number;
  crosshair: Crosshair;
};

// 라이브러리 x축은 y 재맞춤 뒤 라벨이 화면 밖으로 밀려서 직접 그린다(D-056).
// 월 라벨에 한글이 들어가 Paragraph로 그린다(D-087).
export function XAxisLayer({ dates, chartBounds, x0, dx, crosshair }: XAxisLayerProps) {
  const { t } = useTranslation();
  const { k, tx } = useClampedTransform(dates.length, chartBounds);
  if (dx <= 0) return null;

  const toScreen = (i: number) => k * (x0 + i * dx) + tx;
  const i0 = Math.max(0, Math.floor(((chartBounds.left - tx) / k - x0) / dx));
  const i1 = Math.min(dates.length - 1, Math.ceil(((chartBounds.right - tx) / k - x0) / dx));

  return monthTicks(dates, i0, i1).map((tick) => {
    const x = toScreen(tick.index);
    const label =
      tick.month === 1
        ? String(tick.year)
        : t(`chart.months.${String(tick.month) as '1'}`, { defaultValue: String(tick.month) });
    const paragraph = chartParagraph(label, colors.chart.tick);
    const width = paragraph.getLongestLine();
    return [
      <Line
        key={`g${tick.index}`}
        p1={vec(x, chartBounds.top)}
        p2={vec(x, chartBounds.bottom)}
        color={colors.chart.grid}
        strokeWidth={0}
      />,
      <TickLabel
        key={`l${tick.index}`}
        x={Math.min(Math.max(x - width / 2, chartBounds.left), chartBounds.right - width)}
        y={chartBounds.bottom + 4}
        width={width}
        label={label}
        crosshair={crosshair}
      />,
    ];
  });
}

type TickLabelProps = {
  x: number;
  y: number;
  width: number;
  label: string;
  crosshair: Crosshair;
};

// 십자선 날짜 라벨과 겹치면 숨긴다(UI 스레드 판정).
function TickLabel({ x, y, width, label, crosshair }: TickLabelProps) {
  const halfDate = crosshairDateWidth(numberFont) / 2;
  const center = x + width / 2;
  const opacity = useDerivedValue(() => {
    if (!crosshair.visible.get()) return 1;
    return Math.abs(center - crosshair.x.get()) < width / 2 + halfDate + 2 ? 0 : 1;
  });
  return (
    <Group opacity={opacity}>
      <Paragraph
        paragraph={chartParagraph(label, colors.chart.tick)}
        x={x}
        y={y}
        width={width + 4}
      />
    </Group>
  );
}
