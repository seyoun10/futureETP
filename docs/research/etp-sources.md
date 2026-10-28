# 리서치: ETP 목록·속성 소스

> Step 2 리서치 4/5 (2026-10-22). 상품 수와 금액은 이날 조회 기준이다.

## 핵심 결론
- 국내 ETN 기초지수 전수 확인: 확인된 지수 계열 4개(S&P GSCI, DJCI, Bloomberg Single, Solactive 5-Day Roll)는 네 원자재 모두 **월물 일정과 비중 변경 시점이 같다**. 기초지수를 확인하지 못한 ETN도 이 계열 중 하나로 보이므로 한국형 = GSCI 일정(D-013)이 유지된다.
- 미국 금에 ③에서 빠뜨린 DB 금 ETN 3종(DGP·DGZ·DZZ, DBIQ Optimum Yield Gold)이 있다. 상품 수만 세면 미국형 GC의 다수가 BCOM(2종)에서 Optimum Yield(3종)로 바뀐다. DGZ·DZZ는 순자산이 각각 약 $1M이라 최소 순자산 하한(D-015)으로 제외해 BCOM을 유지한다.
- 국내 목록·속성: 네이버 모바일 API로 ETF·ETN 목록, ETF 순자산·보수·운용사를 받을 수 있다. ETN의 기초지수·만기일은 무료 공개 소스에서 찾지 못했다(KRX 정보데이터시스템은 로그인 필요).
- 미국 목록·속성: Nasdaq ETF 스크리너(이름만)로 후보를 찾고, Yahoo quoteSummary로 순자산·운용사·보수·설정일을 받는다. 기초지수·선물 기반 여부는 구조화된 필드가 없다.
- ETN 후속 시리즈 묶기: (발행사, 원자재, 배수, 환헤지)로 묶으면 현재 국내 목록에서 겹치는 조합은 실제 시리즈 짝 하나뿐이다.

## 국내 ETN 기초지수 확인 결과
| 지수 계열 | 확인한 상품 | 월물 일정 | 비중 변경 | 근거 |
|---|---|---|---|---|
| S&P GSCI | 국내 ETF 전부 | 기준 | 5~9영업일 종가 80·60·40·20·0% | ③ |
| DJCI | 미래에셋 천연가스 B·인버스 B, KB S&P WTI B 2종(이름은 S&P, 지수는 DJCI), 삼성 천연가스 D 2종 | GSCI와 같음 | 같음 | 미래에셋·KB 지수 문서 |
| Bloomberg Single | 신한 블룸버그 WTI 2종, KB 천연가스 B 2종, 미래에셋 ±1.5X 천연가스 | CL·NG 매월, GC G J J M M Q Q Z Z Z Z G+, SI H H K K N N U U Z Z Z H+ (GSCI와 같음) | 문서는 "6~10영업일"이지만 예시상 5영업일 종가에 80%(BCOM과 같은 표기 방식) | Bloomberg Single Commodity 방법론 Table 3·4, 신한·KB 문서 |
| Solactive 5-Day Roll | KB·메리츠·한투 솔랙티브 금, KB 솔랙티브 천연가스 (미래에셋 WTI는 Solactive WTI, ③에서 같은 규칙 확인) | 금 Feb Apr Apr Jun Jun Aug Aug Dec Dec Dec Dec Feb+, 은 Mar Mar May May Jul Jul Sep Sep Dec Dec Dec Mar+, NG 매월 (모두 GSCI와 같음) | 6영업일 가중치 0.8로 당일 수익률 계산 = GSCI의 "5영업일 종가 80%"와 같은 시점 | Solactive Future Roll 가이드라인 2.3·3.1.1, SOF5GCS0·SOF5SIS0·SOF5NGS0 |

