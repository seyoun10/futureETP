# 리서치: 선물 시세 소스와 라이선스

> Step 2 리서치 1/5 (2026-10-22). 수치는 웹 검색 결과 기준이며 계약 전에 원문 확인이 필요하다.

## 핵심 결론
- "무료 + 상업적 재표시 허용 + 만기 월물 이력" 세 조건을 모두 갖춘 소스는 찾지 못했다(`product.md` 위험 사항의 우려가 맞음).
- CME 시세를 앱에 표시하려면 **지연 시세라도 CME 배포 라이선스(ILA)** 가 필요하다. 소스(API 업체)가 무료여도 거래소 라이선스는 별도다.
- 서버에서 지수를 계산하는 것은 **non-display 사용** 또는 **derived data** 에 해당할 수 있어 별도 라이선스 여부를 CME에 확인해야 한다.

## CME 라이선스 (January 2026 fee list, 검색 요약 기준)
| 항목 | 금액 | 비고 |
|---|---|---|
| 지연 시세 배포(Delayed distribution) | Licensee Group당 연 $21,840 | 거래소(DCM)별 과금으로 보임. NYMEX+COMEX면 2배 가능성 → 확인 필요 |
| 지연 시세 단말(Delayed device) | $0 | |
| 실시간 배포 | 연 $29,280 | 실시간·지연을 함께 보유하면 실시간 요금만 적용 |
| 과거 데이터 배포 | 연 $35,220 | 과거 시계열(차트)을 표시하는 데 해당할 수 있음 → 확인 필요 |
| Derived data | 상품별 연 선납 | 사용 전 Derived Data License Agreement 서명 필요 |

- 2026 Schedule 5는 Mobile Application(iOS·Android)을 별도 정의한다.
- 문의처: marketdata@cmegroup.com

## 소스 후보 비교
| 소스 | 비용 | 만기 월물 | 정산가·거래량 | 이력 | 장중 | 앱 재표시 |
|---|---|---|---|---|---|---|
| Massive(구 Polygon) Basic | $0, 5 calls/분 | 미확인 | 미확인 | 2년 | 미명시 | 개인용(Non-pro)만 |
| Massive Starter~Advanced | $29~199/월 | 미확인 | 미확인 | 2~7년+ | 10분 지연~실시간 | 개인용. 비즈니스 요금제 별도 |
| Databento Standard | $199/월(+$125 무료 크레딧) | 개별 계약 전체(GLBX.MDP3) | statistics 스키마로 제공 | 2010-06-06~ | 실시간 | 외부 배포는 Plus($1,750/월~)부터, CME 라이선스 별도 |
| CME DataMine | 데이터셋별 | O | O | 장기 | X(파일) | 재배포 제한 |
| cmegroup.com 정산가 페이지 | 무료 | 당일 상장 월물 | O | 얕음 | 지연 | 스크래핑·재배포 불가(이용 약관) |
| Yahoo Finance / Stooq / TurtleTrader | 무료 | 대부분 연속물만 | 일부 | 다양 | 지연 | 재배포 불가 또는 불명확 |
| Firstrate Data | 저가 | O(약 130종) | 미확인 | 2007~ | X | 미확인 |

## 결정: 개인용 앱 (D-011)
> 아래 "잠정 구성"은 D-012(다음 절)로 대체됐다. 기록으로만 남긴다.

- 사용자가 본인 1명이면 재배포가 아니므로 CME 배포 라이선스가 필요 없다. 업체의 개인용(non-pro) 요금제를 쓴다.
- 잠정 구성 (대체됨, D-012)
  - 과거 일봉·거래량(2010-06~, 만기 월물 포함): Databento에서 1회 적재. $125 무료 크레딧 안에서 해결되는지 견적 도구로 확인
  - 일일 정산가·거래량: Databento 과거 데이터 API로 증분 수집(사용량 과금)
  - 장중 1시간 스냅숏: Massive 무료(분당 5회) 또는 Starter($29/월, 10분 지연). Databento 과거 데이터 API의 장중 지연이 짧으면 Databento로 통일
- 공개로 바꾸면 아래 "비용 최소화 방향"을 다시 검토한다.

