import { describe, expect, it, vi } from 'vitest';
import {
  createKrxEtpSource,
  krxAumByTicker,
  krxTradingValueByTicker,
  toKrxEtpEntries,
} from './krxEtp.ts';

// 2026-10-27 실제 응답에서 고른 행(필요한 필드만)
const ETF_ROWS = [
  { ISU_CD: '261220', ISU_NM: 'KODEX WTI원유선물(H)', IDX_IND_NM: 'S&P GSCI Crude Oil Index ER' },
  { ISU_CD: '474800', ISU_NM: 'KIWOOM 미국원유에너지기업', IDX_IND_NM: 'MSCI US IMI Energy' },
];
const ETN_ROWS = [
  {
    ISU_CD: '580068',
    ISU_NM: 'KB S&P 레버리지 WTI원유 선물 ETN B',
    IDX_IND_NM: 'DJCI Crude Oil 2X Leverage TR',
  },
];

const response = (rows: unknown[]) => Response.json({ OutBlock_1: rows });

describe('toKrxEtpEntries', () => {
  it('원자재 선물 상품만 남기고 이름·시리즈·기초지수를 붙인다', () => {
    expect(toKrxEtpEntries(ETF_ROWS, 'ETF')).toEqual([
      {
        ticker: '261220',
        type: 'ETF',
        name: 'KODEX WTI원유선물(H)',
        issuer: 'KODEX',
        commodityCode: 'CL',
        leverage: 1,
        fxHedge: 'HEDGED',
        series: null,
        underlyingIndex: 'S&P GSCI Crude Oil Index ER',
      },
    ]);
    expect(toKrxEtpEntries(ETN_ROWS, 'ETN')).toMatchObject([
      { ticker: '580068', type: 'ETN', issuer: 'KB', leverage: 2, series: 'B' },
    ]);
  });

  it('기초지수가 비면 null', () => {
    expect(
      toKrxEtpEntries(
        [{ ISU_CD: '261220', ISU_NM: 'KODEX WTI원유선물(H)', IDX_IND_NM: '' }],
        'ETF',
      ),
    ).toMatchObject([{ underlyingIndex: null }]);
  });
});

describe('금액 필드', () => {
  const day = {
    etf: [
      {
        ISU_CD: '261220',
        ISU_NM: 'KODEX WTI원유선물(H)',
        ACC_TRDVAL: '867291785',
        MKTCAP: '36055500000',
        INVSTASST_NETASST_TOTAMT: '35893665344',
      },
      { ISU_CD: '261221', ISU_NM: 'x', ACC_TRDVAL: '-', INVSTASST_NETASST_TOTAMT: '' },
    ],
    etn: [{ ISU_CD: '580068', ISU_NM: 'y', ACC_TRDVAL: '0', MKTCAP: '65080000000' }],
  };

  it('순자산은 ETF 순자산총액, ETN 시가총액이고 숫자가 아닌 값은 뺀다', () => {
    expect(krxAumByTicker(day)).toEqual(
      new Map([
        ['261220', 35893665344],
        ['580068', 65080000000],
      ]),
    );
  });

  it('거래대금은 ACC_TRDVAL이고 0은 남긴다', () => {
    expect(krxTradingValueByTicker(day)).toEqual(
      new Map([
        ['261220', 867291785],
        ['580068', 0],
      ]),
    );
  });
});

// 요청을 기록하고 정해 둔 응답을 돌려준다
function fakeApi(respond: (url: string) => Response) {
  const calls: { url: string; authKey: string | null }[] = [];
  const fetchFn = vi.fn((input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString();
    calls.push({ url, authKey: new Headers(init?.headers).get('AUTH_KEY') });
    return Promise.resolve(respond(url));
  });
  return { fetchFn, calls };
}

describe('createKrxEtpSource', () => {
  it('basDd·AUTH_KEY로 ETF·ETN 하루치를 받는다', async () => {
    const { fetchFn, calls } = fakeApi((url) =>
      response(url.includes('etf_') ? ETF_ROWS : ETN_ROWS),
    );
    const source = createKrxEtpSource({ apiKey: 'k', fetchFn });

    expect(await source.fetchDay('2026-10-27')).toEqual({ etf: ETF_ROWS, etn: ETN_ROWS });
    expect(calls).toEqual([
      { url: 'https://data-dbg.krx.co.kr/svc/apis/etp/etf_bydd_trd?basDd=20261027', authKey: 'k' },
      { url: 'https://data-dbg.krx.co.kr/svc/apis/etp/etn_bydd_trd?basDd=20261027', authKey: 'k' },
    ]);
  });

  it.each([
    ['키가 없으면', undefined, () => response(ETF_ROWS), 'KRX_API_KEY is not set'],
    ['HTTP 실패면', 'k', () => new Response('', { status: 401 }), 'KRX etf_bydd_trd: HTTP 401'],
    ['응답 형식이 바뀌면', 'k', () => Response.json({ rows: [] }), 'OutBlock_1'],
  ])('%s 던진다', async (_, apiKey, respond, message) => {
    const { fetchFn } = fakeApi(respond);
    await expect(createKrxEtpSource({ apiKey, fetchFn }).fetchDay('2026-10-27')).rejects.toThrow(
      message,
    );
  });
});
