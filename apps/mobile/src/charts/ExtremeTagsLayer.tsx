import { Paragraph } from '@shopify/react-native-skia';
import { useTranslation } from 'react-i18next';
import { useCartesianTransformContext } from 'victory-native';
import type { ChartBounds, Scale } from 'victory-native';

import { formatTradeDate } from '@/lib/formatDateTime';
import { formatChangePct, formatPrice } from '@/lib/formatNumber';
import { colors } from '@/theme/tokens';
import { chartParagraph } from './chartText';
import { extremeTagTop } from './extremeTagLayout';
import { indexRange } from './fitTransform';

type ExtremeBar = { tradeDate: string; high: number; low: number };

type ExtremeTagsLayerProps = {
  bars: readonly ExtremeBar[];
  currentPrice: number;
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
  priceDecimals,
  yScale,
  chartBounds,
  x0,
  dx,
}: ExtremeTagsLayerProps) {
  const { t } = useTranslation();
  const { k, tx, ky, ty } = useCartesianTransformContext();
  if (dx <= 0 || bars.length === 0) return null;

  const [i0, i1] = indexRange(chartBounds.left, chartBounds.right, x0, dx, bars.length, k, tx);
  let hi = i0;
  let lo = i0;
  for (let i = i0; i <= i1; i++) {
    if (bars[i].high > bars[hi].high) hi = i;
    if (bars[i].low < bars[lo].low) lo = i;
  }

  // 현재가 점선(YAxisLayer)과 같은 위치
  const currentY = ky * yScale(currentPrice) + ty;
  const tag = (index: number, kind: 'high' | 'low') => {
    const bar = bars[index];
    const price = kind === 'high' ? bar.high : bar.low;
    const text = t(kind === 'high' ? 'chart.highTag' : 'chart.lowTag', {
      price: formatPrice(price, priceDecimals),
      pct: formatChangePct((price / currentPrice - 1) * 100),
      date: formatTradeDate(bar.tradeDate),
    });
    const paragraph = chartParagraph(text, colors.chart.extremeTag);
    const width = paragraph.getLongestLine();
    const height = paragraph.getHeight();
    const x = k * (x0 + index * dx) + tx;
    const y = ky * yScale(price) + ty;
    // 고가는 봉 위, 저가는 봉 아래. 차트 끝을 넘지 않게 민다. 화살표가 봉 쪽 끝에 오도록 고가는 오른쪽 끝, 저가는 왼쪽 끝을 봉에 맞춘다
    const left = Math.min(
      Math.max(kind === 'high' ? x - width : x, chartBounds.left),
      chartBounds.right - width,
    );
    const top = extremeTagTop(kind, y, height, GAP, currentY, chartBounds.top, chartBounds.bottom);
    return <Paragraph key={kind} paragraph={paragraph} x={left} y={top} width={width + 4} />;
  };

  return [tag(hi, 'high'), tag(lo, 'low')];
}
