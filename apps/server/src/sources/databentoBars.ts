// Databento 1회 적재 2단계의 변환 규칙(D-088): 원본 CSV 행 → contract·daily_bar·과거 trading_day.
// ohlcv-1d는 UTC 날짜로 잘려 CME 거래일과 맞지 않아 쓰지 않는다. OHLC도 statistics에서 만든다.
// 행 모양은 Databento CSV(pretty_px·pretty_ts, 헤더 이름 → 값)다.
import { COMMODITY_CODES, type CommodityCode } from '@futureetp/shared';
import { MONTH_CODES, toContractSymbol } from '../calc/contractSymbol.ts';
import { CME_TIME_ZONE, addDays } from '../calc/tradingCalendar.ts';

export type CsvRow = Readonly<Record<string, string>>;

// statistics stat_type
const OPENING_PRICE = '1';
const SETTLEMENT_PRICE = '3';
const SESSION_LOW = '4';
const SESSION_HIGH = '5';
const CLEARED_VOLUME = '6';

// 데이터셋은 2010-06-06(일) 세션부터라 그 전 거래일 정산가 재전송은 버린다
export const FIRST_TRADE_DATE = '2010-06-07';
// 이 CT 시각 이후 메시지는 다음 거래일 세션이다. 마감(16:00, 2012년 전 에너지 16:15)과
// 개장 전 경매(16:45~, 시가 갱신) 사이
const SESSION_ROLL_MINUTES = 16 * 60 + 45;
// 확정 거래량에 거래일(ts_ref)이 없던 시기(~2015-11)는 이 CT 시각 뒤 받은 값을 그날 것으로 본다
const CLOSE_MINUTES = 16 * 60;

// UTC → CT 오프셋(ms)을 UTC 시 단위로 기억한다. 서머타임 전환은 UTC 정시에 일어난다
const offsetByHour = new Map<string, number>();
const ctFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: CME_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
});

// ISO UTC 시각의 CT 날짜와 하루 중 분
export function ctClock(iso: string): { date: string; minutes: number } {
  const hourKey = iso.slice(0, 13);
  let offset = offsetByHour.get(hourKey);
  if (offset === undefined) {
    const utcMs = Date.parse(`${hourKey}:00:00Z`);
    const parts = ctFormat.formatToParts(utcMs);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    offset = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour')) - utcMs;
    offsetByHour.set(hourKey, offset);
  }
  const local = new Date(Date.parse(iso) + offset);
  return {
    date: local.toISOString().slice(0, 10),
    minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}

// 메시지가 속한 세션의 기준 날짜(달력 날짜). 휴일·주말이면 실제 거래일은 그 뒤 첫 거래일이다
export function sessionDate(iso: string): string {
  const { date, minutes } = ctClock(iso);
  return minutes >= SESSION_ROLL_MINUTES ? addDays(date, 1) : date;
}

export type ContractInfo = {
  instrumentId: string;
  symbol: string;
  commodityCode: CommodityCode;
  contractMonth: string;
  // 상장 시각의 세션 날짜. 실제 첫 거래일 이하(주말이면 그 전 금요일)라 수집 대상 필터에만 쓴다
  firstTradeDate: string;
  lastTradeDate: string;
};

// 단일 월물 raw 심볼의 원자재 코드 뒤: 월 코드 + 연도 1자리(CLZ6) 또는 2자리(NGF27, D-088)
const OUTRIGHT_SUFFIX = new RegExp(`^[${MONTH_CODES.join('')}]\\d{1,2}$`);

// definition 행 → 단일 월물 계약. 연도 1자리 심볼 대신 만기 연·월로 표준 심볼을 만든다(D-049)
export function parseDefinition(row: CsvRow): ContractInfo | null {
  if (row.instrument_class !== 'F' || row.security_type !== 'FUT') return null;
  const code = COMMODITY_CODES.find((c) => c === row.asset);
  if (!code || !OUTRIGHT_SUFFIX.test(row.raw_symbol.slice(code.length))) return null;
  const contractMonth = `${row.maturity_year}-${row.maturity_month.padStart(2, '0')}`;
  return {
    instrumentId: row.instrument_id,
    symbol: toContractSymbol(code, contractMonth),
    commodityCode: code,
    contractMonth,
    firstTradeDate: sessionDate(row.activation),
    lastTradeDate: ctClock(row.expiration).date,
  };
}

// 정렬된 배열에서 date 이상인 첫 값 / 이하인 마지막 값
function ceil(sorted: readonly string[], date: string): string | undefined {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < date) lo = mid + 1;
    else hi = mid;
  }
  return sorted[lo];
}

function floor(sorted: readonly string[], date: string): string | undefined {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= date) lo = mid + 1;
    else hi = mid;
  }
  return lo > 0 ? sorted[lo - 1] : undefined;
}

export type LoadedBar = {
  instrumentId: string;
  tradeDate: string;
  open: number | null;
  high: number | null;
  low: number | null;
  settle: number;
  volume: number;
};

type Session = { open: number | null; high: number | null; low: number | null; hlSeen: boolean };

export type BarStats = { bars: number; noVolume: number; noOhlc: number; invalidOhlc: number };