## 결정: 비용 $0 구성 (D-012)
| 용도 | 소스 | 비고 |
|---|---|---|
| 과거 일봉·거래량 1회 적재 (2010-06~, 만기 월물) | Databento 무료 크레딧 $125 | 가입 후 6개월 만료. 적재 직전에 가입. 견적은 가입 후 실측 |
| 일일 정산가·거래량, 월물 정의(최종 거래일) | Massive Basic ($0, 분당 5회, EOD) | 정산가 필드 제공 여부는 가입 후 확인. 없으면 Yahoo 일봉으로 대신하고 정확도 검증 |
| 장중 스냅숏 (15분 주기) | Yahoo Finance 비공식 chart API | 약 10분 지연, 5분봉, 당일 고가·저가, 전일 종가 |

Yahoo 실측 (2026-10-22 13:30 UTC)
- `CLZ26.NYM`, `GCZ26.CMX`, `NGF27.NYM`, `SIZ26.CMX`: 조회됨. 만기 월물 `CLK20.NYM`: "delisted"로 조회 안 됨
- 5분봉 마지막 봉과 `regularMarketTime`이 13:20 UTC → 약 10분 지연
- 일봉 거래량이 이틀 연속 같은 값으로 나온 경우가 있음 → 거래량은 Massive를 기준으로 쓴다
- 비공식 API라 예고 없이 막힐 수 있다. 대체는 Massive Starter($29/월)

Yahoo 실측 2차 (2026-10-28 00:49 CT, 5-7 장중 배치 준비)
- 다중 심볼 조회
  - `v7/finance/quote`: 401 Unauthorized. 쿠키·crumb 절차가 필요해 쓰지 않는다.
  - `v8/finance/spark?symbols=…`: 인증 없이 된다. 한 번에 20개까지이고, 넘으면 400(`Number of symbols needs to be less than or equal to 20`)이다. 없는(만기) 심볼은 결과에서 빠질 뿐 오류가 아니다. 값은 5분봉 종가·전일 종가뿐이고 시가·고가·저가·거래량은 없다.
  - `v8/finance/chart/<심볼>`: 월물마다 1회. 65회 연속 호출(23초)에 모두 200(만기 1개는 404), 제한에 걸리지 않았다.
- 당일 고가·저가: chart `meta.regularMarketDayHigh`·`regularMarketDayLow`는 **17:00 CT 세션 시작부터 누적**이다. CLZ26·GCZ26 모두 17:00 CT 이후 5분봉 최고·최저와 정확히 같고, Yahoo의 `range=1d` 시작(자정 ET = 23:00 CT) 기준과는 다르다. D-022의 위험(대기 구간 터치를 놓침)은 없다.
- 시가: chart `meta`에 시가 필드가 없다. `range=1d`는 23:00 CT부터라 세션 시가가 아니므로, `period1`을 세션 시작(17:00 CT)으로 주고 첫 5분봉 시가를 쓴다.
- 거래량: `meta.regularMarketVolume`도 세션 누적이다(5분봉 합보다 조금 크다).
- 정비 시간 16:00~17:00 CT의 5분봉은 값이 모두 `null`로 온다.
- 지연: `regularMarketTime` 00:38:50 CT를 00:48:42 CT에 받음 → 약 10분 지연(1차와 같음).
- 일봉 종가 = CME 정산가: CLZ26 10/23 103.27·10/26 101.76, GCZ26 4007.90·4038.40이 Databento 정산가와 같다. `meta.previousClose`는 직전 거래일 정산가다.
- 장중 대상 월물 수(커브 최대 24개 기준): CL 24·NG 24·GC 12·SI 8 = 약 68개

