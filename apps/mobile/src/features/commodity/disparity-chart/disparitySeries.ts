// C-a 응답을 차트가 그릴 계열로 바꾼다(screens.md C-a, D-086). 모두 순수 함수다.
import type { DisparityBar, DisparityChart } from '@futureetp/shared';

type Direction = DisparityChart['rareLevels'][number]['direction'];

// OHLC가 모두 있는 봉. 산출 불가일은 차트에서 뺀다(x는 봉 순번이라 빈칸 없이 이어진다).
export type ChartBar = Omit<DisparityBar, 'open' | 'high' | 'low' | 'close'> & {
  open: number;
  high: number;
  low: number;
  close: number;
};

export const chartBars = (bars: readonly DisparityBar[]): ChartBar[] =>
  bars.filter(
    (b): b is ChartBar => b.open !== null && b.high !== null && b.low !== null && b.close !== null,
  );

// rare-level 밴드 하나: 이평선(t) × (1 + 레벨 이격도/100). 이평선이 없는 날은 null
export type BandLine = {
  key: string;
  direction: Direction;
  level: number;
  // 0 = 가장 덜 드문 레벨(옅음) … 레벨 수−1 = 가장 드문 레벨(진함). 색은 레벨 값이 아니라 순위로 고른다
  rank: number;
  values: (number | null)[];
};

export function bandLines(
  bars: readonly ChartBar[],
  rareLevels: DisparityChart['rareLevels'],
): BandLine[] {
  return rareLevels.map((line) => {
    // 응답은 방향마다 레벨 오름차순이라, 같은 방향 안에서 작은 레벨(드묾)일수록 순위가 높다
    const same = rareLevels.filter((l) => l.direction === line.direction);
    const rank = same.length - 1 - same.findIndex((l) => l.level === line.level);
    return {
      key: `${line.direction}-${line.level}`,
      direction: line.direction,
      level: line.level,
      rank,
      values: bars.map((b) => (b.ma === null ? null : b.ma * (1 + line.disparity / 100))),
    };
  });
}

// 봉마다 그 봉 위 선까지 포함한 위·아래 끝 가격. y 자동 맞춤이 봉과 선을 모두 넣게 한다(screens.md C-a)
export function chartEnvelope(bars: readonly ChartBar[], bands: readonly BandLine[]) {
  const hi = bars.map((b) => b.high);
  const lo = bars.map((b) => b.low);
  bars.forEach((b, i) => {
    const values = [b.ma, ...bands.map((band) => band.values[i])];
    for (const v of values) {
      if (v === null || v === undefined) continue;
      if (v > hi[i]) hi[i] = v;
      if (v < lo[i]) lo[i] = v;
    }
  });
  return { hi, lo };
}

// 롤 기간 음영 구간 [시작, 끝] 봉 순번(한국형·미국형)
export function rollSegments(bars: readonly ChartBar[]): [number, number][] {
  const segments: [number, number][] = [];
  bars.forEach((b, i) => {
    if (!b.inRoll) return;
    const last = segments[segments.length - 1];
    if (last && last[1] === i - 1) last[1] = i;
    else segments.push([i, i]);
  });
  return segments;
}

// 대표월물 전환일과 새 월물(전환일 세로 점선, 새 월물명은 십자선 상세, D-103). 봉 t의 보유 월물은 t−1 종가 뒤 비중이라,
// 보유 월물이 바뀐 봉의 바로 앞 봉(옛 월물의 마지막 날)이 전환일이다
export function frontSwitches(bars: readonly ChartBar[]) {
  const switches: { index: number; contractMonth: string }[] = [];
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1].holdings[0]?.contractMonth;
    const cur = bars[i].holdings[0]?.contractMonth;
    if (prev !== undefined && cur !== undefined && prev !== cur)
      switches.push({ index: i - 1, contractMonth: cur });
  }
  return switches;
}

// 보이는 봉 [i0, i1]의 최고가·최저가 봉과, 현재가 기준 저점대비(LC)·고점대비(HC) %(screens.md C-a)
export function visibleStats(bars: readonly ChartBar[], i0: number, i1: number) {
  const current = bars[bars.length - 1];
  if (!current || i0 > i1) return null;
  let highIndex = i0;
  let lowIndex = i0;
  for (let i = i0; i <= i1; i++) {
    if (bars[i].high > bars[highIndex].high) highIndex = i;
    if (bars[i].low < bars[lowIndex].low) lowIndex = i;
  }
  return {
    highIndex,
    lowIndex,
    fromLowPct: (current.close / bars[lowIndex].low - 1) * 100,
    fromHighPct: (current.close / bars[highIndex].high - 1) * 100,
  };
}

// y축 특수 라벨 우선순위: 현재가, 이평선, 그다음 현재가에 가까운 rare-level부터(screens.md C-a)
export type SpecialLabel =
  | { kind: 'current'; key: string; price: number }
  | { kind: 'ma'; key: string; price: number }
  | { kind: 'rare'; key: string; price: number; rank: number };

export function specialLabels(
  bars: readonly ChartBar[],
  bands: readonly BandLine[],
): SpecialLabel[] {
  const current = bars[bars.length - 1];
  if (!current) return [];
  const last = bars.length - 1;
  const rare = bands
    .flatMap((band): SpecialLabel[] => {
      const price = band.values[last];
      return price === null || price === undefined
        ? []
        : [{ kind: 'rare', key: band.key, price, rank: band.rank }];
    })
    .sort((a, b) => Math.abs(a.price - current.close) - Math.abs(b.price - current.close));
  return [
    { kind: 'current', key: 'current', price: current.close },
    ...(current.ma === null ? [] : [{ kind: 'ma' as const, key: 'ma', price: current.ma }]),
    ...rare,
  ];
}
