// 국내 ETP 운용사·발행사 홈페이지(C-d-a 운용사 페이지 버튼). 상품별 주소를 주는 소스가 없어
// 종목명 첫 단어(브랜드, sources/krxEtpName.ts)로 고정표를 둔다. 새 브랜드가 나오면 여기에 더한다.
export const KRX_ISSUER_URLS: Readonly<Record<string, string>> = {
  // ETF 운용사
  KODEX: 'https://www.samsungfund.com/etf/main.do',
  TIGER: 'https://investments.miraeasset.com/tigeretf/',
  ACE: 'https://www.aceetf.co.kr/',
  // ETN 발행사
  KB: 'https://www.kbsec.com/',
  N2: 'https://www.nhsec.com/',
  메리츠: 'https://home.imeritz.com/',
  미래에셋: 'https://securities.miraeasset.com/',
  삼성: 'https://www.samsungpop.com/',
  신한: 'https://www.shinhansec.com/',
  하나: 'https://www.hanaw.com/',
  한투: 'https://securities.koreainvestment.com/',
};

export const krxIssuerUrl = (issuer: string): string | null => KRX_ISSUER_URLS[issuer] ?? null;