- 삼성·한투 "블룸버그" WTI ETN의 지수명은 기사·문서에서 확인하지 못했다. 신한 같은 계열 상품이 Bloomberg WTI Single이므로 같다고 본다.
- 기초지수 미확인(약 25종): 삼성 금·은, 신한 금·은, 한투 금·은·WTI, KB 은, 메리츠 WTI·천연가스·은, 하나 WTI·천연가스, N2 천연가스. 모두 위 4계열 중 하나로 보인다.
- 영업일 달력은 계열별로 다르다(GSCI NYSE, Bloomberg BCOM, Solactive 자체 산출일). 하루 어긋나는 날이 드물게 생기지만 규칙 식별자는 `GSCI` 하나로 둔다.

## 국내 상품 수 (네이버 모바일 API, 2026-10-22)
| 원자재 | ETF | ETN |
|---|---|---|
| CL | KODEX WTI원유선물(H)·인버스(H), TIGER 원유선물Enhanced(H)·인버스(H) | 18 |
| NG | 0 | 22 |
| GC | KODEX 골드선물(H)·인버스(H), TIGER 골드선물(H), ACE 골드선물 레버리지(합성 H) | 14 |
| SI | KODEX 은선물(H) | 17 |

- SOL 국제금(0066W0)은 현물 기반이라 제외한다.
- TIGER 원유선물Enhanced(H)는 기초지수가 S&P GSCI Crude Oil Enhanced(월물 선택 규칙이 다름)다. 상품 수 1이라 다수에 영향은 없다.

## 국내 소스
| 소스 | 제공 | 비용·제약 | 갱신 |
|---|---|---|---|
| 네이버 모바일 `m.stock.naver.com/api/stock/{code}/integration` | ETF: 운용사, 순자산(`totalNav`), 총보수, 설명(기초지수). ETN: 시세만 | 비공식, 키 없음, 응답 cp949 혼재 | 장중 실시간 |
| 네이버 ETF·ETN 전체 목록 JSON | 종목코드, 종목명, 시가총액(`marketSum`, 억 원) | 비공식 | 장중 |
| KRX Open API(`data-dbg.krx.co.kr/svc/apis/etp/etf_bydd_trd`, `etn_bydd_trd`) | ETF·ETN 일별 매매정보. 응답 필드 명세는 로그인 뒤에만 보인다(ETF 순자산 `INVSTASST_NETASST_TOTAMT` 사례 있음) | 무료 인증키 신청, 일 10,000건, 비상업 용도 | 매일 08:00 KST(전일분) |
| 발행사 지수 문서(미래에셋 `J{code}.pdf`, KB `RULE_{code}.pdf`, 신한 ETNMETHOD) | 기초지수, 롤 규칙 | URL 규칙이 발행사마다 다름 | 상장 시 |

- ETN 만기일·상장일과 기초지수명을 자동으로 받을 무료 소스는 KRX Open API 외에 없다. 인증키를 받아 필드를 확인한 뒤 정한다(개발 단계).
- KRX Open API 실측(2026-10-28, 인증키·서비스 승인 뒤): 요청은 `?basDd=YYYYMMDD` + 헤더 `AUTH_KEY`, 하루치 전 종목이 한 번에 온다(ETF 1,186행 약 530KB, ETN 359행 약 160KB). 종목 필터는 없다. 휴장일은 빈 배열이다.
  - ETF 필드: `BAS_DD`·`ISU_CD`·`ISU_NM`·`TDD_CLSPRC`·`CMPPREVDD_PRC`·`FLUC_RT`·`NAV`·`TDD_OPNPRC`·`TDD_HGPRC`·`TDD_LWPRC`·`ACC_TRDVOL`·`ACC_TRDVAL`(거래대금)·`MKTCAP`·`INVSTASST_NETASST_TOTAMT`(순자산)·`LIST_SHRS`·`IDX_IND_NM`(기초지수명)·`OBJ_STKPRC_IDX`(기초지수 값)·`CMPPREVDD_IDX`·`FLUC_RT_IDX`
  - ETN 필드: ETF와 같고 `NAV`·순자산 대신 `PER1SECU_INDIC_VAL`(지표가치)·`INDIC_VAL_AMT`(지표가치 총액). **만기일·상장일 필드는 없다**(기초지수명 `IDX_IND_NM`은 있음). 만기일은 다른 소스가 필요하다.
