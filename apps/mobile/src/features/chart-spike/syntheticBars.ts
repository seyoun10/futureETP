// C-a 차트 스파이크(D-032)용 합성 일봉. 실제 데이터 연동 전까지만 쓴다.

export type Bar = {
  i: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

// 시드 고정 PRNG(mulberry32): 실행마다 같은 봉이 나와야 성능 비교가 된다.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// 2010-06-01부터 주말을 건너뛴 거래일로 기하 브라운 운동 봉을 만든다.
export function makeSyntheticBars(count: number, seed = 42, startPrice = 4): Bar[] {
  const rand = mulberry32(seed);
  const gauss = () => {
    const u = Math.max(rand(), Number.EPSILON);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  };
  const dailyVol = 0.03;
  const bars: Bar[] = [];
  const day = new Date(Date.UTC(2010, 5, 1));
  let prevClose = startPrice;

  while (bars.length < count) {
    const weekday = day.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      const open = prevClose * Math.exp(dailyVol * 0.3 * gauss());
      const close = open * Math.exp(dailyVol * gauss());
      const high = Math.max(open, close) * Math.exp(dailyVol * 0.5 * rand());
      const low = Math.min(open, close) * Math.exp(-dailyVol * 0.5 * rand());
      bars.push({ i: bars.length, date: formatDate(day), open, high, low, close });
      prevClose = close;
    }
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return bars;
}
