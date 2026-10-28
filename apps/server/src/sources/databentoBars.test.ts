import { describe, expect, it } from 'vitest';
import { createBarBuilder, ctClock, parseDefinition, sessionDate } from './databentoBars.ts';

type Stat = {
  recv: string;
  event?: string;
  ref?: string;
  type: string;
  price?: string;
  qty?: string;
};

const stat = (s: Stat, id = '100') => ({
  ts_recv: s.recv,
  ts_event: s.event ?? s.recv,
  instrument_id: id,
  ts_ref: s.ref ?? '',
  price: s.price ?? '',
  quantity: s.qty ?? '',
  stat_type: s.type,
});

describe('ctClock·sessionDate', () => {
  it('서머타임을 반영해 CT 날짜·분을 낸다', () => {
    expect(ctClock('2024-01-02T23:00:00.000000000Z')).toEqual({
      date: '2024-01-02',
      minutes: 17 * 60,
    });
    expect(ctClock('2024-07-02T22:00:00.000000000Z')).toEqual({
      date: '2024-07-02',
      minutes: 17 * 60,
    });
  });

  it('16:45 CT 이후는 다음 날 세션이다', () => {
    expect(sessionDate('2024-01-02T22:44:59Z')).toBe('2024-01-02');
    // 개장 전 경매(16:52 CT)
    expect(sessionDate('2011-01-04T22:52:05Z')).toBe('2011-01-05');
  });
});

describe('parseDefinition', () => {
  const row = {
    instrument_id: '200430',
    raw_symbol: 'CLN4',
    instrument_class: 'F',
    security_type: 'FUT',
    asset: 'CL',
    maturity_year: '2024',
    maturity_month: '7',
    activation: '2018-01-19T22:30:00.000000000Z',
    expiration: '2024-06-20T18:30:00.000000000Z',
  };

  it('만기 연·월로 표준 심볼을 만들고 최종 거래일은 CT 날짜다', () => {
    expect(parseDefinition(row)).toEqual({
      instrumentId: '200430',
      symbol: 'CLN24',
      commodityCode: 'CL',
      contractMonth: '2024-07',
      firstTradeDate: '2018-01-19',
      lastTradeDate: '2024-06-20',
    });
  });

  it('연도 2자리 raw 심볼도 만기 연·월로 매핑한다', () => {
    expect(
      parseDefinition({ ...row, raw_symbol: 'CLF30', maturity_year: '2030', maturity_month: '1' }),
    ).toMatchObject({ symbol: 'CLF30', contractMonth: '2030-01' });
  });

  it('스프레드·옵션·다른 상품은 버린다', () => {
    expect(parseDefinition({ ...row, instrument_class: 'S' })).toBeNull();
    expect(parseDefinition({ ...row, asset: 'HO' })).toBeNull();
    expect(parseDefinition({ ...row, raw_symbol: 'CLN4-CLQ4' })).toBeNull();
  });
});