- ETN 만기일 소스 추가 조사(2026-10-28): 무료·비로그인으로 만기일·상장일을 주는 소스를 찾지 못했다. KRX Open API 증권상품 서비스는 ETF·ETN·ELW 일별매매정보뿐이고(종목기본정보는 주식만), data.krx.co.kr `getJsonData.cmd`는 비로그인에 400 `LOGOUT`, 공공데이터포털 증권상품시세정보(15094806)·KRX 상장종목정보(15094775)에는 만기일 필드가 보이지 않는다(활용가이드 전체 명세는 미확인). 네이버 모바일 `basic`·`integration`에도 없다. 남은 후보는 발행사 지수 문서(PDF, URL 규칙이 발행사마다 다름)다.
- 총보수·운용사 주소 재확인(2026-10-28): 네이버 `integration`의 ETF `etfKeyIndicator`(`issuerName`·`totalFee`·`totalNav`)는 지금도 오고 ETN은 `etfKeyIndicator: null`이다. 국내 ETF 총보수는 이 값을, 운용사 주소는 브랜드 고정표를 쓴다(D-098).
  - `OBJ_STKPRC_IDX`로 S&P GSCI 지수 이력을 받아 한국형 지수를 재검증했다(D-089).

## 미국 상품 (Nasdaq 스크리너 + Yahoo, 2026-10-22)
| 원자재 | 상품 (순자산) | 규칙 |
|---|---|---|
| CL | UCO $402M, SCO $1,020M, OILK $238M | BCBCLI |
| | USO $1,690M | USO |
| | USL $49M | 12개월 |
| | DBO $258M | Optimum Yield |
| NG | BOIL $305M, KOLD $123M | BCOM |
| | UNG $458M | UNG |
| | UNL $16M | 12개월 |
| GC | UGL $765M, GLL $108M | BCOM |
| | DGP $200M, DGZ $1.2M, DZZ $1.1M | DBIQ Optimum Yield Gold |
| SI | AGQ $1,270M, ZSL $91M | BCOM |

- 제외: SHNY·DULL(GLD 추종), UGLD·USLV(2026-05 상장, GLD·SLV 같은 현물 ETP 추종), GLDI·SLVO·USOI(커버드콜), GOLY·YGLD 등 옵션·전략형, BNO(Brent).
- 상품 수 기준 결과: CL BCBCLI(3), NG BCOM(2), GC **Optimum Yield(3)**, SI BCOM(2).
- 순자산 합계 기준이면: CL USO $1.69B vs BCBCLI $1.66B(사실상 동률), NG UNG $458M vs BCOM $428M → 둘 다 뒤집힌다.

## 미국 소스
| 소스 | 제공 | 제약 |
|---|---|---|
| Nasdaq `api.nasdaq.com/api/screener/etf?download=true` | 전 종목(약 5,500, ETN 포함) 심볼·이름 | 비공식, 이름만 |
| Yahoo `quoteSummary` (`summaryDetail`, `fundProfile`, `defaultKeyStatistics`, `assetProfile`) | 순자산, 운용사, 보수, 설정일, 카테고리("Trading--Leveraged Commodities"), 설명 문장 | 비공식, crumb 필요. 기초지수명 필드 없음 |
| 운용사 사이트 | 기초지수, 배수 | 구조가 운용사마다 다름. Direxion·etfdb는 403 |

- 배수·선물 기반 여부·규칙은 이름과 설명 문장으로만 추정할 수 있다. 미국은 상품이 20개 안팎이라 오분류 위험(`product.md` 위험 사항)이 크고, 검증도 사람이 하는 편이 싸다.

