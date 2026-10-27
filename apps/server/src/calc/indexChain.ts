// 롤 비중으로 혼합한 가격의 일일 변화율을 이어 붙인 수익률 연결 지수(index_bar)와
// 가격 수준 맞춤 비율(index_scale)을 만든다(product.md 계산 정의 > 시계열, D-004, D-066).

export type DayBar = {
  open: number | null;
  high: number | null;
  low: number | null;
  settle: number;
};

export type HeldWeights = readonly { symbol: string; weight: number }[];

export type IndexInputDay = {
  tradeDate: string;
  // 월물별 그날 daily_bar
  bars: ReadonlyMap<string, DayBar>;
  // 그날 종가 뒤 보유 비중(roll_weight, 합 1). 다음 날 수익률에 쓰인다
  weights: HeldWeights;
  inRollPeriod: boolean;
};

export type IndexBarRow = {
  tradeDate: string;
  // 맞춤 전 원래 지수. 무효일은 모두 null
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  // Σ 그날 종가 뒤 비중 × 정산가
  blendedPrice: number;
  isValid: boolean;
  inRollPeriod: boolean;
};

type Field = 'open' | 'high' | 'low' | 'settle';

function blend(day: IndexInputDay, weights: HeldWeights, field: Field): number {
  if (weights.length === 0) throw new Error(`${day.tradeDate} 롤 비중이 없다`);
  return weights.reduce((sum, { symbol, weight }) => {
    const bar = day.bars.get(symbol);
    if (bar === undefined) throw new Error(`${day.tradeDate} ${symbol} 정산가가 없다`);
    // 거래가 없던 월물은 시가·고가·저가가 없으므로 정산가로 대신한다
    return sum + weight * (bar[field] ?? bar.settle);
  }, 0);
}

// 직전 유효일(종가 지수 anchorClose, 혼합 가격 anchorBlend)에서 지금 보유 비중의 가격으로 이어 붙인 지수.
// 무효일이 없으면 anchorBlend = Σ 보유 비중 × 전일 가격이라 분자·분모에 같은 비중을 쓰는 공식과 같다
export function chainIndex(
  anchorClose: number,
  anchorBlend: number,
  heldWeights: HeldWeights,
  price: (symbol: string) => number,
): number {
  const held = heldWeights.reduce((sum, { symbol, weight }) => sum + weight * price(symbol), 0);
  return (anchorClose * held) / anchorBlend;
}

const positiveOrNull = (v: number) => (v > 0 ? v : null);

// 거래일(오름차순)마다 원래 지수 봉을 만든다. 첫 유효일의 종가 지수는 그날 혼합 가격이다.
// 지수(분자)나 혼합 가격이 0 이하인 날은 산출 불가로 두고, 다음 유효일은 직전 유효일에 이어 붙인다.
export function buildIndexBars(days: readonly IndexInputDay[]): IndexBarRow[] {
  const rows: IndexBarRow[] = [];
  let anchor: { close: number; blendedPrice: number } | null = null;
  let prevWeights: HeldWeights | null = null;

  for (const day of days) {
    const blendedPrice = blend(day, day.weights, 'settle');
    // 첫 유효일 전에는 그날 비중으로 배율 1, 그 뒤에는 전일 비중으로 직전 유효일에 이어 붙인다
    const held = anchor && prevWeights ? prevWeights : day.weights;
    const scale: number = anchor ? anchor.close / anchor.blendedPrice : 1;
    const close: number = scale * blend(day, held, 'settle');
    prevWeights = day.weights;

    if (close <= 0 || blendedPrice <= 0) {
      rows.push({
        tradeDate: day.tradeDate,
        open: null,
        high: null,
        low: null,
        close: null,
        blendedPrice,
        isValid: false,
        inRollPeriod: day.inRollPeriod,
      });
      continue;
    }

    rows.push({
      tradeDate: day.tradeDate,
      open: positiveOrNull(scale * blend(day, held, 'open')),
      high: positiveOrNull(scale * blend(day, held, 'high')),
      low: positiveOrNull(scale * blend(day, held, 'low')),
      close,
      blendedPrice,
      isValid: true,
      inRollPeriod: day.inRollPeriod,
    });
    anchor = { close, blendedPrice };
  }
  return rows;
}

// 가격 수준 맞춤 비율: 마지막 유효일의 혼합 가격 / 원래 지수. 마지막 날이 무효면 그 앞 유효일 비율을 그대로 쓴다
export function indexScaleRatio(bars: readonly IndexBarRow[]): number | null {
  for (let i = bars.length - 1; i >= 0; i--) {
    const { isValid, close, blendedPrice } = bars[i];
    if (isValid && close !== null) return blendedPrice / close;
  }
  return null;
}