describe('createBarBuilder', () => {
  it('정산가는 거래일별 마지막 메시지, 거래일은 정산가가 있는 날짜다', () => {
    const b = createBarBuilder();
    b.addSettlement(
      stat({ recv: '2024-01-02T20:00:00Z', ref: '2024-01-02T00:00:00Z', type: '3', price: '70.1' }),
    );
    b.addSettlement(
      stat({
        recv: '2024-01-02T22:37:00Z',
        ref: '2024-01-02T00:00:00Z',
        type: '3',
        price: '70.38',
      }),
    );
    b.addSettlement(
      stat({ recv: '2024-01-03T22:00:00Z', ref: '2024-01-03T00:00:00Z', type: '3', price: '72' }),
    );
    // ts_ref 없는 재전송, 데이터셋 시작 전 거래일, 주말
    b.addSettlement(stat({ recv: '2024-01-03T00:20:00Z', type: '3', price: '1' }));
    b.addSettlement(
      stat({ recv: '2010-06-06T23:00:00Z', ref: '2010-06-04T00:00:00Z', type: '3', price: '1' }),
    );
    b.addSettlement(
      stat({ recv: '2014-02-23T19:00:00Z', ref: '2014-02-23T00:00:00Z', type: '3', price: '1' }),
    );
    expect(b.tradeDates()).toEqual(['2024-01-02', '2024-01-03']);
    expect(b.bars().bars.map((x) => [x.tradeDate, x.settle])).toEqual([
      ['2024-01-02', 70.38],
      ['2024-01-03', 72],
    ]);
  });

  it('시가는 첫 체결 전 마지막 값, 고가·저가는 세션 최대·최소다. 휴일·주말 메시지는 다음 거래일이다', () => {
    const b = createBarBuilder();
    for (const ref of ['2011-01-04', '2011-01-05']) {
      b.addSettlement(
        stat({ recv: `${ref}T21:00:00Z`, ref: `${ref}T00:00:00Z`, type: '3', price: '90' }),
      );
    }
    const s = (event: string, type: string, price: string) =>
      b.addSessionStat(stat({ recv: event, type, price }));
    // 2011-01-04 세션 끝(전 거래일)
    s('2011-01-04T21:30:00Z', '5', '95');
    // 2011-01-05 세션: 개장 전 경매 → 체결
    s('2011-01-04T22:52:05Z', '1', '90.39');
    s('2011-01-04T22:59:59Z', '1', '90.31');
    s('2011-01-05T00:00:00Z', '5', '90.31');
    s('2011-01-05T00:00:00Z', '4', '90.31');
    s('2011-01-05T01:00:00Z', '5', '90.45');
    s('2011-01-05T07:00:00Z', '4', '89.95');
    s('2011-01-05T15:00:00Z', '1', '89');
    const bar = b.bars().bars.find((x) => x.tradeDate === '2011-01-05');
    expect(bar).toMatchObject({ open: 90.31, high: 90.45, low: 89.95 });
  });

  it('체결과 같은 시각의 시가(MDP3)도 잡는다', () => {
    const b = createBarBuilder();
    b.addSettlement(
      stat({ recv: '2024-01-03T21:00:00Z', ref: '2024-01-03T00:00:00Z', type: '3', price: '72' }),
    );
    for (const type of ['5', '4', '1']) {
      b.addSessionStat(stat({ recv: '2024-01-02T23:00:00Z', type, price: '70.5' }));
    }
    b.addSessionStat(stat({ recv: '2024-01-03T15:00:00Z', type: '5', price: '73' }));
    expect(b.bars().bars[0]).toMatchObject({ open: 70.5, high: 73, low: 70.5 });
  });

  it('거래량은 ts_ref 값이 우선이고, 없으면 마감 뒤 처음 받은 값을 직전 거래일에 붙인다', () => {
    const b = createBarBuilder();
    for (const ref of ['2014-11-26', '2014-11-28', '2014-12-01']) {
      b.addSettlement(
        stat({ recv: `${ref}T21:00:00Z`, ref: `${ref}T00:00:00Z`, type: '3', price: '1' }),
      );
    }
    const v = (recv: string, qty: string, ref?: string) =>
      b.addSessionStat(stat({ recv, type: '6', qty, ref }));
    // 11-26 마감 뒤 → 11-26, 추수감사절(11-27) 재전송은 무시
    v('2014-11-26T23:30:00Z', '500');
    v('2014-11-27T23:30:00Z', '999');
    // 11-28 마감(16:00 CT) 전에 받은 값은 11-26 것 → 이미 있으니 무시
    v('2014-11-28T21:00:00Z', '888');
    v('2014-11-28T23:00:00Z', '300');
    b.addSettlement(
      stat({ recv: '2014-12-01T23:00:00Z', ref: '2014-12-01T00:00:00Z', type: '6', qty: '700' }),
    );
    v('2014-12-01T23:30:00Z', '1');
    const { bars, stats } = b.bars();
    expect(bars.map((x) => [x.tradeDate, x.volume])).toEqual([
      ['2014-11-26', 500],
      ['2014-11-28', 300],
      ['2014-12-01', 700],
    ]);
    expect(stats.noVolume).toBe(0);
  });

  it('거래가 없거나 OHLC가 어긋나면 OHLC를 비운다', () => {
    const b = createBarBuilder();
    for (const id of ['1', '2']) {
      b.addSettlement(
        stat(
          { recv: '2024-01-03T21:00:00Z', ref: '2024-01-03T00:00:00Z', type: '3', price: '72' },
          id,
        ),
      );
    }
    b.addSessionStat(stat({ recv: '2024-01-03T15:00:00Z', type: '1', price: '80' }, '2'));
    b.addSessionStat(stat({ recv: '2024-01-03T15:00:00Z', type: '5', price: '73' }, '2'));
    b.addSessionStat(stat({ recv: '2024-01-03T15:00:00Z', type: '4', price: '71' }, '2'));
    const { bars, stats } = b.bars();
    expect(bars.map((x) => [x.open, x.high, x.low, x.volume])).toEqual([
      [null, null, null, 0],
      [null, null, null, 0],
    ]);
    expect(stats).toEqual({ bars: 2, noVolume: 2, noOhlc: 1, invalidOhlc: 1 });
  });
});