## ETN 후속 시리즈 묶기
- 기준: (발행사, 원자재, 배수, 환헤지). 종목명에서 뽑는다. 발행사는 첫 단어, 배수는 `nX`·"레버리지"(2)·"인버스"(부호), 환헤지는 `(H)`, 시리즈는 끝 글자(B, C, D).
- 현재 목록에서 겹치는 조합은 삼성 2X WTI(530031 무표기, 530133 B) 하나이고, 기사로 같은 기초지수임을 확인했다. 이름은 "블룸버그" 유무와 띄어쓰기가 달라 이름 비교로는 묶이지 않는다.
- 한 발행사가 같은 조건으로 지수만 다른 상품을 동시에 내면 잘못 묶인다. 그때 기초지수가 있으면 키에 넣는다.

## 결정
- D-015: 상품 수 기준을 유지하고 순자산 미국 $10M, 국내 10억 원 미만 상품은 세지 않는다. 미국형 GC는 BCOM으로 남는다.
- D-016: 미국은 후보 발견·속성은 자동, 배수·규칙 분류는 심볼 매핑표. 매핑표에 없는 새 후보는 목록에서 빼고 확인 알림.
- D-017: C-d 정렬 선택(기본 / 순자산 / 평균 거래대금 20거래일). 거래대금은 국내 KRX Open API `ACC_TRDVAL`(2026-10-28 수정, 처음엔 네이버 `siseJson`), 미국 Yahoo `v8/finance/chart`(일봉, 빠진 날 null 있음)로 계산한다.
- ETP 배치 시각: 08:30 KST(KRX Open API 08:00 갱신 뒤, 미국 전일 마감 뒤).

## 출처
- [Bloomberg Single Commodity, Leveraged, and Inverse Index Methodology](https://assets.bbhub.io/professional/sites/27/Bloomberg-Single-Commodity-Leveraged-and-Inverse-Index-Methodology.pdf)
- [신한투자증권 Bloomberg WTI Single 2X Leveraged TR](http://file.shinhansec.com/filedoc/otc/ETNMETHOD-20220420-165.pdf), KB증권 지수 문서 `http://fdata.kbsec.com/ETN/RULE_{종목코드}.pdf`(580055, 580068~071, 580085~090), 미래에셋증권 `https://securities.miraeasset.com/public/hks4000/J{종목코드}.pdf`(520076, 520077, 520090, 520091)
- [Solactive Future Roll Guideline v1.4](https://solactive.com/downloads/Guideline-Solactive-Future-Roll.pdf), [SOF5GCS0](https://solactive.com/downloads/SOF5GCS0_Specific_Index_Parameters.pdf), [SOF5SIS0](https://www.solactive.com//downloads/SOF5SIS0_Specific_Index_Parameters.pdf), [SOF5NGS0](https://solactive.com/downloads/SOF5NGS0_Specific_Index_Parameters.pdf)
- [스마트투데이: 삼성 블룸버그 WTI ETN](https://www.smarttoday.co.kr/ko-kr/articles/78362), [한투 WTI ETN](https://www.smarttoday.co.kr/ko-kr/articles/78415), [KB S&P WTI ETN](https://www.smarttoday.co.kr/ko-kr/articles/78118)
- [MicroSectors Gold](https://microsectors.com/gold/?llm_view=1), [Direxion 2X 귀금속 출시](https://www.direxion.com/press-release/direxion-expands-2x-daily-bull-lineup-into-digital-assets-precious-metals), [DGP(ETF Central)](https://www.etfcentral.com/fund/DGP)
- [openkrx-mcp(KRX Open API 엔드포인트·갱신 시각)](https://github.com/RealYoungk/openkrx-mcp), [KRX Open API 필드 사례](https://github.com/untilled/aumos-catalogue/issues/63)