## Massive Basic 실측 (2026-10-28 06:00 UTC, 가입 직후)
- 요금제: 가입하면 Futures Basic($0, Individual)이 이미 붙어 있다. 인증은 `Authorization: Bearer <키>`, 주소는 `https://api.massive.com`.
- 되는 것과 안 되는 것
  - `GET /futures/v1/contracts?product_code=CL&date=<날짜>&type=single&limit=1000`: 원자재당 1회로 전 월물이 온다(CL 138·NG 160). 필드 `ticker`·`first_trade_date`·`last_trade_date`·`settlement_date`·`active`(만기 지난 월물은 false로 섞여 옴). `type=single`을 빼면 스프레드가 섞인다. `sort`는 `date`·`product_code`·`ticker`만.
  - `GET /futures/v1/aggs/<티커>?resolution=1session&limit=N`: 거래일 봉 `session_end_date`·`open`·`high`·`low`·`close`·`volume`·`transactions`·**`settlement_price`**. 최신 거래일부터 내림차순이고 한 번에 여러 날을 받는다. 티커는 경로에 하나뿐이라 월물마다 1회다(제품 단위 조회는 404).
  - 진행 중인 세션 봉도 온다(정산가 없음). 2분 사이 종가·거래량이 바뀌어 거의 실시간에 가깝지만 지연은 재지 못했다. 1분봉(`resolution=1min`)은 세션 시작 직후(22:03 UTC)까지만 오고 `window_start` 필터는 날짜·나노초 모두 받지 않았다.
  - `snapshot`·`trades`: 403(권한 없음). `market-status?product_code=CL`: 된다.
- 티커 형식: 제품마다 Globex 원래 심볼이다. CL·GC·SI는 2029년물까지 연도 1자리(`CLZ6`), 2030년물부터 2자리(`CLF30`), NG는 2자리(`NGF27`). 직접 만들지 말고 contracts의 `ticker`를 쓴다. 형식이 틀리면 오류 없이 빈 결과다.
- Databento와 정산가 비교(2026-05~10-26): GCZ26 118일·CLZ28 119일·SIZ26 118일·NGF27 118일 **모두 일치**.
- 차이
  - 거래가 없는 날은 봉이 없어 정산가도 없다. GCQ28은 DB 86일 중 Massive 2일뿐이다(Databento는 거래 없어도 정산가가 있음).
  - 거래량은 Massive가 10~15% 작다(GCZ26 10/26 107,823 vs 126,007). Massive는 단일 월물 체결 합계, DB는 거래소 확정 거래량(stat 6, 스프레드 다리·블록 포함, D-088)이라 기준이 다르다.
- 호출 수: 분당 5회라 월물마다 1회면 DB에 있는 월물 전부(10/26 기준 CL 123·NG 146·GC 34·SI 32 = 335개)는 약 67분이다.
- 남은 실측: 정산가 반영 시각(18:30 CT 이후), 18:30 CT에 일부 월물이 빠지는지. → 아래 2차.

## Massive 정산가 반영 시각 실측 (2026-10-28 거래일)
- 대표월물 첫 확인(5분 간격): GCZ6·SIZ6 13:00 CT(첫 조회), CLZ6·NGZ26 13:35 CT. CME 정산 시각(금속 약 12:30, 에너지 13:30 CT) 직후다. 세션이 16:00 CT까지 이어지는 동안에도 봉에 `settlement_price`가 붙는다(거래량은 진행 중).
- 13:00 CT·17:15 CT·18:55 CT 값이 모두 같았다(잠정 → 최종 정산가 변경 없음).
- 17:13~17:16 CT 표본 12개(원자재마다 근월 2개 + 먼 월물 1개): 거래 있던 11개 모두 정산가 있음. SIZ7은 그날 거래가 없어 봉 없음.
- **17:00 CT(다음 세션 개장) 뒤 드문 월물의 그날 봉이 사라진다.** NGZ27은 17:14 CT에 10/28 봉(정산 4.003, 거래량 2,437)이 있었으나 18:55 CT에는 10/28 봉이 없고 `session_end_date` 10/29 봉(거래량 2,440 = 2,437 + 새 체결 3, 정산가 없음)만 있었다. 같은 봉이 다음 세션으로 이름이 바뀐 것이다. 거래가 활발한 NGZ26은 10/28 봉이 그대로 확정돼 있다.
- 가까운 26개 × 4 전체 점검: 18:30 CT 봉 없음 47개, 19:30 CT 48개(정산가 없는 봉은 0). 17:43 CT에 시작한 `DAILY_SETTLE`은 GC 13·SI 9·CL 18·NG 21개만 저장했다(NGZ27·NGF28처럼 일찍 받은 월물은 저장됨).
- 10/27 정정 확인(`SETTLE_REVISION`, 10/28 20:25 CT 시작·28분, 다른 감시와 키를 같이 써 429 재시도 포함): 성공. 저장된 10/27 봉 62개(GC 10·SI 10·CL 16·NG 26)가 모두 응답에 있었고, SIX26·SIF27(거래량 56·36)만 값이 달라 정정됐다. 정정 전 값은 남기지 않아 어느 값이 바뀌었는지는 모른다(10/28 16:49 CT에 받은 값과 다름).
- 결론: 마감(16:00 CT) 뒤, 개장(17:00 CT) 전에 받는다(D-101).
- 사라진 10/28 봉 관찰(30분 간격): NGZ27·NGF28·NGN27·SIF7·GCF7·CLZ8·GCV6 7개는 10/29 12:24 CT 감시 종료까지 10/28 봉이 다시 나오지 않았다.

