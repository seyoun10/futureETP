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
- 사용자가 본인 1명이면 재배포가 아니므로 CME 배포 라이선스가 필요 없다. 업체의 개인용(non-pro) 요금제를 쓴다.
- 잠정 구성 (확정 전 실측 필요)
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
- 일일 정산 배치는 금속·에너지 정산이 모두 끝난 뒤로 잡는다. 확정(final) 정산가 반영 시각은 선택한 소스에서 실측해 정한다.

## 출처
- [CME January 2026 Market Data Fee List](https://www.cmegroup.com/market-data/files/january-2026-market-data-fee-list.pdf)
- [CME Schedule 5 to the ILA (January 2026)](https://www.cmegroup.com/market-data/files/schedule-5-to-the-ila-january-2026.pdf)
- [CME Non-Display Licensing FAQ (October 2024)](https://cmegroup.com/market-data/distributor/files/cme-group-data-licensing-policy-guidelines-and-non-display-licensing-faq-october-2024.pdf)
- [CME 2024 Derived Data Fees](https://cmegroup.com/market-data/files/2024-derived-data-fees.pdf)
- [CME Daily Settlement Time Details](https://cmegroupclientsite.atlassian.net/wiki/spaces/EPICSANDBOX/pages/457085528/Daily+Settlement+Time+Details)
- [CME Schedule 5 (Jul 2019, EOD $0)](https://www.cmegroup.com/market-data/files/mdla-cme-schedule-5-jul-2019.pdf), [MRCI: possible data vendors](https://www.mrci.com/web/help-pages/frequently-asked-questions/82-data/2298-mrci-possible-data-vendors.html), [Databento GLBX.MDP3 docs](https://databento.com/docs/knowledge-base/datasets/glbx-mdp3)
- [Massive Futures](https://massive.com/futures), [Databento Pricing](https://databento.com/pricing), [QuantVPS: CME Historical Data 2026](https://www.quantvps.com/blog/cme-historical-data-complete-guide)
