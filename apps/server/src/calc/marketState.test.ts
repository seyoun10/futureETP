import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  INTRADAY_EXPECTED_MS,
  SETTLE_AT,
  SETTLE_STEP1_EXPECTED_MS,
  findSessionDay,
  lastClosedTradeDate,
  marketStatus,
  type TradingDaySession,
} from './marketState.ts';
import {
  CME_TIME_ZONE,
  buildTradingDays,
  zonedTimeToUtc,
  type CalendarInput,
} from './tradingCalendar.ts';

const loadYear = (year: number): CalendarInput =>
  JSON.parse(
    readFileSync(new URL(`../../../../scripts/calendar/${year}.json`, import.meta.url), 'utf8'),
  ) as CalendarInput;

const days: TradingDaySession[] = [
  ...buildTradingDays(loadYear(2026)),
  ...buildTradingDays(loadYear(2027)),
];

// CT 벽시계 시각 → UTC Date
const ct = (date: string, time: string) => zonedTimeToUtc(date, time, CME_TIME_ZONE);

const pastRow = (tradeDate: string): TradingDaySession => ({
  tradeDate,
  sessionOpenAt: null,
  sessionCloseAt: null,
  haltStartAt: null,
  haltEndAt: null,
});

describe('상수', () => {
  it('일일 정산은 16:05 CT, ①은 약 25분, 장중 배치 예상 시간은 1분이다', () => {
    expect(SETTLE_AT).toBe('16:05');
    expect(SETTLE_STEP1_EXPECTED_MS).toBe(25 * 60_000);
    expect(INTRADAY_EXPECTED_MS).toBe(60_000);
  });
});

describe('findSessionDay', () => {
  it('평일 장중이면 그날이 세션 거래일이다', () => {
    expect(findSessionDay(ct('2026-10-21', '10:07'), days)).toBe('2026-10-21');
  });

  it('17:00 CT에 다음 거래일 세션이 시작된다(개장 시각 포함)', () => {
    expect(findSessionDay(ct('2026-10-21', '17:00'), days)).toBe('2026-10-22');
    expect(findSessionDay(ct('2026-10-21', '17:30'), days)).toBe('2026-10-22');
  });

  it('16:00~17:00 CT 휴식 시간에는 세션이 없다(마감 시각 제외)', () => {
    expect(findSessionDay(ct('2026-10-21', '16:00'), days)).toBeNull();
    expect(findSessionDay(ct('2026-10-21', '16:30'), days)).toBeNull();
  });

  it('주말에는 세션이 없다', () => {
    expect(findSessionDay(ct('2026-10-24', '12:00'), days)).toBeNull();
  });

  it('공휴일 중간 정지 구간도 다음 거래일 세션에 속한다', () => {
    expect(findSessionDay(ct('2026-11-26', '14:00'), days)).toBe('2026-11-27');
  });

  it('조기 마감 뒤에는 세션이 없다', () => {
    expect(findSessionDay(ct('2026-11-27', '13:00'), days)).toBeNull();
  });

  it('세션 시각이 빈 과거 행은 무시한다', () => {
    const rows = [pastRow('2026-10-20'), ...days.filter((d) => d.tradeDate >= '2026-10-21')];
    expect(findSessionDay(ct('2026-10-20', '10:00'), rows)).toBeNull();
    expect(findSessionDay(ct('2026-10-21', '10:00'), rows)).toBe('2026-10-21');
  });

  it('달력이 비어 있으면 null', () => {
    expect(findSessionDay(ct('2026-10-21', '10:00'), [])).toBeNull();
  });
});