## 16:05 CT 정산 확인 (2026-10-29 거래일)
- `DAILY_SETTLE` 16:05:43 CT 시작, 16:29 CT 성공(약 23분, 호출 간격 13초 때문). 저장: GC 13·SI 9·CL 19·NG 25개(가까운 26개 중).
- 빠진 38개(CL 7·GC 13·NG 1·SI 17)를 10/30에 다시 조회했을 때도 10/29 봉이 없었다. 16:05에 없던 봉이 나중에 나오지 않으므로 그날 거래가 없던 월물이다.
- 결론: 16:05 CT 실행은 받을 수 있는 봉을 모두 받는다(D-101 확정).

## 사라진 봉 재출현과 드문 월물 (2026-11-02 21:48 CT 조회)
- 10/28에 17:00 CT 뒤 사라졌던 NGZ27·NGF28·CLZ8의 10/28 봉이 다시 있었다. NGZ27은 거래량 2,437·정산 4.003으로 10/28 17:14 CT 관찰값과 같다. 다시 나온 시점은 10/29 12:24 CT~11/02 21:48 CT 사이다.
- 16:05 실행(10/29·10/30)에서 이틀 모두 봉이 없던 먼 월물은 실제로 드물게 거래된다: CLJ8 최근 봉 10/23(12계약)·10/22·10/21·10/19·10/15, CLN8 10/23·8/12·7/13, GCF8 10/22·9/15·8/31(모두 1계약), SIF8 8/18·8/17·6/30(1계약).
- aggs `limit=10`은 달력 10세션이 아니라 **봉이 있는 최근 10세션**이다. 드문 월물은 1회로 몇 달 치가 나온다.
- Databento 거래량(스프레드 체결 포함으로 추정)으로는 Massive 봉 유무를 예측할 수 없다: CL 가까운 26개 중 Massive에 매일 봉이 없는 6~7개도 Databento로는 30일 중 22일 거래량이 있다.
- 결론: 드문 먼 월물은 평일에 건너뛰고 토요일에 빠진 봉을 채운다(D-110).

## 장중 갱신 주기 (1시간보다 짧게 할 수 있는가)
- 결론: 가능하다. 짧게 해도 소용 있는 하한은 **소스의 지연 시간**이다.

| 소스 | 지연 | 호출 제한 | 한 번에 여러 월물 | 주기 하한(실질) | 비용 |
|---|---|---|---|---|---|
| Massive Basic | 미확인(주식 무료 요금제는 EOD라 같을 가능성) | 분당 5회 | 집계 API는 월물별 1회 | 미확인 | $0 |
| Massive Starter | 10분 지연 | 무제한 | Snapshot API(정산가·세션 거래량 포함) | 약 10분 | $29/월 |
| Massive Advanced | 실시간 | 무제한 | Snapshot API | 1분 단위 | $199/월 |
| Databento 과거 데이터 API | 수십 분으로 보임(가용 범위 끝을 `metadata.get_dataset_range`로 확인, 실측 필요) | 사용량 과금 | O | 실측 후 | 사용량 |
| Databento Standard(라이브) | 실시간 | - | O | 실시간 | $199/월 |

