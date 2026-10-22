# 리서치: 한국형·미국형 롤 규칙

> Step 2 리서치 3/5 (2026-10-22). 지수 방법론 원문(PDF)과 운용사·발행사 페이지로 확인했다. 상품 수 집계는 잠정이며, ETP 전수 목록은 ④ ETP 소스 리서치에서 확정한다.

## 핵심 결론
| 원자재 | 한국형 | 미국형 | 비고 |
|---|---|---|---|
| CL | S&P GSCI 일정 (매월 롤, 5~9영업일) | Bloomberg Balanced WTI(BCBCLI, 3개 일정 균등) | 서로 다름 |
| NG | S&P GSCI 일정 (매월 롤, 5~9영업일) | BCOM 일정 (격월 롤, 5~9영업일) | 서로 다름 |
| GC | S&P GSCI 일정 (1·3·5·7·11월 롤) | BCOM 일정 | **월물 일정·롤 시점이 같다** |
| SI | S&P GSCI 일정 (2·4·6·8·11월 롤) | BCOM 일정 | **월물 일정·롤 시점이 같다** |

- 국내 상품은 지수 회사가 달라도(S&P GSCI, DJCI, Solactive WTI, Bloomberg Single) 대부분 "매월(금속은 지정 월) 5~9영업일에 하루 20%씩 다음 월물로" 옮긴다. 그래서 다수 판정은 지수 이름이 아니라 **규칙이 같은지**로 묶어서 센다.
- S&P GSCI(5~9영업일)와 BCOM(6~10영업일)은 이름만 하루 차이다. 두 방법론 공식을 이 서비스의 공식(`Σ w(t-1)·P(t) / Σ w(t-1)·P(t-1)`)에 맞추면 **비중이 바뀌는 날이 같다**(아래 "비중 시점"). 차이는 보유 월물 일정과 영업일 달력뿐이다.
- 그래서 금·은은 한국형과 미국형이 사실상 같은 지수가 된다(영업일 달력 차이로 드물게 하루 어긋날 수 있다).

## 지수별 규칙
### 비중 시점 (서비스 공식 기준)
서비스 공식은 전일 비중 `w(t-1)`로 오늘 수익률을 계산한다. 아래 비중은 **그날 종가 이후 보유하는 비중**(다음 날 수익률에 쓰이는 값)이다.

| 규칙 | 이전 월물 비중 (그날 종가 기준) | 근거 |
|---|---|---|
| S&P GSCI·DJCI | 5영업일 80% → 6일 60% → 7일 40% → 8일 20% → 9일 0% | CRW는 "전일에 유효한 값"을 쓴다(GSCI 가이드, DJCI 국문 방법론의 `CW(t-1)`) |
| BCOM | 같음 (5~9영업일) | 6영업일 수익률 공식이 0.8/0.2를 쓴다. 실제 헤지 롤 기간(Hedge Roll Period)도 5~9영업일이다 |
| BCBCLI | 2영업일 50% → 3영업일 0% | 롤 예시 표(2020-03): 3일차 수익률에 2일차 50/50을 쓴다 |

### 영업일 달력
| 규칙 | 영업일 정의 |
|---|---|
| S&P GSCI·DJCI | NYSE 영업일 |
| BCOM | 지수 구성 원자재 비중의 50% 넘게 거래되는 날 (사실상 미국 거래소 영업일) |
| BCBCLI | NYMEX가 열리는 날 |

- `trading_day`(CME 거래일)와 대부분 같다. NYSE만 쉬는 특별 휴장(예: 국장일)에는 영업일 순번이 하루 밀릴 수 있다. 예외 날짜 목록으로 처리한다.
- 시장 혼란(Market Disruption Event)으로 롤이 미뤄지는 경우는 재현하지 않는다(드묾).

### 보유 월물 일정 (매월 1영업일 기준 보유 월물)
월 코드: F1 G2 H3 J4 K5 M6 N7 Q8 U9 V10 X11 Z12, `+1`은 다음 해.

| 규칙 | 1월 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 롤 하는 달 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| GSCI CL·NG | G | H | J | K | M | N | Q | U | V | X | Z | F+1 | 매월 |
| GSCI GC = BCOM GC | G | J | J | M | M | Q | Q | Z | Z | Z | Z | G+1 | 1·3·5·7·11월 |
| GSCI SI = BCOM SI | H | H | K | K | N | N | U | U | Z | Z | Z | H+1 | 2·4·6·8·11월 |
| BCOM CL·NG | H | H | K | K | N | N | U | U | X | X | F+1 | F+1 | 2·4·6·8·10·12월 |