describe('lastClosedTradeDate', () => {
  it('마감 시각 정각이면 그날이 마지막 마감 거래일이다', () => {
    expect(lastClosedTradeDate(ct('2026-10-21', '16:00'), days)).toBe('2026-10-21');
  });

  it('마감 직전이면 전 거래일이다', () => {
    expect(lastClosedTradeDate(ct('2026-10-21', '15:59'), days)).toBe('2026-10-20');
  });

  it('월요일 장중이면 직전 금요일이다', () => {
    expect(lastClosedTradeDate(ct('2026-10-26', '09:00'), days)).toBe('2026-10-23');
  });

  it('공휴일 중간 정지일은 거래일이 아니라 건너뛴다', () => {
    expect(lastClosedTradeDate(ct('2026-11-26', '14:00'), days)).toBe('2026-11-25');
  });

  it('조기 마감 뒤에는 그날이다', () => {
    expect(lastClosedTradeDate(ct('2026-11-27', '13:00'), days)).toBe('2026-11-27');
  });

  it('세션 시각이 빈 과거 행은 무시한다', () => {
    expect(lastClosedTradeDate(ct('2026-10-21', '10:00'), [pastRow('2026-10-20')])).toBeNull();
  });

  it('달력이 비어 있으면 null', () => {
    expect(lastClosedTradeDate(ct('2026-10-21', '10:00'), [])).toBeNull();
  });
});

