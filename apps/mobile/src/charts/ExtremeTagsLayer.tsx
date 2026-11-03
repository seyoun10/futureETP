import { Paragraph } from '@shopify/react-native-skia';
import { useTranslation } from 'react-i18next';
import type { ChartBounds, Scale } from 'victory-native';

import { formatTradeDate } from '@/lib/formatDateTime';
import { formatChangePct, formatPrice } from '@/lib/formatNumber';
import { colors } from '@/theme/tokens';
import { chartParagraph, PARAGRAPH_LAYOUT_WIDTH } from './chartText';
import { extremeTagLeft, extremeTagTop } from './extremeTagLayout';
import { centerIndexRange } from './fitTransform';
import { useClampedTransform } from './useClampedTransform';

type ExtremeBar = { tradeDate: string; high: number; low: number };

type ExtremeTagsLayerProps = {
  bars: readonly ExtremeBar[];
  currentPrice: number;
  // 꼬리표가 비켜 갈 회색 점선 가격(YAxisLayer)
  guidePrice: number;
  priceDecimals: number;
  yScale: Scale;
  chartBounds: ChartBounds;
  x0: number;
  dx: number;
};

const GAP = 3;

// 보이는 봉 중 최고가·최저가 봉의 꼬리표 `가격(현재가 대비 %, 날짜)`(screens.md C-a). 한글이라 Paragraph로 그린다
export function ExtremeTagsLayer({
  bars,
  currentPrice,
  guidePrice,
  priceDecimals,
  yScale,
  chartBounds,
  x0,
  dx,
}: ExtremeTagsLayerProps) {
  const { t } = useTranslation();
  const { k, tx, ky, ty } = useClampedTransform(bars.length, chartBounds);
  if (dx <= 0 || bars.length === 0) return null;

  // 꼬리가 화면 밖인 봉은 고가·저가가 안 보이므로 제외한다(y 맞춤용 visibleRange는 몸통이 걸친 봉까지 포함)
  const [i0, i1] = centerIndexRange(
    chartBounds.left,
    chartBounds.right,
    x0,
    dx,
    bars.length,
    k,
    tx,
  );
  if (i0 > i1) return null;
  let hi = i0;
  let lo = i0;
  for (let i = i0; i <= i1; i++) {
    if (bars[i].high > bars[hi].high) hi = i;
    if (bars[i].low < bars[lo].low) lo = i;
  }

  // 점선(YAxisLayer)과 같은 위치
  const currentY = ky * yScale(guidePrice) + ty;
  const tag = (index: number, kind: 'high' | 'low') => {
    const bar = bars[index];
    const price = kind === 'high' ? bar.high : bar.low;
    const text = t(kind === 'high' ? 'chart.highTag' : 'chart.lowTag', {
      price: formatPrice(price, priceDecimals),
      pct: formatChangePct((price / currentPrice - 1) * 100),
      date: formatTradeDate(bar.tradeDate),
    });
    const arrow = kind === 'high' ? '↓' : '↑';
    const arrowWidth = chartParagraph(arrow, colors.chart.extremeTag).getLongestLine();
    // 화살표 위치와 상관없이 글자 수가 같아 너비도 같다
    const width = chartParagraph(arrow + text, colors.chart.extremeTag).getLongestLine();
    const x = k * (x0 + index * dx) + tx;
    const y = ky * yScale(price) + ty;
    // 고가는 봉 위, 저가는 봉 아래. 화살표가 봉을 가리키도록 화살표 쪽 끝을 봉에 맞추고, 차트 끝을 넘으면 화살표를 반대쪽으로 옮긴다
    const { left, arrowFirst } = extremeTagLeft(
      kind,
      x,
      width,
      arrowWidth,
      chartBounds.left,
      chartBounds.right,
    );
    const paragraph = chartParagraph(
      arrowFirst ? arrow + text : text + arrow,
      colors.chart.extremeTag,
    );
    const height = paragraph.getHeight();
    const top = extremeTagTop(kind, y, height, GAP, currentY, chartBounds.top, chartBounds.bottom);
    return (
      <Paragraph key={kind} paragraph={paragraph} x={left} y={top} width={PARAGRAPH_LAYOUT_WIDTH} />
    );
  };

  return [tag(hi, 'high'), tag(lo, 'low')];
}