// statistics를 두 번 읽어 일봉을 만든다.
// 1차(addSettlement): 정산가와 거래일(ts_ref)이 있는 확정 거래량. 거래일 = 정산가가 있는 날짜(휴장일 재전송 제외)
// 2차(addSessionStat): 거래일 목록으로 세션을 정해 시가·고가·저가와 ts_ref 없는 거래량
export function createBarBuilder() {
  const key = (instrumentId: string, tradeDate: string) => `${instrumentId}|${tradeDate}`;
  const settles = new Map<string, number>();
  const volumes = new Map<string, number>();
  // ts_ref 없는 거래량. ts_ref 값이 있으면 그쪽이 우선이다
  const lateVolumes = new Map<string, number>();
  const sessions = new Map<string, Session>();
  let tradeDates: string[] | null = null;

  function addSettlement(row: CsvRow): void {
    if (row.ts_ref === '') return;
    const tradeDate = row.ts_ref.slice(0, 10);
    // 주말 ts_ref는 월물 1개짜리 잘못 붙은 재전송이다(2011-08-07 GCZ1, 2014-02-23 CLJ4)
    const dow = new Date(`${tradeDate}T00:00:00Z`).getUTCDay();
    if (tradeDate < FIRST_TRADE_DATE || dow === 0 || dow === 6) return;
    // 같은 월물·거래일은 마지막 메시지가 확정값이다(잠정 → 확정, 재전송)
    if (row.stat_type === SETTLEMENT_PRICE) {
      settles.set(key(row.instrument_id, tradeDate), Number(row.price));
    } else if (row.stat_type === CLEARED_VOLUME) {
      volumes.set(key(row.instrument_id, tradeDate), Number(row.quantity));
    }
  }

  // 정산가가 있는 날짜 중 모든 월물 정산가가 직전 거래일과 같은 날은 휴장일 재전송이다
  // (성금요일·2010-12-24, 고가·저가 없음). 거래일에서 빼야 ts_ref 없는 거래량도 직전 거래일에 붙는다
  function getTradeDates(): string[] {
    if (tradeDates) return tradeDates;
    const byDate = new Map<string, Map<string, number>>();
    for (const [k, settle] of settles) {
      const sep = k.indexOf('|');
      const date = k.slice(sep + 1);
      let day = byDate.get(date);
      if (!day) {
        day = new Map();
        byDate.set(date, day);
      }
      day.set(k.slice(0, sep), settle);
    }
    const dates: string[] = [];
    let prev: Map<string, number> | undefined;
    for (const date of [...byDate.keys()].sort()) {
      const day = byDate.get(date)!;
      let shared = 0;
      let changed = false;
      for (const [id, settle] of day) {
        const before = prev?.get(id);
        if (before === undefined) continue;
        shared++;
        if (before !== settle) changed = true;
      }
      if (shared > 0 && !changed) continue;
      dates.push(date);
      prev = day;
    }
    tradeDates = dates;
    return tradeDates;
  }

  function addSessionStat(row: CsvRow): void {
    const dates = getTradeDates();
    if (row.stat_type === CLEARED_VOLUME) {
      if (row.ts_ref !== '') return;
      // 마감 뒤 처음 받은 값이 그 거래일 확정 거래량이다(재전송은 무시)
      const { date, minutes } = ctClock(row.ts_recv);
      const tradeDate = floor(dates, minutes >= CLOSE_MINUTES ? date : addDays(date, -1));
      const k = tradeDate && key(row.instrument_id, tradeDate);
      if (k && !lateVolumes.has(k)) lateVolumes.set(k, Number(row.quantity));
      return;
    }
    const isOpen = row.stat_type === OPENING_PRICE;
    if (!isOpen && row.stat_type !== SESSION_LOW && row.stat_type !== SESSION_HIGH) return;
    const tradeDate = ceil(dates, sessionDate(row.ts_event));
    if (!tradeDate) return;
    const k = key(row.instrument_id, tradeDate);
    let s = sessions.get(k);
    if (!s) {
      s = { open: null, high: null, low: null, hlSeen: false };
      sessions.set(k, s);
    }
    const price = Number(row.price);
    if (isOpen) {
      // 개장 전 경매 동안 시가가 여러 번 갱신된다. 첫 체결(고가·저가) 전 마지막 값이 시가이고,
      // 체결과 같은 시각에 오면(MDP3) 그 뒤 첫 값이다
      if (!s.hlSeen || s.open === null) s.open = price;
      return;
    }
    s.hlSeen = true;
    if (row.stat_type === SESSION_HIGH) s.high = s.high === null ? price : Math.max(s.high, price);
    else s.low = s.low === null ? price : Math.min(s.low, price);
  }

  function bars(): { bars: LoadedBar[]; stats: BarStats } {
    const stats: BarStats = { bars: 0, noVolume: 0, noOhlc: 0, invalidOhlc: 0 };
    const out: LoadedBar[] = [];
    const dates = new Set(getTradeDates());
    for (const [k, settle] of settles) {
      const sep = k.indexOf('|');
      if (!dates.has(k.slice(sep + 1))) continue;
      const volume = volumes.get(k) ?? lateVolumes.get(k);
      if (volume === undefined) stats.noVolume++;
      let { open, high, low } = sessions.get(k) ?? { open: null, high: null, low: null };
      if (high === null || low === null) {
        stats.noOhlc++;
        open = high = low = null;
      } else if (low > high || (open !== null && (open < low || open > high))) {
        stats.invalidOhlc++;
        open = high = low = null;
      }
      out.push({
        instrumentId: k.slice(0, sep),
        tradeDate: k.slice(sep + 1),
        open,
        high,
        low,
        settle,
        volume: volume ?? 0,
      });
    }
    stats.bars = out.length;
    return { bars: out, stats };
  }

  return { addSettlement, addSessionStat, tradeDates: getTradeDates, bars };
}