- 그 달 보유 월물과 다음 달 보유 월물이 다르면 그 달 롤 기간에 옮긴다.
- 예: 2026년 10월 한국형 CL은 10/7~10/13(NYSE 5~9영업일)에 X26 → Z26으로 옮긴다.

### BCBCLI (미국형 CL)
| 일정 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 월간(Monthly) | H | J | K | M | N | Q | U | V | X | Z | F+1 | G+1 |
| 6월물(June) | M | M | M | M+1 | M+1 | M+1 | M+1 | M+1 | M+1 | M+1 | M+1 | M+1 |
| 12월물(December) | Z | Z | Z | Z | Z | Z | Z | Z | Z | Z+1 | Z+1 | Z+1 |

- 세 일정을 1/3씩 담는다. 3월·9월 1영업일 종가에 가치 기준 1/3로 다시 맞추고, 그 사이에는 가격 변화대로 비중이 흘러간다(drift).
- 월간 일정은 매월, 6월물 일정은 3월, 12월물 일정은 9월에 2~3영업일 동안 롤 한다.
- 한 날짜에 최대 3개(롤 중에는 최대 6개) 월물을 동시에 담는다.
- 근거: UCO·SCO·OILK의 기초지수다. 방법론은 2021-03판이 최신 링크다(2024-11 Benchmark Statement 기준).

### 단일 월물을 쓰는 미국 상품 (소수 규칙)
| 상품 | 규칙 |
|---|---|
| USO | 최근월물 → 다음 월물, 매월 초 5일에 나눠 옮김(정확한 영업일은 공시 확인 필요) |
| UNG | 최근월물, 만기 2주 전부터 다음 월물 |
| USL·UNL | 연속 12개 월물 균등 |
| DBO | DBIQ Optimum Yield(곡선 상태로 월물 선택) |

## 상품 수 집계 (잠정)
### 미국 (ProShares·USCF 공식 페이지, 2026-10-21 기준 순자산)
| 원자재 | 다수 규칙 | 상품 | 그 밖의 규칙 |
|---|---|---|---|
| CL | BCBCLI (3) | UCO $462M, SCO, OILK $246M | USO, USL, DBO 각 1 |
| NG | BCOM NG (2) | BOIL $311M, KOLD | UNG, UNL 각 1 |
| GC | BCOM GC (2) | UGL $717M, GLL | DGP·DGZ·DZZ(DBIQ Optimum Yield, 3종이지만 DGZ·DZZ 순자산 약 $1M이라 하한 미달, D-015). SHNY·DULL은 GLD 기초라 범위 밖 |
| SI | BCOM SI (2) | AGQ $1,136M, ZSL | - |

### 한국 (KRX 상장, 네이버 증권 목록 2026-10-22)
| 원자재 | ETF (기초지수 확인) | ETN | 다수 규칙(잠정) |
|---|---|---|---|
| CL | KODEX WTI원유선물(H)·인버스, TIGER 원유선물인버스: S&P GSCI Crude Oil. TIGER 원유선물Enhanced: GSCI Enhanced | 약 20종. S&P(KB·하나), Solactive WTI(미래에셋, 5~9영업일), 블룸버그(삼성·신한) 등 | GSCI 일정 |
| NG | 없음 | 약 23종. DJCI(미래에셋·삼성, 5~9영업일), Bloomberg NG Single(미래에셋 1.5X, 5~9영업일), 블룸버그(신한), Solactive(KB·하나·메리츠) | GSCI 일정 |
| GC | KODEX 골드선물(H)·인버스, TIGER 골드선물(H), ACE 골드선물 레버리지: S&P GSCI Gold | 14종. Solactive 7종(메리츠·KB·한투), 나머지는 ④에서 4계열 모두 GSCI 일정 확인(`etp-sources.md`) | GSCI 일정 |
| SI | KODEX 은선물(H): S&P GSCI Silver | 약 18종. DJCI Silver(미래에셋: GSCI와 같은 2·4·6·8·11월, 5~9영업일) 등 | GSCI 일정 |

- 국내 ETN은 발행사가 많고 기초지수를 한곳에서 조회할 수 없다(KRX 정보데이터시스템은 로그인 필요, 네이버 API에는 ETN 기초지수가 없음). ④에서 발행사별 지수 문서로 전수 확인한다.
- 확인이 남은 것:
  - 삼성·신한 "블룸버그" WTI·천연가스 ETN이 BCOM 일정(격월)인지, Bloomberg Single 계열(매월 5~9영업일)인지
  - Solactive 금 지수: 최근월물 추종, 4~5일 롤, 롤 하는 달이 GSCI와 다를 수 있음(Global X HUG 일정은 1·3·5·7·11월)
  - Solactive 천연가스 지수의 롤 일정
