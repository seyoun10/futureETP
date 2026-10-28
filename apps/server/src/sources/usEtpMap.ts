// 미국 원자재 선물 ETP 매핑표(D-016). 기초지수·선물 기반 여부를 주는 구조화 필드가 없어 심볼마다 사람이 정한다.
// 스크리너 이름에 원자재 단어가 있는데 매핑표·제외 목록 어디에도 없으면 새 후보다(확인 알림, D-025).
// 새 후보를 확인하면 US_ETP_MAP이나 US_ETP_EXCLUDED에 더한다(research/etp-sources.md 미국 상품).
import type { CommodityCode, EtpType } from '@futureetp/shared';
import type { UsListing } from './nasdaqEtp.ts';

export type UsEtpMapping = {
  commodityCode: CommodityCode;
  type: EtpType;
  leverage: number;
  issuer: string;
  // 선물 월물을 직접 굴리는 펀드(USO 등)는 지수가 없다
  underlyingIndex: string | null;
  // roll_rule.rule_id와 같은 체계(D-024). 재현하지 않는 규칙은 이름만 둔다
  rollRuleRef: string;
};

const PROSHARES = 'ProShares';
const USCF = 'USCF';
const INVESCO = 'Invesco';
const DEUTSCHE_BANK = 'Deutsche Bank';

const BCOM_CL = 'Bloomberg Commodity Balanced WTI Crude Oil Index';
const BCOM_NG = 'Bloomberg Natural Gas Subindex';
const BCOM_GC = 'Bloomberg Gold Subindex';
const BCOM_SI = 'Bloomberg Silver Subindex';
const DBIQ_CL = 'DBIQ Optimum Yield Crude Oil Index Excess Return';
const DBIQ_GC = 'Deutsche Bank Liquid Commodity Index-Optimum Yield Gold Excess Return';

const etf = (
  commodityCode: CommodityCode,
  leverage: number,
  issuer: string,
  underlyingIndex: string | null,
  rollRuleRef: string,
): UsEtpMapping => ({ commodityCode, type: 'ETF', leverage, issuer, underlyingIndex, rollRuleRef });

export const US_ETP_MAP: Readonly<Record<string, UsEtpMapping>> = {
  UCO: etf('CL', 2, PROSHARES, BCOM_CL, 'BCBCLI'),
  SCO: etf('CL', -2, PROSHARES, BCOM_CL, 'BCBCLI'),
  OILK: etf('CL', 1, PROSHARES, BCOM_CL, 'BCBCLI'),
  USO: etf('CL', 1, USCF, null, 'USO'),
  USL: etf('CL', 1, USCF, null, 'USCF_12M'),
  DBO: etf('CL', 1, INVESCO, DBIQ_CL, 'DBIQ_OY'),
  BOIL: etf('NG', 2, PROSHARES, BCOM_NG, 'BCOM'),
  KOLD: etf('NG', -2, PROSHARES, BCOM_NG, 'BCOM'),
  UNG: etf('NG', 1, USCF, null, 'UNG'),
  UNL: etf('NG', 1, USCF, null, 'USCF_12M'),
  UGL: etf('GC', 2, PROSHARES, BCOM_GC, 'BCOM'),
  GLL: etf('GC', -2, PROSHARES, BCOM_GC, 'BCOM'),
  DGP: { ...etf('GC', 2, DEUTSCHE_BANK, DBIQ_GC, 'DBIQ_OY'), type: 'ETN' },
  DGZ: { ...etf('GC', -1, DEUTSCHE_BANK, DBIQ_GC, 'DBIQ_OY'), type: 'ETN' },
  DZZ: { ...etf('GC', -2, DEUTSCHE_BANK, DBIQ_GC, 'DBIQ_OY'), type: 'ETN' },
  AGQ: etf('SI', 2, PROSHARES, BCOM_SI, 'BCOM'),
  ZSL: etf('SI', -2, PROSHARES, BCOM_SI, 'BCOM'),
};

export const US_ISSUER_URLS: Readonly<Record<string, string>> = {
  [PROSHARES]: 'https://www.proshares.com/',
  [USCF]: 'https://www.uscfinvestments.com/',
  [INVESCO]: 'https://www.invesco.com/us/en/',
  [DEUTSCHE_BANK]: 'https://www.db.com/',
};

// 확인을 마친 대상 밖 상품(2026-10-28 스크리너): 현물 신탁과 그 레버리지(GLD·SLV·UGLD·USLV·SHNY·DULL),
// 커버드콜·옵션 수익·전략형(GLDI·SLVO·USOI·GOLY·YGLD 등), Brent(BNO), 천연가스 인프라 주식(FCG·LNGX 등)
export const US_ETP_EXCLUDED: ReadonlySet<string> = new Set([
  'AAAU',
  'BAR',
  'BGLD',
  'BNO',
  'BTGD',
  'CEF',
  'DULL',
  'FCG',
  'GASZ',
  'GLD',
  'GLDI',
  'GLDM',
  'GLDN',
  'GLDW',
  'GOEX',
  'GOLI',
  'GOLY',
  'IAU',
  'IAUI',
  'IAUM',
  'IGLD',
  'ISBG',
  'KGLD',
  'KSLV',
  'LNGX',
  'NRGD',
  'NRGU',
  'OUNZ',
  'PHYS',
  'PSLV',
  'SGOL',
  'SHNY',
  'SIVR',
  'SLV',
  'SLVO',
  'SLVX',
  'SLVY',
  'UGLD',
  'USG',
  'USLV',
  'USNG',
  'USOI',
  'USOY',
  'YGLD',
]);

// 이름에 대상 원자재 단어가 있으면 후보
const COMMODITY_NAME = /crude|\boil\b|natural gas|\bgold\b|silver|\bwti\b/i;
// 광산·에너지 기업 주식 ETF는 자주 새로 나와 이름으로 뺀다
const EQUITY_NAME = /miners?\b|oil (?:&|and) gas|oil (?:refiners|services|equipment)/i;

export type UsEtpClassification = {
  mapped: (UsListing & { mapping: UsEtpMapping })[];
  // 매핑표·제외 목록에 없는 원자재 이름 상품
  candidates: UsListing[];
};

export function classifyUsListings(listings: readonly UsListing[]): UsEtpClassification {
  const result: UsEtpClassification = { mapped: [], candidates: [] };
  for (const listing of listings) {
    const mapping = US_ETP_MAP[listing.symbol] as UsEtpMapping | undefined;
    if (mapping) {
      result.mapped.push({ ...listing, mapping });
    } else if (
      !US_ETP_EXCLUDED.has(listing.symbol) &&
      COMMODITY_NAME.test(listing.name) &&
      !EQUITY_NAME.test(listing.name)
    ) {
      result.candidates.push(listing);
    }
  }
  return result;
}