- Massive Contracts API는 월물별 첫·최종 거래일을 준다. Snapshot API는 정산가와 세션 거래량을 준다. 미결제약정 제공 여부는 문서에서 확인하지 못했다.
- 주기를 줄여도 서버 계산량(지수 48개 + 알림 판정)은 작아서 부담이 되지 않는다. 바뀌는 것은 소스 요금제다.
- 장중 고가·저가는 Snapshot의 세션 고가·저가를 쓰면 되므로, 스냅숏 최대·최소로 대신하는 규칙이 필요 없을 수 있다.

## 비용 최소화 방향 (스토어 공개를 전제로 검토, D-011 이전)
- 비용의 대부분은 업체 API 요금이 아니라 **거래소 배포 라이선스**다. 수집량을 줄여도 라이선스 비용은 그대로다.
- 업체 비용: 과거 데이터를 한 번 받아 DB에 저장하고, 이후에는 증분만 받는다. Databento 과거 데이터는 $0.50/GB부터 사용량 과금이라 일봉 위주면 소액일 것으로 본다(견적 도구로 실측 필요).
- 라이선스 비용: 갈림길은 **장중 시세를 표시하는지 여부**다.
  - CME 2019 schedule은 End of Day 배포를 $0으로 표시했다. 반면 최근 MRCI 공지는 EOD 정산가 재배포에도 라이선스가 필요하다고 한다. 현재 기준은 CME 확인이 필요하다.
  - EOD가 무료이거나 저가이면 "정산가만 표시(장중 제외)"로 바꾸는 것이 가장 큰 절감안이다.
- Databento 정산가는 정산 구간 직후 먼저 게시되고, 확정 거래량·미결제약정은 보통 다음 UTC 날짜에 들어온다. 거래량·미결제약정이 없는 계약은 CME가 정산가를 게시하지 않는다.

## 정산 시각 (CME 안내 기준, ET)
| 원자재 | 정산 구간 |
|---|---|
| 에너지(CL·NG) | 14:28~14:30 |
| 금(GC) | 13:29~13:30 |
| 은(SI) | 13:24~13:25 |

- cmegroup.com 반영은 예정 시각에서 최대 10분 늦어질 수 있고, 조기 마감일에는 바뀐다.
- 일일 정산 배치는 금속·에너지 정산이 모두 끝난 뒤로 잡는다. CME 최종 정산가 게시(18:00 CT) 뒤인 18:30 CT로 정했다(D-019, `curve-settlement.md`). 소스 반영 시각은 가입 후 실측한다.

## 출처
- [CME January 2026 Market Data Fee List](https://www.cmegroup.com/market-data/files/january-2026-market-data-fee-list.pdf)
- [CME Schedule 5 to the ILA (January 2026)](https://www.cmegroup.com/market-data/files/schedule-5-to-the-ila-january-2026.pdf)
- [CME Non-Display Licensing FAQ (October 2024)](https://cmegroup.com/market-data/distributor/files/cme-group-data-licensing-policy-guidelines-and-non-display-licensing-faq-october-2024.pdf)
- [CME 2024 Derived Data Fees](https://cmegroup.com/market-data/files/2024-derived-data-fees.pdf)
- [CME Daily Settlement Time Details](https://cmegroupclientsite.atlassian.net/wiki/spaces/EPICSANDBOX/pages/457085528/Daily+Settlement+Time+Details)
- [CME Schedule 5 (Jul 2019, EOD $0)](https://www.cmegroup.com/market-data/files/mdla-cme-schedule-5-jul-2019.pdf), [MRCI: possible data vendors](https://www.mrci.com/web/help-pages/frequently-asked-questions/82-data/2298-mrci-possible-data-vendors.html), [Databento GLBX.MDP3 docs](https://databento.com/docs/knowledge-base/datasets/glbx-mdp3)
- [Massive Futures](https://massive.com/futures), [Databento Pricing](https://databento.com/pricing), [QuantVPS: CME Historical Data 2026](https://www.quantvps.com/blog/cme-historical-data-complete-guide)