- 이 항목들이 다수를 뒤집을 가능성: CL·NG는 낮다(ETF와 S&P·DJCI·Solactive WTI가 이미 같은 규칙). GC는 미확인 ETN 7종이 모두 Solactive 규칙이면 뒤집힌다.

## 데이터 모델에 주는 영향
- `roll_weight.weight`는 **수량 기준 비중**이다. 서비스 공식이 같은 비중을 분자·분모에 쓰므로 GSCI(CPW·CRW)와 BCOM(WAV 혼합)의 수량 비중과 맞는다. 날짜마다 합이 1이 되게 정규화해 저장한다(혼합 가격이 달러 단위가 되도록).
- BCBCLI는 리밸런스일에 가치 1/3을 수량으로 바꾸고(`1/3 ÷ 가격`), 이후 수량을 유지하므로 drift가 자연히 재현된다.
- `roll_rule.params`는 "일정 여러 개(leg) + 영업일 달력 + 롤 일자·비중 + 리밸런스"로 표현한다(`data-model.md`).

## 출처
- [S&P GSCI Reference Guide (2016-02, 대신증권 게시본)](https://etn.daishin.com/e5_data/mboard/etn_product/2022/06/34_00_methodology-sp-gsci-quick-guide.pdf): 롤 기간, 월물 일정, 영업일 정의
- [Bloomberg Commodity Index Methodology](https://assets.bbhub.io/professional/sites/10/BCOM-Methodology.pdf) (2023 가중치판): Table 9 월물 일정, 롤 공식, Hedge Roll Period
- [Bloomberg Commodity Balanced WTI Crude Oil Index Methodology (2021-03)](https://assets.bbhub.io/professional/sites/10/Bloomberg-Commodity_Balanced_WTI_Crude_Oil_Index_Methodology-2021-Mar.pdf), [Benchmark Statement (2024-11)](https://assets.bbhub.io/professional/sites/27/Benchmark-Statement-Bloomberg-Commodity-Balanced-WTI-Crude-Oil-Index-11042024.pdf)
- [ProShares 2020 424B3 (WTI 기초지수 변경)](https://www.sec.gov/Archives/edgar/data/1415311/000119312520177809/d920998d424b3.htm)
- ProShares 상품 페이지: [UCO](https://www.proshares.com/our-etfs/leveraged-and-inverse/uco), [BOIL](https://www.proshares.com/our-etfs/leveraged-and-inverse/boil), [UGL](https://www.proshares.com/our-etfs/leveraged-and-inverse/ugl), [AGQ](https://www.proshares.com/our-etfs/leveraged-and-inverse/agq), [OILK](https://www.proshares.com/our-etfs/strategic/oilk)
- USCF 상품 페이지: [USO](https://www.uscfinvestments.com/uso), [UNG](https://www.uscfinvestments.com/ung), [USL](https://www.uscfinvestments.com/usl), [UNL](https://www.uscfinvestments.com/unl)
- 국내 지수 문서: [DJCI Natural Gas 2X Leveraged TR(대신증권)](https://etn.daishin.com/e5_data/mboard/etn_product/2022/10/45_00_(%ED%95%9C%EA%B8%80)DJCI%20Natural%20Gas%202X%20Leveraged%20TR.pdf), 미래에셋증권 ETN 지수 문서(`https://securities.miraeasset.com/public/hks4000/J{종목코드}.pdf`: 520076, 520090, 520092, 520096)
- 국내 ETF 기초지수: 네이버 증권 종목 정보(`m.stock.naver.com/api/stock/{코드}/integration`)
- [Solactive: Hana·Meritz 천연가스 ETN 보도자료](https://www.solactive.com/wp-content/uploads/2025/09/Press-Release-Hana-Securities-and-Meritz-Securities-have-launched-new-ETNs-Tracking-Solactive-Natural-Gas-Total-Return-Leverage-Indices.pdf), [Solactive Gold Front Month 방법론](https://solactive.com/wp-content/uploads/2020/01/Methodology_SOLCGCER_v12.pdf), [Global X futures roll](https://www.globalx.ca/futures-roll)
- [스마트투데이: 삼성증권 블룸버그 WTI ETN 상장](https://www.smarttoday.co.kr/ko-kr/articles/78362)