describe('marketStatus', () => {
  describe('평일 장중', () => {
    it('직전 거래일 정산이 끝났으면 장중이고 다음 장중 배치 완료 예상 시각을 준다', () => {
      expect(marketStatus(ct('2026-10-21', '10:07'), days, '2026-10-20')).toEqual({
        state: 'OPEN',
        tradeDate: '2026-10-21',
        nextUpdateAt: ct('2026-10-21', '10:16'),
      });
    });

    it('도는 중인 장중 배치가 있으면 그 완료 예상 시각을 준다', () => {
      expect(marketStatus(ct('2026-10-21', '10:00'), days, '2026-10-20').nextUpdateAt).toEqual(
        ct('2026-10-21', '10:01'),
      );
    });

    it('완료 예상 시각 정각이면 그 배치는 끝난 것으로 본다', () => {
      expect(marketStatus(ct('2026-10-21', '10:01'), days, '2026-10-20').nextUpdateAt).toEqual(
        ct('2026-10-21', '10:16'),
      );
    });

    it('마감 직전 마지막 배치 뒤에는 개장 첫 배치(17:00 CT)로 넘어간다(정산 ①은 그 전에 끝남)', () => {
      expect(marketStatus(ct('2026-10-21', '15:52'), days, '2026-10-20')).toEqual({
        state: 'OPEN',
        tradeDate: '2026-10-21',
        nextUpdateAt: ct('2026-10-21', '17:01'),
      });
    });

    it('직전 거래일 정산이 아직이면 장중에도 정산 대기이고 지금 뒤 다음 배치로 미룬다', () => {
      expect(marketStatus(ct('2026-10-21', '10:07'), days, '2026-10-19')).toEqual({
        state: 'SETTLEMENT_PENDING',
        tradeDate: '2026-10-20',
        nextUpdateAt: ct('2026-10-21', '10:16'),
      });
    });

    it('정산 기록이 전혀 없으면 정산 대기다', () => {
      expect(marketStatus(ct('2026-10-21', '10:07'), days, null)).toEqual({
        state: 'SETTLEMENT_PENDING',
        tradeDate: '2026-10-20',
        nextUpdateAt: ct('2026-10-21', '10:16'),
      });
    });
  });

  describe('16~17시 휴식과 야간 정산 대기', () => {
    it('16:20 CT는 휴장이고 정산 ① 예상 완료(16:30) 뒤 첫 배치(17:00 CT) 완료 예상 시각을 준다', () => {
      expect(marketStatus(ct('2026-10-21', '16:20'), days, '2026-10-20')).toEqual({
        state: 'CLOSED',
        tradeDate: '2026-10-21',
        nextUpdateAt: ct('2026-10-21', '17:01'),
      });
    });

    it('마감 시각 정각(16:00 CT)부터 휴장이다', () => {
      expect(marketStatus(ct('2026-10-21', '16:00'), days, '2026-10-20')).toMatchObject({
        state: 'CLOSED',
        tradeDate: '2026-10-21',
      });
    });

    it('17:00 CT 거래일이 바뀐 뒤 직전 거래일 정산 전에는 정산 대기이고 지금 뒤 다음 배치로 미룬다', () => {
      expect(marketStatus(ct('2026-10-21', '17:00'), days, '2026-10-20')).toEqual({
        state: 'SETTLEMENT_PENDING',
        tradeDate: '2026-10-21',
        nextUpdateAt: ct('2026-10-21', '17:16'),
      });
      expect(marketStatus(ct('2026-10-21', '17:30'), days, '2026-10-20')).toEqual({
        state: 'SETTLEMENT_PENDING',
        tradeDate: '2026-10-21',
        nextUpdateAt: ct('2026-10-21', '17:46'),
      });
    });

    it('정산이 끝나면 새 거래일 장중이다', () => {
      expect(marketStatus(ct('2026-10-21', '17:10'), days, '2026-10-21')).toEqual({
        state: 'OPEN',
        tradeDate: '2026-10-22',
        nextUpdateAt: ct('2026-10-21', '17:16'),
      });
    });

    it('개장 전에 정산이 끝나면 휴장이고 개장 첫 배치를 준다', () => {
      expect(marketStatus(ct('2026-10-21', '16:40'), days, '2026-10-21')).toEqual({
        state: 'CLOSED',
        tradeDate: '2026-10-21',
        nextUpdateAt: ct('2026-10-21', '17:01'),
      });
    });
  });

  describe('주말', () => {
    it('금요일 정산이 끝났으면 토요일은 휴장이고 일요일 17:00 개장 뒤 첫 배치를 준다', () => {
      expect(marketStatus(ct('2026-10-24', '12:00'), days, '2026-10-23')).toEqual({
        state: 'CLOSED',
        tradeDate: '2026-10-23',
        nextUpdateAt: ct('2026-10-25', '17:01'),
      });
    });

    it('금요일 정산 전 금요일 마감 뒤에도 일요일 첫 배치를 준다(정산 예상 시각이 더 이르다)', () => {
      expect(marketStatus(ct('2026-10-23', '16:30'), days, '2026-10-22')).toEqual({
        state: 'CLOSED',
        tradeDate: '2026-10-23',
        nextUpdateAt: ct('2026-10-25', '17:01'),
      });
    });

    it('금요일 정산이 끝났으면 일요일 재개는 정산 대기 없이 장중이다', () => {
      // 17:30 슬롯이 막 시작했으므로 그 완료 예상(17:31)이다
      expect(marketStatus(ct('2026-10-25', '17:30'), days, '2026-10-23')).toEqual({
        state: 'OPEN',
        tradeDate: '2026-10-26',
        nextUpdateAt: ct('2026-10-25', '17:31'),
      });
    });

    it('금요일 정산이 실패한 채 일요일 재개면 정산 대기이고 지금 뒤 다음 배치로 미룬다', () => {
      expect(marketStatus(ct('2026-10-25', '17:30'), days, '2026-10-22')).toEqual({
        state: 'SETTLEMENT_PENDING',
        tradeDate: '2026-10-23',
        nextUpdateAt: ct('2026-10-25', '17:46'),
      });
    });

    it('서머타임이 끝나는 주말에는 CST 기준 일요일 17:01를 준다', () => {
      const status = marketStatus(ct('2026-10-31', '12:00'), days, '2026-10-30');
      expect(status).toMatchObject({ state: 'CLOSED', tradeDate: '2026-10-30' });
      expect(status.nextUpdateAt?.toISOString()).toBe('2026-11-01T23:01:00.000Z');
    });
  });

  describe('공휴일 중간 정지와 조기 마감(추수감사절 2026)', () => {
    it('정지 직전 장중이면 정지 구간 배치를 건너뛰고 재개 뒤 첫 배치를 준다', () => {
      expect(marketStatus(ct('2026-11-26', '13:20'), days, '2026-11-25')).toEqual({
        state: 'OPEN',
        tradeDate: '2026-11-27',
        nextUpdateAt: ct('2026-11-26', '17:01'),
      });
    });

    it('정지 시작 시각 정각부터 휴장이다', () => {
      expect(marketStatus(ct('2026-11-26', '13:30'), days, '2026-11-25')).toMatchObject({
        state: 'CLOSED',
        tradeDate: '2026-11-27',
      });
    });

    it('정지 중에는 휴장이고 거래일은 정지 세션이 속한 다음 거래일이다', () => {
      expect(marketStatus(ct('2026-11-26', '14:00'), days, '2026-11-25')).toEqual({
        state: 'CLOSED',
        tradeDate: '2026-11-27',
        nextUpdateAt: ct('2026-11-26', '17:01'),
      });
    });

    it('정지 중이어도 직전 거래일이 미정산이면 정산 대기다', () => {
      expect(marketStatus(ct('2026-11-26', '14:00'), days, '2026-11-24')).toMatchObject({
        state: 'SETTLEMENT_PENDING',
        tradeDate: '2026-11-25',
      });
    });

    it('정지가 끝나는 17:00 CT에 장중으로 돌아온다', () => {
      expect(marketStatus(ct('2026-11-26', '17:00'), days, '2026-11-25')).toEqual({
        state: 'OPEN',
        tradeDate: '2026-11-27',
        nextUpdateAt: ct('2026-11-26', '17:01'),
      });
    });

    it('조기 마감 뒤에는 휴장이고 일요일 개장 뒤 첫 배치를 준다', () => {
      expect(marketStatus(ct('2026-11-27', '13:00'), days, '2026-11-25')).toEqual({
        state: 'CLOSED',
        tradeDate: '2026-11-27',
        nextUpdateAt: ct('2026-11-29', '17:01'),
      });
    });
  });

  describe('전일 휴장일', () => {
    it('크리스마스(금) 전날 마감 뒤에는 일요일 12-27 개장 뒤 첫 배치를 준다', () => {
      expect(marketStatus(ct('2026-12-24', '16:30'), days, '2026-12-23')).toEqual({
        state: 'CLOSED',
        tradeDate: '2026-12-24',
        nextUpdateAt: ct('2026-12-27', '17:01'),
      });
    });

    it('크리스마스 당일은 휴장이고 거래일은 12-24다', () => {
      expect(marketStatus(ct('2026-12-25', '10:00'), days, '2026-12-24')).toEqual({
        state: 'CLOSED',
        tradeDate: '2026-12-24',
        nextUpdateAt: ct('2026-12-27', '17:01'),
      });
    });

    it('연말에서 새해 휴장을 넘어 다음 해 첫 세션을 찾는다', () => {
      const status = marketStatus(ct('2026-12-31', '16:30'), days, '2026-12-30');
      expect(status).toMatchObject({ state: 'CLOSED', tradeDate: '2026-12-31' });
      expect(status.nextUpdateAt?.toISOString()).toBe('2027-01-03T23:01:00.000Z');
    });
  });

  describe('달력 누락', () => {
    it('다음 세션 행이 없으면 nextUpdateAt은 null이다', () => {
      const until1023 = days.filter((d) => d.tradeDate <= '2026-10-23');
      expect(marketStatus(ct('2026-10-24', '12:00'), until1023, '2026-10-23')).toEqual({
        state: 'CLOSED',
        tradeDate: '2026-10-23',
        nextUpdateAt: null,
      });
    });

    it('달력이 비어 있으면 휴장·거래일 없음·nextUpdateAt null이다', () => {
      expect(marketStatus(ct('2026-10-21', '10:00'), [], '2026-10-20')).toEqual({
        state: 'CLOSED',
        tradeDate: null,
        nextUpdateAt: null,
      });
    });

    it('세션 시각이 빈 과거 행만 있으면 달력이 빈 것과 같다', () => {
      expect(
        marketStatus(
          ct('2026-10-21', '10:00'),
          [pastRow('2026-10-19'), pastRow('2026-10-20')],
          null,
        ),
      ).toEqual({ state: 'CLOSED', tradeDate: null, nextUpdateAt: null });
    });

    it('세션 시각이 빈 과거 행 뒤의 정상 행은 그대로 판단한다', () => {
      const rows = [pastRow('2026-10-20'), ...days.filter((d) => d.tradeDate >= '2026-10-21')];
      expect(marketStatus(ct('2026-10-21', '10:07'), rows, '2026-10-20')).toEqual({
        state: 'OPEN',
        tradeDate: '2026-10-21',
        nextUpdateAt: ct('2026-10-21', '10:16'),
      });
    });
  });
});
